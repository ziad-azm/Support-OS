"""Combined KPI computation — RPT-5, EPIC 11's final story.

Combines three already-existing data sources into one flat KPI list:
`Ticket` (open/unassigned counts), `apps.reports.sla.sla_breach_rate`
(pooled into one scalar), and `apps.reports.aggregation.grouped_counts`
against `Feedback` (the exact call `CsatBreakdownReportView` already
makes). No new query shape is introduced — this module is glue, not a
new aggregation technique.

Every KPI is a 0-1 "badness" fraction (0 = best, 1 = worst) so the
frontend can pass all four straight into `GaugeChart` UNCHANGED — see
Story 60 `## Prerequisites` for why this is a hard constraint, not a
convenience.
"""

from apps.tickets.models import Feedback, Ticket

from .aggregation import grouped_counts
from .sla import sla_breach_rate

OPEN_RATE = "open_rate"
SLA_HEALTH = "sla_health"
CSAT_RISK = "csat_risk"
AGENT_LOAD = "agent_load"

# Fixed order, matching the intake's own KPI list ("Open tickets, SLA
# health, CSAT, agent load").
DASHBOARD_KPIS = (OPEN_RATE, SLA_HEALTH, CSAT_RISK, AGENT_LOAD)


def _safe_ratio(numerator: int, denominator: int) -> float | None:
    """`None` when there is nothing to rate yet — the same "no false
    data point" rule every prior RPT-* story's own aggregation follows.
    """
    if denominator == 0:
        return None
    return round(numerator / denominator, 3)


def dashboard_kpis(start, end) -> list[dict]:
    """Returns `[{"key": "open_rate", "value": 0.769}, ...]`, one row per
    `DASHBOARD_KPIS` entry, `value` possibly `None`.
    """
    all_tickets = Ticket.objects.filter(created_at__gte=start, created_at__lt=end)
    # "Open" = not resolved/closed — the SAME idiom
    # `apps/sla/assignment_rules.py::_pick_least_loaded` and
    # `apps/sla/tasks.py` already use, not a new inclusion list. See
    # Story 60 `## Prerequisites`.
    open_tickets = all_tickets.exclude(status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED])
    total = all_tickets.count()
    open_count = open_tickets.count()
    unassigned_open = open_tickets.filter(assigned_agent_id__isnull=True).count()

    breach_rows = sla_breach_rate(start, end)
    breached = sum(row["breached"] for row in breach_rows)
    evaluated = sum(row["met"] + row["breached"] for row in breach_rows)

    feedback_counts = {
        row["key"]: row["value"]
        for row in grouped_counts(
            Feedback.objects.filter(created_at__gte=start, created_at__lt=end),
            field="rating",
        )
    }
    feedback_total = sum(feedback_counts.values())
    dissatisfied = feedback_counts.get("neutral", 0) + feedback_counts.get("dissatisfied", 0)

    values = {
        OPEN_RATE: _safe_ratio(open_count, total),
        SLA_HEALTH: _safe_ratio(breached, evaluated),
        CSAT_RISK: _safe_ratio(dissatisfied, feedback_total),
        AGENT_LOAD: _safe_ratio(unassigned_open, open_count),
    }
    return [{"key": key, "value": values[key]} for key in DASHBOARD_KPIS]
