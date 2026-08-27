"""Which ticket status transitions are legal — TKT-4.

Same shape as `apps/tickets/assignment.py` (Story 22): a small, pure
business-rule helper, imported by `views.py`. No cross-app import note
needed here — `status` is ticket-domain data living in this same app.

The graph is hand-authored, not derived from `Ticket.Status`'s declaration
order, because "next status" is a product decision, not an artifact of how
the choices happen to be listed. `closed` is deliberately terminal — see
Story 23 `## Story Goal`, "What this story does... not".
"""

from .models import Ticket

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
