"""Which ticket status transitions are legal — TKT-4.

Same shape as `apps/tickets/assignment.py` (Story 22): a small, pure
business-rule helper, imported by `views.py`. No cross-app import note
needed here — `status` is ticket-domain data living in this same app.

The graph is hand-authored, not derived from `Ticket.Status`'s declaration
order, because "next status" is a product decision, not an artifact of how
the choices happen to be listed. `closed` is deliberately terminal — see
Story 23 `## Story Goal`, "What this story does... not".
"""

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from .models import Ticket, TicketActivity

VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    Ticket.Status.OPEN: frozenset({Ticket.Status.IN_PROGRESS, Ticket.Status.CLOSED}),
    Ticket.Status.IN_PROGRESS: frozenset(
        {Ticket.Status.OPEN, Ticket.Status.RESOLVED, Ticket.Status.CLOSED}
    ),
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
    ticket.save(update_fields=["status", "updated_at"])
    TicketActivity.objects.create(
        ticket=ticket,
        actor=actor,
        kind=TicketActivity.Kind.STATUS_CHANGED,
        from_value=old_status,
        to_value=new_status,
    )
