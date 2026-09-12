import logging

from django.db import transaction
from django.db.models import Q
from django.utils.translation import gettext_lazy as _
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.ai.exceptions import AIServiceError, AIServiceUnavailable
from apps.core.permissions import Permissions, permissions_for
from apps.core.scoping import ScopedQuerysetMixin, ScopeFilter
from apps.core.throttling import AiRateThrottle
from apps.core.views import BaseModelViewSet
from apps.sla.policy import annotate_sla_facts, bulk_target_resolver, compute_sla_status
from apps.sla.tasks import auto_assign_ticket

from .assignment import apply_assignment, assignable_agents
from .bulk import fetch_tickets, first_error_message, parse_ticket_ids
from .context import build_ticket_context
from .duplicates import find_duplicate_candidates
from .escalation import apply_escalation
from .history import build_history
from .merge import apply_merge
from .models import Category, SavedView, Ticket
from .reply_suggestions import draft_reply
from .serializers import CategorySerializer, SavedViewSerializer, TicketSerializer
from .solution_suggestions import find_ticket_solutions
from .status import apply_status_change
from .summarization import summarize_ticket

logger = logging.getLogger(__name__)


class CategoryViewSet(BaseModelViewSet):
    """Category CRUD — TKT-2's own management endpoints. Reuses `tickets.*`
    — a category is part of the ticket domain, not a separate permission
    domain (mirrors `MessageViewSet`'s reuse of the same constants, Story 13
    `## Product rules`). See Story 18 `## Prerequisites`.
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    ordering_fields = ("name", "created_at")
    search_fields = ("name",)


class SavedViewViewSet(BaseModelViewSet):
    """Named, per-user saved filter/sort combinations for the ticket list —
    TKT-8. Reuses `tickets.*` like `CategoryViewSet`/`QuickReplyViewSet` (a
    saved view is part of the ticket-list domain, not a separate
    permission), but ownership adds a wrinkle neither of those (fully
    shared, no owner) has: a private row is visible only to its own
    owner, and editing someone else's SHARED row needs `tickets.manage` —
    enforced explicitly below, not through `permission_map` (which only
    ever gates by action name, never by object) and not through
    `HasPermission.has_object_permission` (which stays the
    portal-customer-only extension point it already is). See Story 108
    `## Context`, items 4 and 7.
    """

    queryset = SavedView.objects.select_related("owner").all()
    serializer_class = SavedViewSerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        # Creating (and sharing) a view needs only tickets.view — the
        # owner-or-manager rule is an EDIT-time gate on someone else's row,
        # per the intake's own wording. See Story 108 `## Product rules`.
        "create": Permissions.TICKETS_VIEW,
        "update": Permissions.TICKETS_VIEW,
        "partial_update": Permissions.TICKETS_VIEW,
        "destroy": Permissions.TICKETS_VIEW,
        "set_default": Permissions.TICKETS_VIEW,
    }

    ordering_fields = ("name", "created_at")
    search_fields = ("name",)

    def get_queryset(self):
        queryset = super().get_queryset()
        # A private (is_shared=False) row is visible only to its own
        # owner; a shared row is visible to anyone who can reach this
        # endpoint at all. An invisible row 404s on retrieve/update/
        # destroy/set_default (DRF's get_object() filters through this),
        # never leaking existence the way a 403 would.
        return queryset.filter(Q(owner=self.request.user) | Q(is_shared=True))

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def _check_editable(self, saved_view):
        """Owner always may; otherwise the caller needs tickets.manage —
        the established stand-in for "a manager" throughout this codebase
        (apps.tickets.assignment.assignable_agents(), Story 108
        `## Context` item 6), not a role-slug check.
        """
        if saved_view.owner_id == self.request.user.id:
            return
        if Permissions.TICKETS_MANAGE in permissions_for(self.request.user):
            return
        raise PermissionDenied()

    def perform_update(self, serializer):
        self._check_editable(serializer.instance)
        serializer.save()

    def perform_destroy(self, instance):
        self._check_editable(instance)
        instance.delete()

    @action(detail=True, methods=["post"], url_path="set-default")
    def set_default(self, request, pk=None):
        """Marks (or clears) this view as the CALLER's own default — never
        someone else's, even for a shared view the caller merely edits.
        Owner-only: `is_default` reflects what loads on the caller's own
        screen, so the owner-or-manager EDIT rule (name/`is_shared`) does
        not extend to it. `is_default` must be present and a real
        boolean; re-sending the current value is a 400 — the same
        no-op-rejection contract `TicketViewSet.escalate` already
        established (Story 23).
        """
        if "is_default" not in request.data:
            raise ValidationError({"is_default": [_("This field is required.")]})
        is_default = request.data.get("is_default")
        if not isinstance(is_default, bool):
            raise ValidationError({"is_default": [_("Must be true or false.")]})

        saved_view = self.get_object()
        if saved_view.owner_id != request.user.id:
            raise PermissionDenied()
        if is_default == saved_view.is_default:
            raise ValidationError({"is_default": [_("Saved view already has this default state.")]})

        with transaction.atomic():
            if is_default:
                SavedView.objects.filter(owner=request.user, is_default=True).update(
                    is_default=False
                )
            saved_view.is_default = is_default
            saved_view.save(update_fields=["is_default", "updated_at"])
        return Response(self.get_serializer(saved_view).data)


class TicketViewSet(ScopedQuerysetMixin, BaseModelViewSet):
    """Ticket CRUD. The second consumer of `BaseModelViewSet`, after Customer."""

    queryset = Ticket.objects.select_related(
        "customer", "category", "assigned_agent", "department", "branch"
    ).all()
    serializer_class = TicketSerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
        # Both keyed by the @action's own method name (verified in Story 20).
        # A missing entry does NOT deny — it falls through to
        # authenticated-only. See Story 22 `## Migration / Rollback`.
        "assign": Permissions.TICKETS_MANAGE,
        "assignable_agents": Permissions.TICKETS_VIEW,
        # Both keyed by the @action's own method name (verified in Story 20,
        # reused in Story 22). A missing entry does NOT deny — it falls
        # through to authenticated-only. See Story 23 `## Migration / Rollback`.
        "set_status": Permissions.TICKETS_MANAGE,
        "escalate": Permissions.TICKETS_MANAGE,
        # TKT-9: same reasoning as every entry above — keyed by the
        # @action's own method name, missing means authenticated-only not
        # denied.
        "merge": Permissions.TICKETS_MANAGE,
        "duplicate_candidates": Permissions.TICKETS_VIEW,
        # TKT-7: same reasoning as every entry above — keyed by the
        # @action's own method name, missing means authenticated-only not
        # denied. All three reuse tickets.manage, the same gate the
        # single-ticket assign/set_status/priority-edit already use.
        "bulk_assign": Permissions.TICKETS_MANAGE,
        "bulk_status": Permissions.TICKETS_MANAGE,
        "bulk_priority": Permissions.TICKETS_MANAGE,
        "history": Permissions.TICKETS_VIEW,
        "context": Permissions.TICKETS_VIEW,
        "sla": Permissions.TICKETS_VIEW,
        "summarize": Permissions.TICKETS_VIEW,
        "suggest_reply": Permissions.TICKETS_MANAGE,
        "suggest_solutions": Permissions.TICKETS_VIEW,
    }

    # Each name here must match a `ColumnDef.id` on the frontend, exactly
    # like `CustomerViewSet`. `customer`/`customer_name`/`category_name`/
    # `assigned_agent_name` are deliberately absent — see Story 12
    # `## Story Goal` for why `customer_name` is not sortable, the same
    # choice this story makes for `category_name`/`assigned_agent_name`.
    # `sla_status` is deliberately ABSENT: it is computed per row from
    # annotations, not a column, so the database cannot order by it. Making
    # it sortable needs its own design pass (a stored/denormalised column
    # plus invalidation on every policy edit), not a line here.
    ordering_fields = ("subject", "status", "priority", "created_at")
    search_fields = ("subject", "description", "customer__name")

    # ORG-1's reusable scoping declaration, now with ORG-2's second entry —
    # added without one line of new parsing code, which was the point.
    # `?department=none`/`?branch=none` list tickets with no department/
    # branch; the two compose with AND. See `apps/core/scoping.py`.
    scope_filters = (
        ScopeFilter(param="department", field="department"),
        ScopeFilter(param="branch", field="branch"),
    )

    def get_serializer_context(self):
        """Adds the bulk SLA target resolver on the list path only.

        Built ONCE per request (two queries) and reused for every row.
        Building it inside `TicketSerializer.get_sla_status` instead would
        be two queries PER TICKET — functionally identical, silently
        N+1, and the single most likely way to regress this story.
        """
        context = super().get_serializer_context()
        if self.action == "list":
            context["sla_resolve"] = bulk_target_resolver()
        return context

    def perform_create(self, serializer):
        ticket = serializer.save()
        try:
            auto_assign_ticket.delay(ticket.id)
        except Exception:
            # The Ticket row is already committed — creation must succeed
            # regardless of whether the auto-assignment task could even be
            # queued (e.g. Redis unreachable). Same resilience pattern
            # `MessageViewSet.perform_create` already uses for
            # `adapter.send()` (Story 14). See Story 29 `## Prerequisites`.
            logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)

    def get_queryset(self):
        # `super().get_queryset()` reaches `ScopedQuerysetMixin`, which
        # applies the `department` scope declared above — only on `list`,
        # the same guard this method's own early return covers below.
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset

        # F-9: the two facts `sla_status` needs, as correlated subqueries —
        # no extra query, and crucially not one per row. `compute_sla_status`
        # (the detail action) stays per-ticket; this is the bulk path Story
        # 28 deferred. See `apps.sla.policy.annotate_sla_facts`.
        queryset = annotate_sla_facts(queryset)

        # Optional, unlike MessageViewSet/ContactDetailViewSet's required
        # `ticket`/`customer` params (Story 11/13) — a ticket list must
        # still work with no filter applied. Present-but-malformed input is
        # still a 400, not a silent no-op. See Story 18 `## Product rules`.
        category_id = self.request.query_params.get("category")
        if category_id:
            try:
                category_id = int(category_id)
            except ValueError:
                raise ValidationError({"category": [_("Must be a valid category id.")]}) from None
            queryset = queryset.filter(category_id=category_id)

        priority = self.request.query_params.get("priority")
        if priority:
            if priority not in Ticket.Priority.values:
                raise ValidationError({"priority": [_("Must be a valid priority.")]})
            queryset = queryset.filter(priority=priority)

        status = self.request.query_params.get("status")
        if status:
            if status not in Ticket.Status.values:
                raise ValidationError({"status": [_("Must be a valid status.")]})
            queryset = queryset.filter(status=status)

        # Scoped by request.user, never by a client-supplied id — "my
        # tickets" means the caller's own queue. Same optional-filter
        # contract as `category`/`priority` above: absent means no filter.
        # Only the exact string "true" enables it, so a typo'd value is an
        # explicit 400 rather than a silently-unfiltered list.
        assigned_to_me = self.request.query_params.get("assigned_to_me")
        if assigned_to_me:
            if assigned_to_me != "true":
                raise ValidationError({"assigned_to_me": [_('Must be "true" if present.')]})
            queryset = queryset.filter(assigned_agent=self.request.user)

        return queryset

    @action(detail=False, methods=["get"], url_path="assignable-agents")
    def assignable_agents(self, request):
        """Users a ticket can be assigned to — TKT-3. A narrow, read-only
        list, NOT a user-management API (`SEC-1` owns that). Gated on
        `tickets.view`: picking an assignee is part of working tickets, not
        of administering users, which is why this needs no `users.view`.

        `/api/tickets/assignable-agents/` does not shadow
        `/api/tickets/<pk>/` — the router registers detail=False dynamic
        routes first (verified, see Story 22 `## Prerequisites`).
        """
        agents = [{"id": agent.id, "name": agent.get_full_name()} for agent in assignable_agents()]
        return Response(agents)

    @action(detail=True, methods=["post"], url_path="assign")
    def assign(self, request, pk=None):
        """Assign, reassign, or unassign a ticket — TKT-3.

        `assigned_agent` must be present in the body: an id to assign, or
        an explicit `null` to unassign. An omitted key is a 400, not an
        unassign — the same explicit-`null`-never-omission rule §23
        records for every nullable field in this project.

        A non-assignable id is rejected against the SAME queryset the
        options endpoint serves (`assignment.assignable_agents`), so a
        hand-crafted POST cannot assign a ticket to someone who has no
        `tickets.manage`. See Story 22 `## Prerequisites`.
        """
        if "assigned_agent" not in request.data:
            raise ValidationError({"assigned_agent": [_("This field is required.")]})

        agent_id = request.data.get("assigned_agent")
        agent = None
        if agent_id is not None:
            try:
                agent_id = int(agent_id)
            except (TypeError, ValueError):
                raise ValidationError({"assigned_agent": [_("Must be a valid user id.")]}) from None
            agent = assignable_agents().filter(pk=agent_id).first()
            if agent is None:
                raise ValidationError(
                    {"assigned_agent": [_("That user cannot be assigned tickets.")]}
                )

        ticket = self.get_object()
        apply_assignment(ticket, agent, actor=request.user)
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="status")
    def set_status(self, request, pk=None):
        """Change a ticket's status along a valid transition — TKT-4.
        Delegates validation/logging to `apps.tickets.status.apply_status_change`
        — the same helper TKT-7's `bulk_status` calls, so both enforce ONE
        path (Story 106 `## Prerequisites`). `status` must be present in
        the body — an omitted key is a 400.
        """
        if "status" not in request.data:
            raise ValidationError({"status": [_("This field is required.")]})

        ticket = self.get_object()
        apply_status_change(ticket, request.data.get("status"), actor=request.user)
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        """Escalate or de-escalate a ticket — TKT-4. A manual action; SLA-3's
        automatic evaluation job (`apps.sla.tasks.evaluate_escalations`)
        shares this action's `apply_escalation` helper but can only ever
        escalate, never de-escalate — see Story 30 `## Prerequisites`.

        `escalated` must be present and a real boolean — an omitted key or a
        truthy-but-not-boolean value (e.g. the string `"true"`) is a 400.
        Re-sending the ticket's current escalation state is also a 400.
        """
        if "escalated" not in request.data:
            raise ValidationError({"escalated": [_("This field is required.")]})

        escalated = request.data.get("escalated")
        if not isinstance(escalated, bool):
            raise ValidationError({"escalated": [_("Must be true or false.")]})

        ticket = self.get_object()
        if not apply_escalation(ticket, escalated):
            raise ValidationError({"escalated": [_("Ticket already has this escalation state.")]})
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="merge")
    def merge(self, request, pk=None):
        """Merge this ticket (the SOURCE) into another (the TARGET) — TKT-9.
        `target_id` must be present and a valid ticket id. Both AUTHZ and
        the customer/self/already-merged checks are enforced inside
        `apply_merge` — see Story 109 `## Product rules`.
        """
        if "target_id" not in request.data:
            raise ValidationError({"target_id": [_("This field is required.")]})
        try:
            target_id = int(request.data.get("target_id"))
        except (TypeError, ValueError):
            raise ValidationError({"target_id": [_("Must be a valid ticket id.")]}) from None

        source = self.get_object()
        # SAME queryset `get_object()` itself filters through — not a raw
        # `Ticket.objects.get(...)` — so the target is fetched under the
        # identical visibility rule the source already was. See Story 109
        # `## Product rules` (AUTHZ row).
        target = self.get_queryset().filter(pk=target_id).first()
        if target is None:
            raise ValidationError({"target_id": [_("Ticket not found.")]})

        apply_merge(source, target, actor=request.user)
        return Response(self.get_serializer(source).data)

    @action(detail=True, methods=["get"], url_path="duplicate-candidates")
    def duplicate_candidates(self, request, pk=None):
        """Likely duplicates of this ticket — TKT-9. Suggestion only; never
        merges anything. Gated `tickets.view` alone, the same reasoning
        `history`/`context`/`sla` use — a read, no separate permission.
        """
        ticket = self.get_object()
        candidates = find_duplicate_candidates(ticket)
        return Response(
            [
                {
                    "id": candidate.id,
                    "subject": candidate.subject,
                    "status": candidate.status,
                    "priority": candidate.priority,
                    "created_at": candidate.created_at,
                    "rank": candidate.rank,
                }
                for candidate in candidates
            ]
        )

    @action(detail=False, methods=["post"], url_path="bulk-assign")
    def bulk_assign(self, request):
        """Assign or unassign many tickets in one call — TKT-7. Same body
        contract as `assign` (`assigned_agent` required; an id assigns,
        `null` unassigns; validated against the SAME `assignable_agents()`
        queryset) applied to every id in `ticket_ids`, via the SAME
        `apply_assignment` helper `assign` itself calls — no second,
        looser validation or logging path. A not-found ticket id is a
        per-row failure, never a whole-request 400.
        """
        if "assigned_agent" not in request.data:
            raise ValidationError({"assigned_agent": [_("This field is required.")]})

        agent_id = request.data.get("assigned_agent")
        agent = None
        if agent_id is not None:
            try:
                agent_id = int(agent_id)
            except (TypeError, ValueError):
                raise ValidationError({"assigned_agent": [_("Must be a valid user id.")]}) from None
            agent = assignable_agents().filter(pk=agent_id).first()
            if agent is None:
                raise ValidationError(
                    {"assigned_agent": [_("That user cannot be assigned tickets.")]}
                )

        ticket_ids = parse_ticket_ids(request.data)
        tickets_by_id = fetch_tickets(self.get_queryset(), ticket_ids)

        results = []
        for ticket_id in ticket_ids:
            ticket = tickets_by_id.get(ticket_id)
            if ticket is None:
                results.append({"id": ticket_id, "ok": False, "error": str(_("Ticket not found."))})
                continue
            apply_assignment(ticket, agent, actor=request.user)
            results.append({"id": ticket_id, "ok": True})
        return Response({"results": results})

    @action(detail=False, methods=["post"], url_path="bulk-status")
    def bulk_status(self, request):
        """Change the status of many tickets in one call — TKT-7. Each id
        is validated and logged through the SAME `apply_status_change`
        helper `set_status` calls, so a transition illegal for one
        ticket's current status is only THAT row's failure — tickets in
        different states legitimately react differently to the same
        requested target status.
        """
        if "status" not in request.data:
            raise ValidationError({"status": [_("This field is required.")]})
        new_status = request.data.get("status")

        ticket_ids = parse_ticket_ids(request.data)
        tickets_by_id = fetch_tickets(self.get_queryset(), ticket_ids)

        results = []
        for ticket_id in ticket_ids:
            ticket = tickets_by_id.get(ticket_id)
            if ticket is None:
                results.append({"id": ticket_id, "ok": False, "error": str(_("Ticket not found."))})
                continue
            try:
                apply_status_change(ticket, new_status, actor=request.user)
            except ValidationError as exc:
                results.append({"id": ticket_id, "ok": False, "error": first_error_message(exc)})
                continue
            results.append({"id": ticket_id, "ok": True})
        return Response({"results": results})

    @action(detail=False, methods=["post"], url_path="bulk-priority")
    def bulk_priority(self, request):
        """Change the priority of many tickets in one call — TKT-7.
        `priority` is a plain writable field on `TicketSerializer` — unlike
        `status`/`assigned_agent` it has no dedicated single-ticket action
        and no activity-log entry even on an ordinary edit (Story 106
        `## Prerequisites`) — so this mirrors that: no no-op rejection, no
        `TicketActivity` row, just the field write.
        """
        if "priority" not in request.data:
            raise ValidationError({"priority": [_("This field is required.")]})
        new_priority = request.data.get("priority")
        if new_priority not in Ticket.Priority.values:
            raise ValidationError({"priority": [_("Must be a valid priority.")]})

        ticket_ids = parse_ticket_ids(request.data)
        tickets_by_id = fetch_tickets(self.get_queryset(), ticket_ids)

        results = []
        for ticket_id in ticket_ids:
            ticket = tickets_by_id.get(ticket_id)
            if ticket is None:
                results.append({"id": ticket_id, "ok": False, "error": str(_("Ticket not found."))})
                continue
            ticket.priority = new_priority
            ticket.save(update_fields=["priority", "updated_at"])
            results.append({"id": ticket_id, "ok": True})
        return Response({"results": results})

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        """A ticket's full activity history — TKT-5. Merges the persisted
        `TicketActivity` log (status/assignment changes) with the ticket's
        `Message` rows (replies) into one feed. Gated on `tickets.view`
        alone — `MessageViewSet` already reuses the same permission for
        reading messages, verified in `## Prerequisites`, so no second
        explicit check is needed the way `CustomerViewSet.timeline`
        (Story 20) needed one.
        """
        ticket = self.get_object()
        return Response(build_history(ticket))

    @action(detail=True, methods=["get"], url_path="context")
    def context(self, request, pk=None):
        """Combined ticket+customer+recent-history context for the side
        panel — AGENT-2. Permission-checked twice on purpose, the mirror
        image of `CustomerViewSet.timeline` (Story 20): `permission_map`
        gates this on `tickets.view` like every other read here, and the
        explicit check below adds `customers.view`, because the payload
        includes a full customer record that `CustomerViewSet` gates that
        way. See Story 26 `## Prerequisites`.
        """
        if Permissions.CUSTOMERS_VIEW not in permissions_for(request.user):
            raise PermissionDenied()
        ticket = self.get_object()
        return Response(build_ticket_context(ticket))

    @action(detail=True, methods=["get"], url_path="sla")
    def sla(self, request, pk=None):
        """This ticket's SLA status — SLA-1. Gated `tickets.view` alone,
        the same reasoning `history` uses (Story 24) — no separate SLA
        permission exists. Returns `null` when no `SLAPolicy` applies to
        this ticket's priority/category, which is a normal outcome (SLA
        tracking is opt-in per priority), not an error.
        """
        ticket = self.get_object()
        sla_status = compute_sla_status(ticket)
        return Response(sla_status)

    # PROD-3: `throttle_classes` on the @action, not the class — a class
    # attribute would throttle `list`/`retrieve` too. `AiRateThrottle`
    # carries the "ai" scope itself and keys per user, so one caller cannot
    # spend another's provider budget. See CONVENTIONS.md § 36.
    @action(
        detail=True,
        methods=["post"],
        url_path="summarize",
        throttle_classes=[AiRateThrottle],
    )
    def summarize(self, request, pk=None):
        """AI-generated conversation summary — AI-1. Gated `tickets.view`
        alone, the same reasoning `.history`/`.context`/`.sla` use — no
        separate AI permission exists (see Story 75 `## Product rules`).
        `POST`, not `GET`: unlike those three, this has a real external
        cost and returns a freshly generated result each call.
        """
        ticket = self.get_object()
        try:
            summary = summarize_ticket(ticket)
        except AIServiceError as exc:
            raise AIServiceUnavailable() from exc
        return Response({"summary": summary})

    @action(
        detail=True,
        methods=["post"],
        url_path="suggest-reply",
        throttle_classes=[AiRateThrottle],
    )
    def suggest_reply(self, request, pk=None):
        """AI-drafted reply suggestion — AI-2. Gated `tickets.manage`,
        matching `ReplyForm`'s own gate (`<Can permission="tickets.manage">`,
        `TicketConversation.tsx`) — only a user who could actually send a
        reply gets to draft one.
        """
        ticket = self.get_object()
        try:
            reply = draft_reply(ticket)
        except AIServiceError as exc:
            raise AIServiceUnavailable() from exc
        return Response({"reply": reply})

    @action(
        detail=True,
        methods=["post"],
        url_path="suggest-solutions",
        throttle_classes=[AiRateThrottle],
    )
    def suggest_solutions(self, request, pk=None):
        """AI-matched knowledge-base solutions — AI-4. Gated `tickets.view`
        alone, the same reasoning `.summarize` uses — a read-oriented
        convenience for whoever can already see the ticket, not a
        mutation.
        """
        ticket = self.get_object()
        try:
            suggestion = find_ticket_solutions(ticket)
        except AIServiceError as exc:
            raise AIServiceUnavailable() from exc
        return Response(suggestion)
