"""Background tasks — SLA-2. The project's first real `@shared_task`
beyond `config.celery.debug_task` (Story 27) — no further Celery wiring
is needed; `app.autodiscover_tasks()` (`config/celery.py`) finds this
module because it is named `tasks.py` inside an installed app.
"""

from celery import shared_task
from django.utils import timezone

from apps.tickets.assignment import apply_assignment
from apps.tickets.escalation import apply_escalation
from apps.tickets.models import Ticket

from .assignment_rules import pick_agent, resolve_rule
from .escalation_rules import is_at_risk, is_idle, max_enabled_threshold
from .models import AssignmentRule, EscalationRule


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


@shared_task
def evaluate_escalations() -> None:
    """Escalates every open (not resolved/closed), not-already-escalated
    ticket that is at-risk of an SLA breach or idle, per any enabled
    `EscalationRule`. Runs on `django-celery-beat`'s own schedule, seeded
    by this app's `0004_seed_escalation_schedule` data migration so the
    job is live the moment this story ships. One-directional: this task
    only escalates, never de-escalates — see Story 30 `## Prerequisites`.
    A run in which nothing is configured, or nothing matches, is a normal
    no-op, not an error.
    """
    at_risk_minutes = max_enabled_threshold(EscalationRule.Kind.AT_RISK)
    idle_minutes = max_enabled_threshold(EscalationRule.Kind.IDLE)
    if at_risk_minutes is None and idle_minutes is None:
        return

    now = timezone.now()
    candidates = Ticket.objects.filter(escalated=False).exclude(
        status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED]
    )
    for ticket in candidates:
        if is_at_risk(ticket, at_risk_minutes, now) or is_idle(ticket, idle_minutes, now):
            apply_escalation(ticket, True)
