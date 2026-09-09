"""SLA policy resolution and status computation — SLA-1.

Lives in `apps.sla`: this is the domain's own question ("what is a
ticket's SLA status"), even though the read action that calls it sits on
`TicketViewSet` (`apps/tickets/views.py`) — the reverse-direction
relationship `apps/tickets/context.py` has with `apps.customers`, mirrored
the other way. Verified safe: `apps.sla.models`/`policy` import
`apps.tickets.models` and `apps.communications.models`, not
`apps.tickets.views`, so `apps.tickets.views` → `apps.sla.policy` →
`apps.tickets.models` has no cycle. See Story 28 `## Prerequisites`.
"""

from datetime import timedelta

from django.db.models import OuterRef, QuerySet, Subquery
from django.utils import timezone

from apps.communications.models import Message
from apps.organization.models import OrganizationSettings
from apps.tickets.models import Ticket, TicketActivity

from .models import SLAPolicy


def resolve_policy(ticket: Ticket) -> SLAPolicy | None:
    """The most specific policy for this ticket: an exact
    (priority, category) match if the ticket has a category and one
    exists, else the priority-only default (category=None), else the
    org-wide default from `OrganizationSettings` (SEC-4) if one is
    configured. `None` only when none of the three apply — SLA tracking
    remains opt-in, not guaranteed for every ticket.
    """
    if ticket.category_id is not None:
        specific = SLAPolicy.objects.filter(
            priority=ticket.priority, category_id=ticket.category_id
        ).first()
        if specific is not None:
            return specific
    default = SLAPolicy.objects.filter(priority=ticket.priority, category__isnull=True).first()
    if default is not None:
        return default
    return _org_default_policy()


def _org_default_policy() -> SLAPolicy | None:
    """An UNSAVED `SLAPolicy` built from `OrganizationSettings`'s two
    default-minutes fields, or `None` if either is unset. Never
    `.save()`d: `compute_sla_status` (below) only ever reads
    `.response_target_minutes`/`.resolution_target_minutes` off whatever
    `resolve_policy` returns, plus `.id` for the response's `policy_id` —
    `None` on an unsaved instance, which correctly tells a caller this
    came from the org default, not a configured `SLAPolicy` row.
    """
    settings_obj = OrganizationSettings.load()
    if (
        settings_obj.default_response_target_minutes is None
        or settings_obj.default_resolution_target_minutes is None
    ):
        return None
    return SLAPolicy(
        response_target_minutes=settings_obj.default_response_target_minutes,
        resolution_target_minutes=settings_obj.default_resolution_target_minutes,
    )


def dimension_status(due_at, achieved_at, now) -> str:
    """ "met" (achieved by the deadline), "breached" (deadline passed,
    whether achieved late or not at all), or "pending" (not yet due, not
    yet achieved). Computed fresh every call — a "pending" ticket becomes
    "breached" automatically once real time passes `due_at`, with nothing
    to update.

    Public since Story 57 (RPT-2): the bulk report path
    (`apps/reports/sla.py`) needs the exact same classification a
    single-ticket read uses, so the two can never disagree.
    """
    if achieved_at is not None:
        return "met" if achieved_at <= due_at else "breached"
    return "breached" if now > due_at else "pending"


def compute_sla_status(ticket: Ticket) -> dict | None:
    """Response/resolution due times and status for this ticket, computed
    on read from its resolved policy — nothing is persisted on `Ticket`.
    `None` if no policy applies to this ticket's priority/category.
    """
    policy = resolve_policy(ticket)
    if policy is None:
        return None

    now = timezone.now()
    response_due_at = ticket.created_at + timedelta(minutes=policy.response_target_minutes)
    resolution_due_at = ticket.created_at + timedelta(minutes=policy.resolution_target_minutes)

    first_reply = (
        Message.objects.filter(ticket=ticket, direction=Message.Direction.OUTBOUND)
        .order_by("created_at")
        .first()
    )
    first_response_at = first_reply.created_at if first_reply else None

    # The FIRST time this ticket reached resolved/closed, per the activity
    # log (Story 24) — NOT `ticket.updated_at`, which bumps on every save
    # after resolution too. See Story 28 `## Prerequisites`.
    resolved_activity = (
        TicketActivity.objects.filter(
            ticket=ticket,
            kind=TicketActivity.Kind.STATUS_CHANGED,
            to_value__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED],
        )
        .order_by("created_at")
        .first()
    )
    resolved_at = resolved_activity.created_at if resolved_activity else None

    return {
        "policy_id": policy.id,
        "response_target_minutes": policy.response_target_minutes,
        "resolution_target_minutes": policy.resolution_target_minutes,
        "response_due_at": response_due_at,
        "response_status": dimension_status(response_due_at, first_response_at, now),
        "resolution_due_at": resolution_due_at,
        "resolution_status": dimension_status(resolution_due_at, resolved_at, now),
    }


