"""`BaseReportView` — the one HTTP shape every RPT-1..RPT-5 endpoint takes.

Subclass it, declare `permission_map` and `csv_columns`, implement
`get_report`. The base handles date-range/bucket parsing, the JSON
response, and the `?export=csv` branch, so five reports cannot disagree
about any of them.

Declares NO `permission_map` of its own: per `HasPermission`'s
grant-on-omission rule (`apps/core/permissions.py:80-90`), a subclass
shipping without one is authenticated-only, not closed — every subclass
MUST declare its own, exactly as `CustomerScopedModelViewSet`
(apps/core/views.py:34-55) already documents for its own subclasses.
"""

from django.utils.translation import gettext_lazy as _
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions
from apps.tickets.models import Feedback, Ticket

from .agents import agent_performance, parse_metric
from .aggregation import bucketed_counts, grouped_counts, parse_bucket, parse_date_range
from .dashboard import dashboard_kpis
from .export import csv_response
from .sla import sla_breach_rate, sla_trend
from .tickets import (
    DIMENSION_FIELDS,
    DIRECT_CHANNEL,
    parse_dimension,
    scoped_tickets,
    with_origin_channel,
)

# NOT "format". DRF's DefaultContentNegotiation reads `?format=` as a
# renderer override and raises Http404 when no renderer matches
# (rest_framework/negotiation.py:41-45, 80-89) — and it runs in
# `APIView.initial()` BEFORE `check_permissions` (rest_framework/views.py:
# 404-420), so `?format=csv` would 404 before this class ever saw the
# request. This project registers exactly one renderer, format "json"
# (config/settings/base.py:229). Verified; see Story 55 `## Prerequisites`.
EXPORT_PARAM = "export"
EXPORT_CSV = "csv"


class BaseReportView(APIView):
    permission_classes = [IsAuthenticated, HasPermission]

    # Ordered `(row key, header text)` pairs for the CSV. Subclasses
    # translate their headers with gettext at class level.
    csv_columns: tuple[tuple[str, str], ...] = ()
    # Base name of the exported file, no extension.
    csv_filename: str = "report"

    def get_report(self, request, *, start, end, bucket) -> list[dict]:
        raise NotImplementedError

    def get(self, request):
        start, end = parse_date_range(request.query_params)
        bucket = parse_bucket(request.query_params)
        rows = self.get_report(request, start=start, end=end, bucket=bucket)
        if request.query_params.get(EXPORT_PARAM) == EXPORT_CSV:
            return csv_response(rows, columns=self.csv_columns, filename=self.csv_filename)
        return Response(rows)


class TicketVolumeReportView(BaseReportView):
    """Tickets created per time bucket — RPT-1's trend half
    (CONVENTIONS.md § 25 row 1, Line Chart). `?series=` splits it into one
    line per status/priority/category/channel; absent, one total line.

    Counts by `created_at`: "volume" is tickets RAISED in the period. A
    report of tickets *resolved* in a period is a different question and a
    different date field — RPT-2's, not this one's.
    """

    permission_map = {"get": Permissions.REPORTS_VIEW}
    csv_columns = (
        ("bucket", _("Period")),
        ("series", _("Series")),
        ("value", _("Tickets")),
    )
    csv_filename = "ticket-volume"

    def get_report(self, request, *, start, end, bucket):
        series = parse_dimension(request.query_params, "series", required=False)
        queryset = scoped_tickets(request.query_params)
        series_field = None
        if series is not None:
            if series == "channel":
                queryset = with_origin_channel(queryset)
            series_field = DIMENSION_FIELDS[series]
        rows = bucketed_counts(
            queryset,
            date_field="created_at",
            start=start,
            end=end,
            bucket=bucket,
            series_field=series_field,
            null_label=DIRECT_CHANNEL if series == "channel" else str(_("Uncategorized")),
        )
        if series_field is None:
            # `bucketed_counts` only sets `item["series"]` when a
            # `series_field` is given (`aggregation.py`) — with no `?series=`
            # requested, every row's "Series" column in the CSV export was
            # blank, disagreeing with the on-screen chart's own label for
            # this exact case (`t('volume.allTickets')`, "All tickets") on
            # `TicketReportsPage.tsx`.
            for row in rows:
                row["series"] = str(_("All tickets"))
        return rows


class TicketBreakdownReportView(BaseReportView):
    """Tickets per distinct value of one dimension, descending — RPT-1's
    category half (CONVENTIONS.md § 25 row 2, Bar Chart). `?dimension=` is
    REQUIRED: there is no sensible default axis, and guessing one would
    silently answer a question the caller did not ask.

    Honours `?from=`/`?to=` (inherited) but ignores `?bucket=` — a
    breakdown has no time axis. `BaseReportView.get` still parses `bucket`,
    so an invalid one is still a 400; that is consistent, not a bug.
    """

    permission_map = {"get": Permissions.REPORTS_VIEW}
    csv_columns = (("key", _("Value")), ("value", _("Tickets")))
    csv_filename = "ticket-breakdown"

    def get_report(self, request, *, start, end, bucket):
        dimension = parse_dimension(request.query_params, "dimension", required=True)
        queryset = scoped_tickets(
            request.query_params,
            Ticket.objects.filter(created_at__gte=start, created_at__lt=end),
        )
        if dimension == "channel":
            queryset = with_origin_channel(queryset)
        return grouped_counts(
            queryset,
            field=DIMENSION_FIELDS[dimension],
            include_null=True,
            null_label=DIRECT_CHANNEL if dimension == "channel" else str(_("Uncategorized")),
        )


