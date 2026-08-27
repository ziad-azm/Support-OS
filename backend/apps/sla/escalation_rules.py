"""Escalation-rule threshold resolution and at-risk/idle evaluation —
SLA-3.

Lives in `apps.sla`, alongside `apps/sla/policy.py` (Story 28) and
`apps/sla/assignment_rules.py` (Story 29) — the same placement reasoning
and the same verified-safe reverse-direction import into
`apps.tickets.models`/`apps.communications.models` (neither imports back
from `apps.sla`, so no cycle).
"""

from datetime import timedelta

from apps.communications.models import Message
from apps.sla.policy import compute_sla_status
from apps.tickets.models import Ticket, TicketActivity

from .models import EscalationRule


def max_enabled_threshold(kind: str) -> int | None:
    """The largest `threshold_minutes` among enabled rules of this kind,
    or `None` if none are enabled. Evaluating against the single largest
    threshold is equivalent to "any enabled rule of this kind matches": a
    smaller remaining-time-to-deadline (or a longer idle gap) that
    satisfies a smaller threshold always satisfies a larger one too, so
    multiple overlapping rules of the same kind collapse to one check
    with no loss of behaviour. Called once per kind per task run
    (`apps/sla/tasks.py::evaluate_escalations`), not once per ticket.
    """
    return (
        EscalationRule.objects.filter(kind=kind, enabled=True)
        .order_by("-threshold_minutes")
        .values_list("threshold_minutes", flat=True)
        .first()
    )


def _last_activity_at(ticket: Ticket):
    """The most recent of: the ticket's own creation, its latest message,
    its latest logged activity. A cheap, two-query alternative to
    `apps/tickets/history.py::build_history` (Story 24) — that function
    fetches up to `HISTORY_MAX_ENTRIES` rows from each of two tables to
    build a full feed for one ticket's detail page; this needs only the
    single latest timestamp, computed for potentially every open ticket
    on a recurring schedule, where that cost difference is worth avoiding.
    """
    latest_message = (
        Message.objects.filter(ticket=ticket)
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    latest_activity = (
        TicketActivity.objects.filter(ticket=ticket)
        .order_by("-created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    return max(ts for ts in (latest_message, latest_activity, ticket.created_at) if ts is not None)


def is_at_risk(ticket: Ticket, threshold_minutes: int | None, now) -> bool:
    """`True` if the ticket's response or resolution dimension is still
    `pending` (per `compute_sla_status`, Story 28) and due within
    `threshold_minutes`. `False` immediately if `threshold_minutes` is
    `None` (no `at_risk` rule enabled), or no `SLAPolicy` applies to this
    ticket at all — at-risk escalation is opt-in twice over.
    """
    if threshold_minutes is None:
        return False
    sla = compute_sla_status(ticket)
    if sla is None:
        return False
    threshold = timedelta(minutes=threshold_minutes)
    for due_at, dimension_status in (
        (sla["response_due_at"], sla["response_status"]),
        (sla["resolution_due_at"], sla["resolution_status"]),
    ):
        if dimension_status == "pending" and due_at - now <= threshold:
            return True
    return False


def is_idle(ticket: Ticket, threshold_minutes: int | None, now) -> bool:
    """`True` if `threshold_minutes` is not `None` and the ticket's last
    activity (message or logged activity, whichever is newer) is at least
    that many minutes in the past.
    """
    if threshold_minutes is None:
        return False
    return now - _last_activity_at(ticket) >= timedelta(minutes=threshold_minutes)
