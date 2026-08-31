"""Agent-specific report queries — RPT-3.

`aggregation.py` knows nothing about a ticket, an agent, or feedback;
this module is where that domain knowledge lives, the same split
`apps/reports/tickets.py` (RPT-1) and `apps/reports/sla.py` (RPT-2)
already established.

Computes all three metrics — handled count, average resolution minutes,
CSAT ("% satisfied") — from ONE bulk-annotated Ticket queryset, the same
Subquery technique `with_origin_channel` (RPT-1) and `_annotated_tickets`
(RPT-2) already use. 4 queries total regardless of ticket/agent count:
one annotated `.values()` query, one bulk `User` name lookup for the
(at most 15) ranked agents — never one query per agent.
"""

from django.db.models import OuterRef, Subquery
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.tickets.models import Feedback, Ticket, TicketActivity

HANDLED = "handled"
RESOLUTION = "resolution"
CSAT = "csat"
METRICS = (HANDLED, RESOLUTION, CSAT)

# CONVENTIONS.md § 25 line 1633: "≤15 agents before switching to a
# paginated table" — RPT-3's own chart-type guidance.
MAX_AGENTS = 15


def parse_metric(query_params) -> str:
    """`?metric=` as one of METRICS. REQUIRED — there is no sensible
    default axis, the same reasoning `apps.reports.tickets.parse_dimension`
    already documents for `?dimension=` (required=True branch).
    """
    raw = query_params.get("metric")
    if raw not in METRICS:
        valid = ", ".join(METRICS)
        raise ValidationError({"metric": [_("Must be one of: %(valid)s.") % {"valid": valid}]})
    return raw


def _annotated_tickets(start, end):
    """Every ticket created in [start, end) that HAS an assigned agent,
    annotated with its earliest resolved/closed activity time and its
    linked feedback rating (if any) — the two facts every metric needs,
    fetched in ONE query via two `Subquery` annotations, not N+1.
    """
    resolved_activity = (
        TicketActivity.objects.filter(
            ticket=OuterRef("pk"),
            kind=TicketActivity.Kind.STATUS_CHANGED,
            to_value__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED],
        )
        .order_by("created_at")
        .values("created_at")[:1]
    )
    feedback_rating = Feedback.objects.filter(ticket=OuterRef("pk")).values("rating")[:1]
    return (
        Ticket.objects.filter(
            created_at__gte=start, created_at__lt=end, assigned_agent_id__isnull=False
        )
        .annotate(
            resolved_at=Subquery(resolved_activity),
            feedback_rating=Subquery(feedback_rating),
        )
        .values("id", "created_at", "assigned_agent_id", "resolved_at", "feedback_rating")
    )


def agent_performance(start, end, metric: str) -> list[dict]:
    """Up to MAX_AGENTS agents, ranked DESCENDING by `metric`
    (CONVENTIONS.md § 25 line 1630 — the same direction every `BarChart`
    consumer uses; for `resolution`, descending surfaces the SLOWEST
    agents first, a deliberate oversight-report framing, see Story 58
    `## Prerequisites`).

    Returns `[{"key": "42", "label": "ziadhosny@azm.com", "value": 1}, ...]`
    — `ChartCategory`'s own shape, so the frontend needs no client-side
    label resolution (unlike RPT-1's ticket dimensions, an agent's name
    is not a frontend-translatable enum).

    An agent absent from the metric's underlying data (no resolved
    ticket, no feedback) is OMITTED, never shown at a false zero — the
    same "no false data point" rule § 27 point 10 established for
    averages, extended here to counts and rates that simply have none.
    """
    handled: dict[int, int] = {}
    resolution_sum: dict[int, float] = {}
    resolution_count: dict[int, int] = {}
    csat_satisfied: dict[int, int] = {}
    csat_total: dict[int, int] = {}

    for row in _annotated_tickets(start, end):
        agent_id = row["assigned_agent_id"]
        handled[agent_id] = handled.get(agent_id, 0) + 1
        if row["resolved_at"] is not None:
            minutes = (row["resolved_at"] - row["created_at"]).total_seconds() / 60
            resolution_sum[agent_id] = resolution_sum.get(agent_id, 0) + minutes
            resolution_count[agent_id] = resolution_count.get(agent_id, 0) + 1
        if row["feedback_rating"] is not None:
            csat_total[agent_id] = csat_total.get(agent_id, 0) + 1
            if row["feedback_rating"] == Feedback.Rating.SATISFIED:
                csat_satisfied[agent_id] = csat_satisfied.get(agent_id, 0) + 1

    if metric == HANDLED:
        values = handled
    elif metric == RESOLUTION:
        values = {
            agent_id: round(resolution_sum[agent_id] / resolution_count[agent_id], 1)
            for agent_id in resolution_count
        }
    else:
        values = {
            agent_id: round(csat_satisfied.get(agent_id, 0) / csat_total[agent_id], 3)
            for agent_id in csat_total
        }

    ranked = sorted(values.items(), key=lambda item: item[1], reverse=True)[:MAX_AGENTS]
    agent_ids = [agent_id for agent_id, _value in ranked]
    names = {user.id: user.get_full_name() for user in User.objects.filter(pk__in=agent_ids)}
    return [
        {"key": str(agent_id), "label": names[agent_id], "value": value}
        for agent_id, value in ranked
    ]
