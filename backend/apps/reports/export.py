"""CSV export — RPT-0's other 🔑 half (intake: "CSV/export").

Turns any report result (a list of flat dicts, which is what every
`aggregation.py` function returns) into a downloadable CSV. Shared by
RPT-1..RPT-5 through `BaseReportView`; nothing here is report-specific.

Returns a plain Django `HttpResponse`, NOT a DRF `Response` — that is what
bypasses `EnvelopeJSONRenderer` (`apps/core/renderers.py`), which would
otherwise JSON-wrap the CSV text. Verified against DRF's own
`APIView.finalize_response`, which attaches a renderer only to a
`rest_framework.response.Response` (rest_framework/views.py:434); the same
mechanism `AttachmentViewSet.download` (apps/customers/views.py:182) has
used since Story 21. A `CsvRenderer` alongside `PlainTextRenderer` would
also work and is deliberately NOT added — one escape hatch per problem.
"""

import csv
import io

from django.http import HttpResponse

# Excel on Windows reads a BOM-less UTF-8 CSV as the system codepage, which
# turns every Arabic label (this app is bilingual — CONVENTIONS.md § 18)
# into mojibake. The BOM is what makes a double-click open correctly; it is
# invisible to every other consumer, including pandas and LibreOffice.
UTF8_BOM = "﻿"


def rows_to_csv(rows, *, columns) -> str:
    """`columns` is an ordered sequence of `(key, header)` pairs: the key
    read from each row dict, and the already-translated header text written
    to the file. Ordered, and explicit, because dict order is not a
    contract and a report's CSV column order is user-visible.

    A key missing from a row writes an empty cell, not a KeyError — a
    partially-populated multi-series row is a normal shape here.
    """
    buffer = io.StringIO()
    buffer.write(UTF8_BOM)
    # RFC 4180's own line ending, and what Excel expects — csv.writer's
    # default is os.linesep, which is wrong on every platform this project
    # deploys to or develops on.
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow([header for _key, header in columns])
    for row in rows:
        writer.writerow([row.get(key, "") for key, _header in columns])
    return buffer.getvalue()


def csv_response(rows, *, columns, filename: str) -> HttpResponse:
    """`rows_to_csv` wrapped in a downloadable response.

    `filename` is the base name WITHOUT extension; ".csv" is appended here
    so no call site can forget it or disagree about it.
    """
    content = rows_to_csv(rows, columns=columns)
    response = HttpResponse(content, content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
    return response
