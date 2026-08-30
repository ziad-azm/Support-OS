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
from apps.tickets.models import Ticket

from .aggregation import bucketed_counts, grouped_counts, parse_bucket, parse_date_range
from .export import csv_response
from .tickets import DIMENSION_FIELDS, DIRECT_CHANNEL, parse_dimension, with_origin_channel

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
        queryset = Ticket.objects.all()
        series_field = None
        if series is not None:
            if series == "channel":
                queryset = with_origin_channel(queryset)
            series_field = DIMENSION_FIELDS[series]
        return bucketed_counts(
            queryset,
            date_field="created_at",
            start=start,
            end=end,
            bucket=bucket,
            series_field=series_field,
            null_label=DIRECT_CHANNEL if series == "channel" else str(_("Uncategorized")),
        )


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
        queryset = Ticket.objects.filter(created_at__gte=start, created_at__lt=end)
        if dimension == "channel":
            queryset = with_origin_channel(queryset)
        return grouped_counts(
            queryset,
            field=DIMENSION_FIELDS[dimension],
            include_null=True,
            null_label=DIRECT_CHANNEL if dimension == "channel" else str(_("Uncategorized")),
        )