# --- Bulk path -------------------------------------------------------------
# `resolve_policy` + `compute_sla_status` above answer the question for ONE
# ticket and cost two-to-four queries doing it. Anything rendering a LIST of
# tickets needs the same answer without paying that per row — Story 28's own
# `## Prerequisites` (point 13) flagged the N+1 and deferred batching to "a
# future story... worth its own design pass".
#
# RPT-2 (Story 57) wrote that strategy first, privately inside
# `apps/reports/sla.py`. It lives here now because it is SLA domain
# knowledge, not reporting knowledge, and because a SECOND consumer (the
# ticket list, Story 103) would otherwise have copied it — the exact
# "silently disagree with the single-ticket read" failure the shared
# `dimension_status` was made public to prevent.


def bulk_target_resolver():
    """Returns `(priority, category_id) -> (response_minutes,
    resolution_minutes) | None` for a whole page of tickets, in TWO queries
    total instead of `resolve_policy`'s two per ticket.

    Mirrors `resolve_policy`'s exact three-tier lookup — category-specific,
    then priority-only default, then the org-wide default — against
    pre-fetched dicts. The org tier is `None` unless BOTH minutes are set,
    reproducing `_org_default_policy`'s own rule rather than treating a
    half-configured organization as valid.
    """
    policies_by_key = {(p.priority, p.category_id): p for p in SLAPolicy.objects.all()}
    org = OrganizationSettings.load()
    org_targets = None
    if (
        org.default_response_target_minutes is not None
        and org.default_resolution_target_minutes is not None
    ):
        org_targets = (org.default_response_target_minutes, org.default_resolution_target_minutes)

    def resolve(priority, category_id):
        policy = policies_by_key.get((priority, category_id))
        if policy is None:
            policy = policies_by_key.get((priority, None))
        if policy is not None:
            return (policy.response_target_minutes, policy.resolution_target_minutes)
        return org_targets

    return resolve


def annotate_sla_facts(queryset: QuerySet) -> QuerySet:
    """Annotates `first_response_at` and `resolved_at` onto a `Ticket`
    queryset — the same two facts `compute_sla_status` fetches per ticket,
    for the whole queryset at NO extra query cost (both compile into the
    existing SELECT as correlated subqueries).

    `resolved_at` is the FIRST time the ticket reached resolved/closed per
    the activity log, not `updated_at`, which bumps on every later save —
    the same distinction `compute_sla_status` documents.
    """
    first_response = (
        Message.objects.filter(ticket=OuterRef("pk"), direction=Message.Direction.OUTBOUND)
        .order_by("created_at")
        .values("created_at")[:1]
    )
    resolved_activity = (
        TicketActivity.objects.filter(
            ticket=OuterRef("pk"),
            kind=TicketActivity.Kind.STATUS_CHANGED,
            to_value__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED],
        )
        .order_by("created_at")
        .values("created_at")[:1]
    )
    return queryset.annotate(
        first_response_at=Subquery(first_response),
        resolved_at=Subquery(resolved_activity),
    )


def status_from_facts(
    created_at, priority, category_id, first_response_at, resolved_at, resolve, now
) -> str | None:
    """One ticket's overall SLA status, from already-fetched facts.

    The WORSE of the two dimensions, in `dimension_status`'s own vocabulary
    (`met` / `breached` / `pending`) — deliberately not a new three-value
    scale. An "at risk" tier was considered and rejected: nothing in this
    codebase defines an approaching-breach threshold, so it would be an
    invented number pretending to be a measurement.

    `None` when no policy resolves — SLA tracking is opt-in, the same
    outcome `compute_sla_status` already treats as normal.
    """
    targets = resolve(priority, category_id)
    if targets is None:
        return None
    response_target, resolution_target = targets
    statuses = (
        dimension_status(created_at + timedelta(minutes=response_target), first_response_at, now),
        dimension_status(created_at + timedelta(minutes=resolution_target), resolved_at, now),
    )
    for worst in ("breached", "pending", "met"):
        if worst in statuses:
            return worst
    return None
