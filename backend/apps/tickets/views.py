from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .assignment import assignable_agents
from .models import Category, Ticket
from .serializers import CategorySerializer, TicketSerializer
from .status import is_valid_transition


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


class TicketViewSet(BaseModelViewSet):
    """Ticket CRUD. The second consumer of `BaseModelViewSet`, after Customer."""

    queryset = Ticket.objects.select_related("customer", "category", "assigned_agent").all()
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
    }

    # Each name here must match a `ColumnDef.id` on the frontend, exactly
    # like `CustomerViewSet`. `customer`/`customer_name`/`category_name`/
    # `assigned_agent_name` are deliberately absent — see Story 12
    # `## Story Goal` for why `customer_name` is not sortable, the same
    # choice this story makes for `category_name`/`assigned_agent_name`.
    ordering_fields = ("subject", "status", "priority", "created_at")
    search_fields = ("subject", "description", "customer__name")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset

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
        ticket.assigned_agent = agent
        ticket.save(update_fields=["assigned_agent", "updated_at"])
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="status")
    def set_status(self, request, pk=None):
        """Change a ticket's status along a valid transition — TKT-4.

        `status` must be present in the body — an omitted key is a 400, the
        same explicit-value rule §23 uses for `assign`'s `assigned_agent`.
        Re-sending the ticket's current status is also a 400: "no-op" is not
        a transition. See `apps/tickets/status.py` for the graph.
        """
        if "status" not in request.data:
            raise ValidationError({"status": [_("This field is required.")]})

        new_status = request.data.get("status")
        if new_status not in Ticket.Status.values:
            raise ValidationError({"status": [_("Must be a valid status.")]})

        ticket = self.get_object()
        if new_status == ticket.status:
            raise ValidationError({"status": [_("Ticket is already in this status.")]})
        if not is_valid_transition(ticket.status, new_status):
            raise ValidationError(
                {
                    "status": [
                        _("Cannot change status from %(current)s to %(new)s.")
                        % {"current": ticket.status, "new": new_status}
                    ]
                }
            )

        ticket.status = new_status
        ticket.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(ticket).data)

    @action(detail=True, methods=["post"], url_path="escalate")
    def escalate(self, request, pk=None):
        """Escalate or de-escalate a ticket — TKT-4. A manual flag, not
        SLA-3's future automatic escalation — see Story 23 `## Prerequisites`.

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
        if escalated == ticket.escalated:
            raise ValidationError({"escalated": [_("Ticket already has this escalation state.")]})

        ticket.escalated = escalated
        ticket.escalated_at = timezone.now() if escalated else None
        ticket.save(update_fields=["escalated", "escalated_at", "updated_at"])
        return Response(self.get_serializer(ticket).data)
