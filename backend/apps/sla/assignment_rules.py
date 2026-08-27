"""Assignment-rule resolution and candidate selection — SLA-2.

Lives in `apps.sla`, alongside `apps/sla/policy.py` (Story 28) — the same
placement reasoning, and the same verified-safe reverse-direction import
into `apps.tickets.models`/`assignment.py` (neither imports back from
`apps.sla`, so no cycle). Named `assignment_rules.py`, not `assignment.py`,
to avoid colliding with `apps/tickets/assignment.py`.
"""

from apps.tickets.assignment import assignable_agents
from apps.tickets.models import Ticket

from .models import AssignmentRule


def resolve_rule(ticket: Ticket) -> AssignmentRule | None:
    """The most specific enabled rule for this ticket: an exact category
    match if the ticket has a category and an enabled rule exists for it,
    else the category-agnostic default (category=None). `None` if neither
    exists — auto-assignment is opt-in per category, not guaranteed.
    """
    if ticket.category_id is not None:
        specific = AssignmentRule.objects.filter(
            category_id=ticket.category_id, enabled=True
        ).first()
        if specific is not None:
            return specific
    return AssignmentRule.objects.filter(category__isnull=True, enabled=True).first()


def _pick_round_robin(candidates: list, last_assigned) -> object:
    """The next agent after `last_assigned` in a deterministic (id-order)
    rotation, wrapping around. Restarts from the top if `last_assigned` is
    `None` or has fallen out of the candidate pool (removed from the
    rule's `agents`, or no longer `assignable_agents()`).
    """
    ordered = sorted(candidates, key=lambda user: user.id)
    if last_assigned is None:
        return ordered[0]
    ids = [user.id for user in ordered]
    try:
        index = ids.index(last_assigned.id)
    except ValueError:
        return ordered[0]
    return ordered[(index + 1) % len(ordered)]


def _pick_least_loaded(candidates: list) -> object:
    """The candidate with the fewest currently-open (not resolved/closed)
    assigned tickets. Ties break on user id, so the result is
    deterministic rather than dependent on query/iteration order.
    """
    open_counts = {
        user.id: Ticket.objects.filter(assigned_agent=user)
        .exclude(status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED])
        .count()
        for user in candidates
    }
    return min(candidates, key=lambda user: (open_counts[user.id], user.id))


def pick_agent(rule: AssignmentRule):
    """The agent this rule would assign to right now, or `None` if its
    (possibly empty, after intersecting with `assignable_agents()`)
    candidate pool has nobody in it. Never returns someone without
    `tickets.manage` — see Story 29 `## Prerequisites`.
    """
    candidates_qs = assignable_agents()
    configured_ids = list(rule.agents.values_list("id", flat=True))
    if configured_ids:
        candidates_qs = candidates_qs.filter(id__in=configured_ids)
    candidates = list(candidates_qs)
    if not candidates:
        return None
    if rule.strategy == AssignmentRule.Strategy.ROUND_ROBIN:
        return _pick_round_robin(candidates, rule.last_assigned_agent)
    return _pick_least_loaded(candidates)