class SlaTrendReportView(BaseReportView):
    """Average response/resolution time per bucket — RPT-2's trend half
    (CONVENTIONS.md § 25 row 3, Line Chart — same shape as RPT-1's volume
    trend). No `?series=`/`?dimension=` param: response and resolution are
    always both returned, not a user-selectable axis.
    """

    permission_map = {"get": Permissions.REPORTS_VIEW}
    csv_columns = (
        ("bucket", _("Period")),
        ("series", _("Dimension")),
        ("value", _("Average minutes")),
    )
    csv_filename = "sla-trend"

    def get_report(self, request, *, start, end, bucket):
        return sla_trend(start, end, bucket)


class SlaBreachRateReportView(BaseReportView):
    """Breach rate and underlying met/breached/pending counts for
    response and resolution — RPT-2's breach-rate half (CONVENTIONS.md
    § 25 row 4, Gauge Chart). Ignores `?bucket=` — a rate over the whole
    range has no time axis, the same `?bucket=`-parsed-but-unused
    consistency `TicketBreakdownReportView` already establishes
    (`views.py:102-104`).
    """

    permission_map = {"get": Permissions.REPORTS_VIEW}
    csv_columns = (
        ("key", _("Dimension")),
        ("met", _("Met")),
        ("breached", _("Breached")),
        ("pending", _("Pending")),
        ("rate", _("Breach rate")),
    )
    csv_filename = "sla-breach-rate"

    def get_report(self, request, *, start, end, bucket):
        return sla_breach_rate(start, end)


class AgentPerformanceReportView(BaseReportView):
    """Up to 15 agents, ranked by one metric — RPT-3 (CONVENTIONS.md § 25
    row 5, Horizontal Bar Chart, "same as RPT-1's category row"). `?metric=`
    is REQUIRED: `handled`, `resolution`, or `csat` — no sensible default,
    the same reasoning `TicketBreakdownReportView`'s `?dimension=` uses.

    Ignores `?bucket=` — a ranked snapshot has no time axis, the same
    consistency `SlaBreachRateReportView` already establishes.
    """

    permission_map = {"get": Permissions.REPORTS_VIEW}
    csv_columns = (("key", _("Agent ID")), ("label", _("Agent")), ("value", _("Value")))
    csv_filename = "agent-performance"

    def get_report(self, request, *, start, end, bucket):
        metric = parse_metric(request.query_params)
        self.csv_filename = f"agent-performance-{metric}"
        return agent_performance(start, end, metric)


class CsatTrendReportView(BaseReportView):
    """Feedback count per time bucket, one line per rating — RPT-4's
    trend half (CONVENTIONS.md § 25 row 6, Line Chart — same shape as
    RPT-1's volume trend and RPT-2's SLA trend). No `?series=` param:
    `rating` is always the series, never a user-selectable dimension.

    Calls `bucketed_counts` directly — `Feedback.rating` needs no join or
    annotation the way RPT-1's channel or RPT-3's agent name did, so no
    `apps/reports/csat.py` module exists. See Story 59 `## Prerequisites`.
    """

    permission_map = {"get": Permissions.REPORTS_VIEW}
    csv_columns = (
        ("bucket", _("Period")),
        ("series", _("Rating")),
        ("value", _("Feedback count")),
    )
    csv_filename = "csat-trend"

    def get_report(self, request, *, start, end, bucket):
        return bucketed_counts(
            Feedback.objects.all(),
            date_field="created_at",
            start=start,
            end=end,
            bucket=bucket,
            series_field="rating",
        )


class CsatBreakdownReportView(BaseReportView):
    """Feedback count per rating over the whole range, descending —
    RPT-4's breakdown half (CONVENTIONS.md § 25 row 6, Waffle Chart).
    Ignores `?bucket=` — a whole-range breakdown has no time axis, the
    same consistency `TicketBreakdownReportView`/`SlaBreachRateReportView`
    already establish.
    """

    permission_map = {"get": Permissions.REPORTS_VIEW}
    csv_columns = (("key", _("Rating")), ("value", _("Feedback count")))
    csv_filename = "csat-breakdown"

    def get_report(self, request, *, start, end, bucket):
        queryset = Feedback.objects.filter(created_at__gte=start, created_at__lt=end)
        return grouped_counts(queryset, field="rating")


class DashboardKpiReportView(BaseReportView):
    """Four combined KPIs, one snapshot — RPT-5, EPIC 11's final report
    (CONVENTIONS.md § 25 row 7, Bullet Chart grid). Ignores `?bucket=` —
    a whole-period snapshot has no time axis, the same consistency
    `SlaBreachRateReportView`/`AgentPerformanceReportView` already
    establish. Every row's `value` is a 0-1 badness fraction, reused by
    the frontend directly as `GaugeChart` input with NO chart code
    change — see Story 60 `## Prerequisites`.
    """

    permission_map = {"get": Permissions.REPORTS_VIEW}
    csv_columns = (("key", _("KPI")), ("value", _("Value")))
    csv_filename = "dashboard-kpis"

    def get_report(self, request, *, start, end, bucket):
        return dashboard_kpis(start, end)
