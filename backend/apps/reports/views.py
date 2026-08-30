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

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission

from .aggregation import parse_bucket, parse_date_range
from .export import csv_response

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
