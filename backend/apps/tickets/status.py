"""Which ticket status transitions are legal — TKT-4.

Same shape as `apps/tickets/assignment.py` (Story 22): a small, pure
business-rule helper, imported by `views.py`. No cross-app import note
needed here — `status` is ticket-domain data living in this same app.

The graph is hand-authored, not derived from `Ticket.Status`'s declaration
order, because "next status" is a product decision, not an artifact of how
the choices happen to be listed. `closed` is deliberately terminal — see
Story 23 `## Story Goal`, "What this story does... not".
"""

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.organization.business_hours import elapsed_working_minutes
from apps.sla.policy import resolve_calendar, resolve_policy

from .models import Ticket, TicketActivity

VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    Ticket.Status.OPEN: frozenset({Ticket.Status.IN_PROGRESS, Ticket.Status.CLOSED}),
    Ticket.Status.IN_PROGRESS: frozenset(
        {
            Ticket.Status.OPEN,
            Ticket.Status.PENDING_CUSTOMER,
            Ticket.Status.RESOLVED,
            Ticket.Status.CLOSED,
        }
    ),
    # SLA-6 (Story 112): the only way out is back to `in_progress` — see
    # Story 112 `## Prerequisites` for why `resolved`/`closed` are not
    # reachable directly from here.
    Ticket.Status.PENDING_CUSTOMER: frozenset({Ticket.Status.IN_PROGRESS}),
    Ticket.Status.RESOLVED: frozenset({Ticket.Status.IN_PROGRESS, Ticket.Status.CLOSED}),
    Ticket.Status.CLOSED: frozenset(),
}


def is_valid_transition(current: str, new: str) -> bool:
    """True if `current -> new` is an allowed move. `current == new` is
    always False — re-stating the current status is rejected by the caller
    as a no-op, not treated as a legal (empty) transition."""
    return new in VALID_TRANSITIONS.get(current, frozenset())


def apply_status_change(ticket: Ticket, new_status: str, actor) -> None:
    """Validates and applies a status change, then logs it — the SAME
    checks `TicketViewSet.set_status` used to run inline, now shared with
    TKT-7's `bulk_status`. Raises the identical `ValidationError`s a
    single-ticket call already raised (unrecognised value, no-op
    re-statement, illegal transition) so neither caller has a looser path.
    Mirrors `apps/tickets/assignment.py::apply_assignment`'s shape: one
    helper, multiple callers, one `TicketActivity` write site. See Story
    106 `## Prerequisites`.
    """
    if new_status not in Ticket.Status.values:
        raise ValidationError({"status": [_("Must be a valid status.")]})
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

    old_status = ticket.status
    ticket.status = new_status
    update_fields = ["status", "updated_at"]
    now = timezone.now()

    if new_status == Ticket.Status.PENDING_CUSTOMER:
        ticket.pending_customer_since = now
        update_fields.append("pending_customer_since")
    elif old_status == Ticket.Status.PENDING_CUSTOMER:
        # Leaving a wait — SLA-6 (Story 112). Folds the just-ended pause
        # into the running total, working-time-aware when a calendar
        # applies (the same `resolve_calendar` lookup
        # `compute_sla_status` uses, so the two can never disagree about
        # which calendar governs this ticket).
        paused_since = ticket.pending_customer_since
        if paused_since is not None:
            calendar = resolve_calendar(ticket, resolve_policy(ticket))
            if calendar is not None:
                elapsed = elapsed_working_minutes(calendar, paused_since, now)
            else:
                elapsed = int((now - paused_since).total_seconds() // 60)
            ticket.sla_paused_minutes += elapsed
            update_fields.append("sla_paused_minutes")
        ticket.pending_customer_since = None
        update_fields.append("pending_customer_since")

    if new_status == Ticket.Status.CLOSED:
        ticket.closed_at = now
        update_fields.append("closed_at")
    ticket.save(update_fields=update_fields)
    TicketActivity.objects.create(
        ticket=ticket,
        actor=actor,
        kind=TicketActivity.Kind.STATUS_CHANGED,
        from_value=old_status,
        to_value=new_status,
    )


def resume_from_pending_customer(ticket: Ticket) -> None:
    """Ends a `pending_customer` wait automatically — the customer just
    replied (`apps/tickets/signals.py`, SLA-6, Story 112). A no-op if the
    ticket has already left `pending_customer` by the time this runs
    (e.g. an agent manually resumed it moments earlier) — never raises
    for an already-resolved race, unlike `apply_status_change`'s own
    strict validation.
    """
    if ticket.status != Ticket.Status.PENDING_CUSTOMER:
        return
    apply_status_change(ticket, Ticket.Status.IN_PROGRESS, actor=None)
