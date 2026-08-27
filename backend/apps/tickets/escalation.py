"""Escalating a ticket — TKT-4's manual flag, now also SLA-3's automatic
trigger.

Lives in `apps.tickets` — `escalated`/`escalated_at` are `Ticket`'s own
fields, the same placement reasoning `apps/tickets/assignment.py` uses
for `apply_assignment` (Story 29).
"""

from django.utils import timezone


def apply_escalation(ticket, escalated: bool) -> bool:
    """Sets `ticket.escalated`/`escalated_at`, returning `False` (no-op)
    if the ticket already has this exact state. Shared by the manual
    `TicketViewSet.escalate` action (Story 23, a human decision) and
    SLA-3's `evaluate_escalations` task (an automatic one, always called
    with `escalated=True`) — one code path for both, mirroring
    `apply_assignment`'s own shape (Story 29). Unlike `apply_assignment`,
    this never creates a `TicketActivity` row — escalation changes are
    deliberately not logged (Story 24's own decision, unchanged here).
    """
    if escalated == ticket.escalated:
        return False
    ticket.escalated = escalated
    ticket.escalated_at = timezone.now() if escalated else None
    ticket.save(update_fields=["escalated", "escalated_at", "updated_at"])
    return True
