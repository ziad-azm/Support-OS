"""Background tasks — SLA-2. The project's first real `@shared_task`
beyond `config.celery.debug_task` (Story 27) — no further Celery wiring
is needed; `app.autodiscover_tasks()` (`config/celery.py`) finds this
module because it is named `tasks.py` inside an installed app.
"""

from celery import shared_task

from apps.tickets.assignment import apply_assignment
from apps.tickets.models import Ticket

from .assignment_rules import pick_agent, resolve_rule
from .models import AssignmentRule


@shared_task
def auto_assign_ticket(ticket_id: int) -> None:
    """Applies the matching `AssignmentRule` to a newly created ticket, if
    one exists and its candidate pool is non-empty. A no-op (not an
    error) in every case where nothing should happen: the ticket was
    deleted before this ran, no rule matches, or no eligible agent exists.
    Fired from `TicketViewSet.perform_create`. See Story 29
    `## Prerequisites`.
    """
    try:
        ticket = Ticket.objects.select_related("category", "assigned_agent").get(pk=ticket_id)
    except Ticket.DoesNotExist:
        return

    rule = resolve_rule(ticket)
    if rule is None:
        return

    agent = pick_agent(rule)
    if agent is None:
        return

    changed = apply_assignment(ticket, agent, actor=None)
    if changed and rule.strategy == AssignmentRule.Strategy.ROUND_ROBIN:
        rule.last_assigned_agent = agent
        rule.save(update_fields=["last_assigned_agent", "updated_at"])
