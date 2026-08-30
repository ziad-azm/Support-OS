# Story 55 — Reporting Foundation (Story: SUPPORTOS-76)

## Prerequisites

- **`apps.reports` already exists as an empty `startapp` scaffold**, registered in `LOCAL_APPS` (`backend/config/settings/base.py:67`) since EPIC 0. `apps/reports/models.py`, `views.py`, and `admin.py` are all bare (`# Create your models here.`), there is no `urls.py`, and `apps/reports/migrations/` holds only `__init__.py`. `backend/apps/README.md:75` already assigns it "Aggregations, dashboards, exports" — this story is the first code in it. It is **not** included in `config/api_urls.py`, and this story does not add it (see below).
- **`DSN-3` (Story 38) already recorded this story's chart specification.** `CONVENTIONS.md` § 25 "Chart-type guidance (for `RPT-0`)" (lines 1619-1652) is a seven-row table naming the chart type, library options, and color guidance for each `RPT-1`…`RPT-5` data shape, plus an accessibility floor. Its own preamble says *"`RPT-0` … implements its shared chart wrapper against this table; no chart library, component, or token exists yet."* **Read that table before writing any frontend code in this story** — it is the design input, not something to re-derive.
- **Every one of this project's "shared computation" modules is a plain function module, not a view.** `apps/knowledge_base/search.py::search_knowledge_base`, `apps/customers/timeline.py::build_timeline`, `apps/tickets/history.py::build_history`, `apps/sla/policy.py::compute_sla_status`, `apps/tickets/assignment.py::assignable_agents`, `apps/tickets/status.py::is_valid_transition`. `search.py`'s own docstring names the shape: *"the app that owns the question implements `build_X`, the view is a thin wrapper."* This story's `aggregation.py`/`export.py` are the seventh and eighth instances, not a new pattern.
- **This story declares no permission constant and creates no `apps/reports/urls.py`.** Two explicit project rules force this, and they agree:
  - `apps/core/permissions.py:5-7` — *"Code is what enforces a permission, so a permission that no view declares must not be grantable"*, and lines 22-24, *"A feature story adds its own constants here in the same change as the viewset that declares them."* `RPT-0` ships no concrete report endpoint, so `Permissions.REPORTS_VIEW` belongs to `RPT-1`, together with the first `BaseReportView` subclass and its grant migration.
  - `backend/apps/README.md:52-56` — *"An app gets a `serializers.py` when it has a serializer and a `urls.py` when it has a route. Do not pre-create empty modules — an empty file is a promise the codebase has not made yet."*

  This mirrors Story 27 (`SLA-0`) exactly, which shipped the Celery foundation with **no** `apps.sla` model, view, or endpoint (`27-story-background-jobs-foundation-SUPPORTOS-49.md` `## Prerequisites`, bullet 2). Backend verification here is `manage.py shell` against real data, the same way that story verified itself by dispatching `debug_task`.
- **Verified DRF trap — the export query parameter must NOT be named `format`.** DRF's `DefaultContentNegotiation.select_renderer` reads `?format=` as a renderer override (`.venv/Lib/site-packages/rest_framework/negotiation.py:41-45`), and `filter_renderers` raises **`Http404`** when no registered renderer matches (lines 80-89). This project registers exactly one renderer, `EnvelopeJSONRenderer` (`config/settings/base.py:229-231`), whose `format` is `"json"` (inherited from `JSONRenderer`). Worse, `APIView.initial()` runs `perform_content_negotiation` at line 411 **before** `check_permissions` at line 420 (`.venv/Lib/site-packages/rest_framework/views.py:404-420`) — so `GET /api/reports/anything/?format=csv` would 404 before the view body or the permission check ever ran, with no way for a subclass to intervene. **This story uses `?export=csv`**, a name DRF does not reserve.
- **Returning a plain `HttpResponse` from a DRF view bypasses `EnvelopeJSONRenderer` — verified, and already done once in this codebase.** `APIView.finalize_response` (`.venv/Lib/site-packages/rest_framework/views.py:423-451`) asserts only `isinstance(response, HttpResponseBase)` and attaches a renderer **only** when the object is a DRF `Response` (line 434). `apps/customers/views.py:182-193` (`AttachmentViewSet.download`, Story 21) already returns a `FileResponse` on this basis, with a docstring saying so. A CSV `HttpResponse` is the same mechanism — this story does **not** need a `CsvRenderer` alongside `PlainTextRenderer` (`apps/core/renderers.py:27-49`).
- **No chart library is added, and none of `--chart-1`…`--chart-5` changes.** See `## Product rules` for the full reasoning; the short form is that `CONVENTIONS.md` § 25's own table names **Custom SVG** and **Custom CSS Grid** as sanctioned options, and the two chart types with the most consumers among `RPT-2`/`RPT-4`/`RPT-5` (Bullet and Waffle) have no mainstream React library implementation anyway. `frontend/src/index.css` is **not touched** by this story.

---

## Story Goal

One reporting pattern that `RPT-1`…`RPT-5` all build on, in three pieces:

1. **Backend aggregation helpers** — `apps/reports/aggregation.py`: date-range and bucket parsing from query params, time-bucketed counting (`day`/`week`/`month`) with **gap-filling** so an empty day renders as `0` rather than vanishing from the series, and descending group-by-field counting.
2. **Backend CSV export** — `apps/reports/export.py`: turn any list-of-dicts report result into a UTF-8 CSV `HttpResponse` (BOM-prefixed, so Arabic labels open correctly in Excel), plus `apps/reports/views.py::BaseReportView`, the shared `APIView` base that gives every future report endpoint identical `?export=csv` behaviour for free.
3. **Frontend chart primitives** — `frontend/src/shared/ui/chart/`: `ChartFrame` (the wrapper: title, loading/error/empty states, and the mandatory accessible data-table fallback), plus `LineChart` and `BarChart` built as plain SVG against `CONVENTIONS.md` § 25's specification. Plus `shared/lib/download.ts`, the blob-save helper promoted out of `features/customers/api/downloadAttachment.ts` so a report screen can reuse it.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/reports/aggregation.py` | "shared query/aggregation helpers" (intake) — five named consumers, `RPT-1`…`RPT-5`. |
| `apps/reports/export.py` | "CSV/export" (intake). |
| `apps/reports/views.py::BaseReportView` | The `?export=csv` branch is identical for all five reports; putting it in each would be five copies of a content-negotiation trap. |
| `shared/ui/chart/` (`ChartFrame`, `LineChart`, `BarChart`, `ChartDataTable`) | "a reusable chart wrapper (reusing `UI`)" (intake). **`no-restricted-imports` (`frontend/.oxlintrc.json:8-18`) forbids one feature importing another's code**, so a Line chart built inside `features/reports/` for `RPT-1` could not be reused by `RPT-2` or `RPT-4`. `shared/ui/` is the only place these can live, and `RPT-0` is the only story that can put them there. |
| `shared/lib/download.ts` | The frontend half of "export". Promoted from `downloadAttachment.ts`, which becomes its first consumer in the same change — so it ships with a real consumer, satisfying `CONVENTIONS.md` § 8's "default to keeping code in its feature until a second consumer actually appears". |

**Not here, and why:**

- **No report endpoint, no `apps/reports/urls.py`, no `config/api_urls.py` line, no `Permissions.REPORTS_VIEW`, no grant migration.** See `## Prerequisites` — two explicit project rules forbid all five, and `RPT-1` adds them together with the first real report.
- **No `features/reports/` frontend folder, no route, no sidebar link, no `reports` i18n namespace.** This story ships no screen. Its frontend surface is `shared/ui/chart/`, `shared/lib/`, and a `chart` block added to the existing `common` namespace (`shared/i18n/locales/{en,ar}/common.json`) — the namespace `shared/ui/` components already use (`DataTable.tsx:67` reads `t('table.noResults')` from it).
- **No Bullet/Gauge chart and no Waffle chart.** `CONVENTIONS.md` § 25 assigns Bullet/Gauge to `RPT-2`/`RPT-5` and Waffle to `RPT-4`. Each has exactly one first consumer, each needs chart-specific colors § 25 explicitly says are "**not** `--chart-1..5` slots" and leaves for "`RPT-0` to name as its own tokens when it exists" — a token whose only consumer is one unwritten story is a token designed against nothing. They are built **inside `ChartFrame`** by the stories that need them, which is what makes `ChartFrame` the wrapper the intake asked for. Line and Bar are different: three and two named consumers respectively, structurally unable to live anywhere but `shared/`.
- **No `frontend/src/index.css` change.** `--chart-1`…`--chart-5` (lines 48-52 light, 103-107 dark, mapped to Tailwind utilities at lines 143-147) are already the five-hue qualitative palette § 25 line 1644 resolved to keep.
- **No `Ticket`/`Message`/`Feedback` model change, no new migration of any kind.** Every helper here reads existing rows.
- **No caching, no materialized view, no `Celery` pre-aggregation job.** `apps/knowledge_base/search.py:12-17` already set this project's precedent ("compute over cache when the read is cheap enough to redo") and named the forward note if it ever changes.

---

## Context — Read These Files First

1. `.squad/stories/reports-analytics/SUPPORTOS-76/intake.md` — one task, **no acceptance criteria, no attachments** (`attachments/` exists and is empty).
2. `SupportOs backlog.MD` lines 628-663 — `EPIC 11 — Reports & Analytics`; `RPT-0`'s own `🔑` (line 637) and the five consumer stories, whose data shapes drive every helper signature below. Line 532 (`DSN`'s own task) records that the chart guidance was captured *for* this story.
3. **`CONVENTIONS.md` lines 1619-1652** — § 25's "Chart-type guidance (for `RPT-0`)". The seven-row table (chart type, library options, color guidance per report) and the "Accessibility floor, every row" paragraph (lines 1638-1642): *a visible data table or text summary fallback; color always paired with a text label, distinct line style, or shape — never color alone; keyboard focus reveals the same detail hover does.* This is the specification for tasks 6-9.
4. `backend/apps/README.md` lines 13-27 (the "where new code goes" list), lines 52-60 ("Files are created on demand", and the one-`include()`-line rule), line 75 (`reports` owns "Aggregations, dashboards, exports").
5. `backend/apps/knowledge_base/search.py` (125 lines) — read end to end. The exact module shape task 2 follows: a docstring naming the future callers, module-level constants, small private helpers (`_combined_query`), one public function with keyword-only options, and a closing comment explaining the non-obvious algorithmic step (lines 120-124).
6. `backend/apps/knowledge_base/views.py:94-111` (`KnowledgeBaseSearchView`) — the plain-`APIView` precedent task 4 extends: `permission_classes = [IsAuthenticated, HasPermission]`, `permission_map` keyed by **lowercased HTTP method** rather than DRF `action`, query-param validation raising DRF `ValidationError` with a translated message, `return Response(<plain payload>)`.
7. `backend/apps/core/permissions.py` — the `Permissions` class (lines 26-37, note there is **no** reports entry and this story adds none), `HasPermission._required_permission`'s method-key fallback (lines 131-139), and the class docstring's grant-on-omission rule (lines 80-90).
8. `backend/apps/customers/views.py:1` and `:182-193` — `from django.http import FileResponse` and `AttachmentViewSet.download`, the live proof that a non-`Response` return bypasses the envelope renderer.
9. `backend/apps/core/renderers.py` (50 lines) — `EnvelopeJSONRenderer` (why every JSON body is wrapped) and `PlainTextRenderer` (lines 27-49), the *other* way to escape the envelope. Task 3 uses neither: read this to understand why a `CsvRenderer` is not needed.
10. `backend/apps/tickets/models.py` — `Ticket.Status`/`Ticket.Priority` (lines 34-44), `category` (65-72), `assigned_agent` (79-86), `status`/`priority` (87-92), `escalated`/`escalated_at` (99-102); `TicketActivity.Kind` (123-125) and its `from_value`/`to_value` (154-155); `Feedback.Rating` (179-186). These are the fields `RPT-1`…`RPT-4` aggregate — task 2's helpers must work against all of them without naming any.
11. `backend/apps/communications/models.py:16-38` — `Message.Direction` (inbound/outbound) and `Message.Channel` (`email`/`whatsapp`/`chat`/`sms`/`web_form`), the "by channel" dimension in `RPT-1`.
12. `backend/apps/sla/policy.py` (119 lines) — `compute_sla_status` returns a **per-ticket dict computed on read**, nothing persisted. `RPT-2` aggregates over this; read it to see why task 2's helpers take a **queryset**, not a model, as their first argument.
13. `backend/config/settings/base.py` lines 148-157 (`TIME_ZONE` from `DJANGO_TIME_ZONE`, `USE_TZ = True`) — why task 2's `Trunc*` calls must be explicit about timezone, and lines 228-261 (`REST_FRAMEWORK`; note the single renderer entry that makes `?format=csv` a 404).
14. `frontend/.oxlintrc.json` lines 8-18 — the `no-restricted-imports` pattern (`@/features/*`) that forces the chart components into `shared/ui/`, and its three `overrides` exemptions (lines 24-46) — none of which apply here.
15. `frontend/src/shared/ui/data-table/DataTable.tsx` (173 lines) — read end to end. The exact component shape task 6 follows: a `query: UseQueryResult<…>` prop rather than data, explicit `isPending`/`isError`/empty/success branches rendering `Skeleton`/`ErrorState`/`Empty`, a required visually-hidden `caption` for screen readers (line 72), `aria-sort` on sortable headers (line 78), and the docstring's explanation of why it does **not** wrap `QueryBoundary` (lines 51-55).
16. `frontend/src/shared/ui/QueryBoundary.tsx` (48 lines) — the `query`/`children(data)`/`isEmpty`/`loading`/`empty` prop contract. `ChartFrame` follows this contract, not `DataTable`'s, because a chart *can* render its non-success states in a plain `<div>`.
17. `frontend/src/shared/ui/Empty.tsx` and `PageHeader.tsx` — `Empty`'s `{title, description, action, icon}` and the note that its props are a **stable contract** (`CONVENTIONS.md` § 7 / § 19).
18. `frontend/src/features/customers/api/downloadAttachment.ts` (24 lines) — read all of it. Task 10 promotes lines 12-24 verbatim into `shared/lib/download.ts` and rewrites this file to call it. Its docstring already explains *why* a plain `<a href>` cannot work (Bearer auth) and why `httpClient` is used directly rather than `api.get()` (the body is not an envelope).
19. `frontend/src/shared/lib/api/client.ts` lines 133-174 — every `api.*` helper runs `unwrap()`, which throws `invalid_envelope` on a non-envelope body (lines 102-114). This is why a CSV response must go through `httpClient` directly.
20. `frontend/src/shared/i18n/useDirection.ts` — `useDirection(): 'ltr' | 'rtl'`, subscribed to i18next. The chart components need this: an SVG `x` coordinate is not a CSS logical property and does **not** flip under `dir="rtl"`.
21. `frontend/scripts/check-rtl.mjs` lines 1-40 — the physical-CSS tripwire, and its own docstring: *"This is a tripwire, not a proof: it reads text, so a class assembled at runtime slips through."* SVG geometry is invisible to it entirely — task 8's RTL handling is verified by eye (`## Verification Steps` step 7), not by this script.
22. `frontend/src/shared/i18n/locales/en/common.json` and `ar/common.json` — the namespace `shared/ui/` components read from; task 11 adds a `chart` block to both.
23. [`../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md`](../sla-automation/27-story-background-jobs-foundation-SUPPORTOS-49.md) — the structural precedent for a 🔑 foundation story that ships infrastructure and no domain surface. Its `## Prerequisites` bullets 2 and 12, and its `## Verification Steps`, are the model for this one.
24. [`../design-intelligence-ui-ux-system/38-story-dashboard-chart-design-guidance-SUPPORTOS-70.md`](../design-intelligence-ui-ux-system/38-story-dashboard-chart-design-guidance-SUPPORTOS-70.md) — the story that wrote § 25's chart table. Read its `## Story Goal` for what it deliberately left to this story.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Shared query/aggregation helpers, reused by all reports.** | Intake, sole task | `apps/reports/aggregation.py` — five public functions, no report-specific logic. |
| **CSV/export.** | Intake, sole task | `apps/reports/export.py::csv_response`; `BaseReportView`'s `?export=csv` branch. |
| **A reusable chart wrapper, reusing `UI`.** | Intake, sole task | `shared/ui/chart/ChartFrame.tsx` — composes the existing `Card`, `Skeleton`, `ErrorState`, `Empty`, `Table` primitives; restyles none of them (`CONVENTIONS.md` § 7). |
| **Every chart carries a data-table or text-summary fallback; color is never the only signal.** | `CONVENTIONS.md` § 25 lines 1638-1642 | `ChartDataTable`, rendered by `ChartFrame` behind a toggle and always present in the accessibility tree; `LineChart` varies `stroke-dasharray` per series, `BarChart` labels every bar with its value. |
| **Multi-series lines need a distinct line style, not just a distinct hue.** | `CONVENTIONS.md` § 25 line 1629 | `LineChart`'s `SERIES_DASH` array, applied by series index alongside `--chart-N`. |
| **Category bars are always sorted descending by value.** | `CONVENTIONS.md` § 25 line 1630 | `grouped_counts()` orders `-count` server-side; `BarChart` does not re-sort. |
| **No chart library.** | § 17 ("check whether an existing one already does the job"), § 25's own "Custom SVG"/"Custom CSS Grid" library options | `frontend/package.json` gains **no** dependency. See the note below. |
| **A permission that no view declares must not be grantable.** | `apps/core/permissions.py:5-7` | No `Permissions.REPORTS_VIEW` in this story. |
| **Empty modules are not pre-created.** | `apps/README.md:52-56` | No `apps/reports/urls.py`, no `serializers.py`, no `models.py` content. |
| **The export query param is `export`, never `format`.** | This story's own verified finding (`## Prerequisites`) | `BaseReportView.get`. |

**On the no-chart-library decision, stated once so `RPT-1`…`RPT-5` do not relitigate it.** § 25's table offers Chart.js / Recharts / ApexCharts / D3.js / Custom SVG / Custom CSS Grid across its seven rows. Two of the four chart types EPIC 11 needs — **Bullet** (`RPT-2`, `RPT-5`) and **Waffle** (`RPT-4`) — have no mainstream React library implementation, and § 25 lists only D3/Plotly/Custom SVG/Custom CSS Grid for them. So no single library covers EPIC 11, and adopting one would mean two rendering paradigms plus a library whose output must still be overridden to satisfy § 25's accessibility floor (a data-table fallback, `aria` wiring, and RTL axis flipping are custom work under any library). Line and Bar in plain SVG are each well under 200 lines and give exact control over all three. This is the same call Story 51 made in rejecting the official shadcn `sidebar` component — *"which solves an SSR-cookie hydration problem this client-only SPA does not have"* (`CONVENTIONS.md` line 1692) — and the same one Story 18 made in rejecting `django-filter`. **Recharts was the alternative considered**: it would cover the Line and Bar rows idiomatically and is the conventional React answer, but it still leaves Bullet and Waffle custom, adds ~100 kB to the bundle, and has known RTL weaknesses in a codebase whose entire layout discipline is direction-neutral (§ 18, `check-rtl.mjs`).

---

## Backend Tasks

### 1 — App docstring

**File: `backend/apps/reports/__init__.py`** — currently empty. Leave it empty; Django app packages in this project carry no module docstring (`apps/tickets/__init__.py`, `apps/sla/__init__.py` are both empty). **No change.** Listed explicitly so it is clear this was checked, not skipped.

**Files: `backend/apps/reports/models.py`, `admin.py`** — leave both at their `# Create your models here.` / `# Register your models here.` scaffold state. This story adds no model, so there is nothing to register.

---

### 2 — Aggregation helpers

**Create file: `backend/apps/reports/aggregation.py`**

```python
"""Shared query/aggregation helpers — RPT-0's 🔑 half.

Reused by RPT-1 (ticket volume/trends by status/category/channel/time),
RPT-2 (SLA response/resolution trends, breach rates), RPT-3 (per-agent
counts), RPT-4 (CSAT trends and breakdown), and RPT-5 (combined KPIs) —
`SupportOs backlog.MD:635-663`. Nothing here knows what a ticket, a
message, or a rating is: every function takes a **queryset** and a field
name, so one implementation serves all five.

A plain function module, not a view: the same shape
`apps/knowledge_base/search.py` (KB-3) and `apps/sla/policy.py` (SLA-1)
already use. `apps/reports/views.py::BaseReportView` is the thin HTTP
wrapper; RPT-1 writes the first subclass.

Computed on every request, never cached or pre-aggregated — the same
"compute over cache when the read is cheap enough to redo" call
`search.py` documents (lines 12-17). Revisit when a report is measurably
slow against real data, not before.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from django.db.models import Count, QuerySet
from django.db.models.functions import TruncDay, TruncMonth, TruncWeek
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

# Buckets, and the Trunc function each maps to. Keys are the wire values a
# client sends as `?bucket=`; adding a bucket means adding a row here and a
# branch in `_advance` below, nothing else.
BUCKETS = {
    "day": TruncDay,
    "week": TruncWeek,
    "month": TruncMonth,
}
DEFAULT_BUCKET = "day"

# A report with no explicit range covers the last 30 days ending today.
DEFAULT_RANGE_DAYS = 30
# Hard ceiling. A `day`-bucketed two-year range is 730 gap-filled rows in
# one response — a real client mistake, not a legitimate request. Raise it
# here (one constant) if a report ever genuinely needs more.
MAX_RANGE_DAYS = 366
```

Then five public functions plus two private ones. Full signatures, in file order:

```python
def parse_date_range(query_params) -> tuple[datetime, datetime]:
    """`?from=YYYY-MM-DD`/`?to=YYYY-MM-DD` as an aware [start, end) pair.

    `to` is INCLUSIVE to the caller ("through 31 January") and returned as
    an EXCLUSIVE upper bound (00:00 on 1 February), so a `__gte`/`__lt`
    filter needs no off-by-one handling at any call site.

    Both default: `to` = today, `from` = DEFAULT_RANGE_DAYS earlier.
    Raises DRF `ValidationError` (-> a 400 in envelope form via
    `apps/core/exceptions.py`) on an unparseable date, a reversed range, or
    a span over MAX_RANGE_DAYS.
    """


def parse_bucket(query_params) -> str:
    """`?bucket=` as one of BUCKETS' keys, defaulting to DEFAULT_BUCKET.
    Raises DRF `ValidationError` naming the valid values on anything else.
    """


def bucketed_counts(
    queryset: QuerySet,
    *,
    date_field: str,
    start: datetime,
    end: datetime,
    bucket: str = DEFAULT_BUCKET,
    series_field: str | None = None,
) -> list[dict]:
    """Rows-per-time-bucket, gap-filled, ascending by bucket.

    Returns `[{"bucket": "2026-01-01", "value": 12}, ...]`, or with
    `series_field` set, `[{"bucket": ..., "series": "open", "value": 12}, ...]`
    — the multi-series shape `LineChart` reads. Every bucket in
    [start, end) is present with `value: 0` when nothing falls in it: a
    trend line with a missing Tuesday draws a straight segment across it and
    silently lies, which is the single most important thing this module
    does.

    `bucket` values are `YYYY-MM-DD` date strings, not datetimes — the
    frontend formats them through `useFormatters().date()`, and a bucket is
    a day/week/month, never an instant.
    """


def grouped_counts(
    queryset: QuerySet,
    *,
    field: str,
    limit: int | None = None,
    include_null: bool = False,
    null_label: str = "",
) -> list[dict]:
    """Counts per distinct value of `field`, DESCENDING by count.

    Returns `[{"key": "open", "value": 42}, ...]` — the shape `BarChart`
    reads. Descending is not the caller's choice: CONVENTIONS.md § 25 line
    1630 ("always sort descending by value") applies to every category bar
    chart in EPIC 11, so it is enforced here rather than trusted to five
    call sites.

    `include_null` controls whether rows whose `field` is NULL are counted
    under `null_label` (a `Ticket` with no category, an unassigned agent) or
    dropped. Default False — a "no category" bar is meaningful in RPT-1 but
    noise in RPT-3's agent ranking, so the caller decides.

    `limit` caps the returned rows (RPT-3's "≤15 agents before switching to
    a paginated table", § 25 line 1633). Applied AFTER ordering, so it is
    the true top-N.
    """


def to_series(rows: list[dict], *, series_field: str = "series") -> dict[str, list[dict]]:
    """Regroup `bucketed_counts(..., series_field=...)` output into
    `{series_name: [{"bucket": ..., "value": ...}, ...]}` — one entry per
    line `LineChart` draws. A separate function, not a `bucketed_counts`
    flag, because CSV export wants the FLAT shape and the chart wants the
    grouped one, from the same query.
    """


def _bucket_starts(start: datetime, end: datetime, bucket: str) -> list[date]:
    """Every bucket start in [start, end), ascending — the gap-fill spine."""


def _advance(current: date, bucket: str) -> date:
    """The next bucket start after `current`. `month` increments the month
    field and clamps to day 1 rather than adding 30 days — `timedelta` has
    no month, and a 30-day step drifts off month boundaries within a year.
    """
```

**Four implementation constraints, all load-bearing:**

- **Timezone.** `USE_TZ = True` (`config/settings/base.py:156`) and `TIME_ZONE` comes from `DJANGO_TIME_ZONE` (line 154). Call `Trunc*` **with an explicit `tzinfo=timezone.get_current_timezone()`** rather than relying on the implicit default, so the bucketing in `bucketed_counts` and the spine in `_bucket_starts` are provably computed against the same zone. A mismatch here shifts every count by up to a day and is invisible in testing from a UTC machine.
- **Ordering.** Annotate, then `.values(...)`, then `.annotate(Count(...))`, then `.order_by(...)`. Django's default `Meta.ordering` (e.g. `Ticket.Meta.ordering = ("-created_at",)`, `models.py:107`) silently joins itself into a `GROUP BY` and fragments the aggregate into one row per underlying record — call `.order_by()` explicitly on every aggregate queryset, never leave it to the default.
- **`_bucket_starts` for `week`.** `TruncWeek` truncates to **Monday** (Django's documented behaviour). The spine must snap `start` back to its own Monday before stepping, or the generated keys will not match the keys the database returns and every week will appear as a gap.
- **`parse_date_range` returns aware datetimes** built with `timezone.make_aware` from the parsed dates, so callers filter `**{f"{date_field}__gte": start, f"{date_field}__lt": end}` directly.

---

### 3 — CSV export

**Create file: `backend/apps/reports/export.py`**

```python
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


def csv_response(rows, *, columns, filename: str) -> HttpResponse:
    """`rows_to_csv` wrapped in a downloadable response.

    `filename` is the base name WITHOUT extension; ".csv" is appended here
    so no call site can forget it or disagree about it.
    """
```

`csv_response` sets `content_type="text/csv; charset=utf-8"` and `Content-Disposition: attachment; filename="<filename>.csv"`. Write through `csv.writer` into an `io.StringIO` with `lineterminator="\r\n"` (RFC 4180, and what Excel expects) — never by joining strings, which would not quote a label containing a comma.

---

### 4 — The shared report view base

**Create file: `backend/apps/reports/views.py`** (replacing the `# Create your views here.` scaffold)

```python
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

from django.http import HttpResponse
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
```

`get_report` returns a **flat list of dicts** in both branches — the same rows that become CSV also become JSON, so an exported file can never disagree with the chart the user was looking at. A subclass wanting a grouped multi-series payload calls `to_series()` in its own frontend-facing shaping, not here.

**Deliberately not added:** no `apps/reports/urls.py`, no `path("", include("apps.reports.urls"))` in `config/api_urls.py`. `BaseReportView` is imported by `RPT-1`, not routed by this story — see `## Prerequisites`.

---

## Frontend Tasks

### 5 — Chart types

**Create file: `frontend/src/shared/ui/chart/types.ts`**

```ts
/** One point on a time axis. `bucket` is a `YYYY-MM-DD` date string, exactly
 * as `apps/reports/aggregation.py::bucketed_counts` emits it — a bucket is a
 * day/week/month, never an instant. */
export type ChartPoint = {
  bucket: string
  value: number
}

/** One named line. `label` is already translated by the caller — chart
 * components never call `t()` on data. */
export type ChartSeries = {
  key: string
  label: string
  points: readonly ChartPoint[]
}

/** One bar. Mirrors `grouped_counts`'s `{key, value}` plus the caller's
 * translated label; already sorted descending server-side (CONVENTIONS.md
 * § 25 line 1630) — a chart component must not re-sort. */
export type ChartCategory = {
  key: string
  label: string
  value: number
}
```

### 6 — `ChartFrame` — the reusable wrapper

**Create file: `frontend/src/shared/ui/chart/ChartFrame.tsx`**

The wrapper the intake asks for. Props follow `QueryBoundary`'s contract (a `query`, a `children(data)` render prop), not `DataTable`'s, because a chart's non-success states render fine in a plain `<div>`:

```tsx
type ChartFrameProps<T> = {
  title: string
  /** Optional one-line description under the title. */
  description?: string
  query: UseQueryResult<T, unknown>
  /** The chart body. Only called on success with non-empty data. */
  children: (data: T) => ReactNode
  /** Treat this data as "nothing to chart". */
  isEmpty?: (data: T) => boolean
  /** The accessibility fallback — CONVENTIONS.md § 25 lines 1638-1642
   * requires a visible data table or text summary for EVERY chart, so this
   * is REQUIRED, not optional. */
  table: (data: T) => ReactNode
  /** Rendered next to the title (a range picker, an export button). */
  action?: ReactNode
}
```

Behaviour:

- Renders a `Card` with a `CardHeader`/`CardTitle` (use `asChild` to emit a real `<h2>` — the heading-hierarchy fix Story 37 added, `CONVENTIONS.md` line 1597) and `CardContent`.
- `query.isPending` → `<Skeleton className="h-64 w-full" />`. `query.isError` → the existing `ErrorState` with `onRetry={() => void query.refetch()}`, matching `DataTable.tsx:125-142` and `QueryBoundary.tsx:36-41` exactly, including the `ApiRequestError` instance check.
- Empty → the existing `Empty` component with a `ChartNoAxesColumnIcon` from `lucide-react`.
- Success → the chart body **and** a "Show data table" toggle (a `Button variant="ghost" size="sm"` with `aria-expanded`) that reveals `table(data)`. The table is rendered with `hidden` toggled, not conditionally mounted, so it is always in the accessibility tree and reachable by a screen reader even when visually collapsed — which is what § 25's floor actually requires. The chart `<svg>` itself carries `role="img"` plus an `aria-label` naming the chart and pointing at the table.

Do **not** restyle `Card`, `Skeleton`, `Empty`, or `ErrorState` (`CONVENTIONS.md` § 7: their props are a stable contract).

### 7 — `ChartDataTable` — the accessibility fallback

**Create file: `frontend/src/shared/ui/chart/ChartDataTable.tsx`**

A plain, unpaginated, unsorted table built from the existing `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell` primitives — **not** `DataTable`, which is bound to `Page<T>`/server pagination and would need a fake pagination block. Props:

```tsx
type ChartDataTableProps = {
  /** Already-translated column headers, in order. */
  columns: readonly string[]
  /** Already-formatted cell text, row-major. */
  rows: readonly (readonly string[])[]
  /** Visually-hidden <caption>, same requirement as DataTable's. */
  caption: string
}
```

Every consumer builds `rows` by formatting through `useFormatters()` first — this component does no formatting and no translation, so it is trivially correct in both languages.

### 8 — `LineChart`

**Create file: `frontend/src/shared/ui/chart/LineChart.tsx`**

Plain SVG, per `CONVENTIONS.md` § 25 rows 1, 3, 6 (`RPT-1`/`RPT-2`/`RPT-4` trends). Props: `{ series: readonly ChartSeries[]; formatValue?: (n: number) => string; formatBucket?: (b: string) => string }`.

Requirements, each traceable to § 25 or to this project's existing rules:

- **Multi-series needs distinct color AND distinct line style** (§ 25 line 1629). Define `const SERIES_DASH = [undefined, '6 3', '2 3', '8 3 2 3', '1 3'] as const` and apply `strokeDasharray={SERIES_DASH[index % SERIES_DASH.length]}` alongside `stroke="var(--chart-N)"`, `N = (index % 5) + 1`. Never hue alone.
- **RTL.** Read `useDirection()` (`shared/i18n/useDirection.ts`). Under `'rtl'`, the time axis runs right-to-left: map the x coordinate as `dir === 'rtl' ? width - padding - t * plotWidth : padding + t * plotWidth`. SVG geometry is not a CSS logical property and does not flip on its own; `check-rtl.mjs` cannot see it (its own docstring, line 5). Do not attempt this with a CSS `transform: scaleX(-1)` — it mirrors the text labels too.
- **Responsive.** `<svg viewBox="0 0 <W> <H>" preserveAspectRatio="none" className="h-64 w-full">` with a fixed internal coordinate space. No `ResizeObserver`, no measured width — the wrapper `Card` already constrains the width, and `viewBox` scaling is the whole mechanism.
- **Legend** below the plot: for each series a short `<svg>` swatch drawing the actual stroke **with its dash pattern** (not a solid square), then the label text.
- **Keyboard parity with hover** (§ 25 line 1641). Each data point is a `<circle>` with `tabIndex={0}`, `role="img"`, and an `aria-label` of `"<series label>, <formatted bucket>: <formatted value>"`, plus a `<title>` child for the native hover tooltip. The same string in both, so focus and hover reveal identical detail.
- **Empty/degenerate input:** a series of one point renders that point as a `<circle>` with no `<path>` (a one-point line has no length); all-equal values render a flat line at the vertical midpoint rather than dividing by a zero range.

### 9 — `BarChart`

**Create file: `frontend/src/shared/ui/chart/BarChart.tsx`**

Per § 25 rows 2 and 5 (`RPT-1` by status/category/channel; `RPT-3` ranked agents). Props: `{ categories: readonly ChartCategory[]; orientation?: 'vertical' | 'horizontal'; formatValue?: (n: number) => string }`, default `'vertical'` — `RPT-3` passes `'horizontal'` (§ 25 line 1633).

- **One distinct color per bar** from `--chart-1`…`--chart-5`, cycling by index (§ 25 line 1630).
- **Never re-sort.** `grouped_counts` already ordered descending; re-sorting client-side would silently disagree with the CSV export of the same query.
- **Every bar carries its value as text** at the bar end — this is what satisfies "color always paired with a text label" for a bar chart, and it is why a legend is unnecessary here.
- **RTL**: in `'horizontal'` orientation bars grow from the inline start, so under `'rtl'` they grow leftward from the right edge — same `useDirection()` coordinate mapping as `LineChart`. In `'vertical'` orientation the category order along the x axis reverses under `'rtl'`; the bars themselves still grow upward.
- Each bar is a `<rect>` with `tabIndex={0}`, `role="img"`, an `aria-label` of `"<label>: <formatted value>"`, and a matching `<title>`.

### 10 — `shared/lib/download.ts`, and the `downloadAttachment` refactor

**Create file: `frontend/src/shared/lib/download.ts`**

```ts
import { httpClient } from '@/shared/lib/api/client'

/**
 * Fetch a URL as a blob through the authenticated `httpClient` and hand it
 * to the browser's own save flow.
 *
 * Cannot be a plain `<a href>` link — the API is Bearer-token authenticated
 * and a browser navigation carries no `Authorization` header. Not
 * `api.get()` either: the body is a raw file, not the JSON envelope
 * `unwrap()` expects (`shared/lib/api/client.ts:102-127`).
 *
 * Promoted verbatim from `features/customers/api/downloadAttachment.ts`
 * (Story 21) by RPT-0, which needs the same mechanism for CSV export and
 * cannot import across a feature boundary (`.oxlintrc.json`
 * no-restricted-imports). Attachments is its first caller; a report
 * screen's export button is the second.
 */
export async function downloadFile(
  url: string,
  filename: string,
  params?: Record<string, unknown>,
): Promise<void> {
  const response = await httpClient.get(url, { responseType: 'blob', params })
  const objectUrl = URL.createObjectURL(response.data as Blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}
```

**File: `frontend/src/features/customers/api/downloadAttachment.ts`** — rewrite the body to delegate, keeping the exported signature **unchanged** so `AttachmentsSection.tsx:89` needs no edit:

```ts
import { downloadFile } from '@/shared/lib/download'

/** See `shared/lib/download.ts` for why this cannot be a plain `<a href>`.
 * The mechanism moved there in Story 55 (RPT-0); this file keeps the
 * attachment-specific URL. */
export function downloadAttachment(id: number, filename: string): Promise<void> {
  return downloadFile(`/attachments/${id}/download/`, filename)
}
```

### 11 — Locale keys

**Files: `frontend/src/shared/i18n/locales/en/common.json` and `ar/common.json`** — add a `chart` block to both, as a sibling of the existing `table` block. These belong in `common`, not a feature namespace: `shared/ui/` components read from `common` (`DataTable.tsx:67`, `Empty.tsx:26`).

English:

```json
"chart": {
  "showTable": "Show data table",
  "hideTable": "Hide data table",
  "dataTableCaption": "{{title}} — data table",
  "empty": "No data for this period",
  "series": "Series",
  "value": "Value",
  "period": "Period",
  "category": "Category"
}
```

Arabic:

```json
"chart": {
  "showTable": "عرض جدول البيانات",
  "hideTable": "إخفاء جدول البيانات",
  "dataTableCaption": "{{title}} — جدول البيانات",
  "empty": "لا توجد بيانات لهذه الفترة",
  "series": "السلسلة",
  "value": "القيمة",
  "period": "الفترة",
  "category": "الفئة"
}
```

**No `resources.ts` change** — `common` is already registered (`shared/i18n/resources.ts:45,63`). No new feature namespace is created by this story.

### 12 — Barrel export

**Create file: `frontend/src/shared/ui/chart/index.ts`**

```ts
export { ChartFrame } from './ChartFrame'
export { ChartDataTable } from './ChartDataTable'
export { LineChart } from './LineChart'
export { BarChart } from './BarChart'
export type { ChartPoint, ChartSeries, ChartCategory } from './types'
```

Matches `shared/ui/form/index.ts`'s existing one-line-per-export style (`frontend/src/README.md:67-70` names `shared/ui/form/` and `shared/ui/confirm/` as the file-shape precedent for a multi-file `shared/ui/` folder).

---

## Documentation Tasks

### 13 — Conventions

**File: `CONVENTIONS.md`** — add a new top-level `## 27. Reporting (RPT-0)` section after `## 26. Customer portal identity & scoping`. Keep it to what affects code, the same way § 24 (Background jobs) and § 25 do. Cover exactly six things:

1. `apps/reports/aggregation.py` is the only place a report query is bucketed or grouped; a report view never writes its own `Trunc*`/`values().annotate()` chain.
2. Gap-filling is mandatory for a trend series, and why (a missing bucket draws a straight line across a real zero).
3. The export query parameter is **`export=csv`**, never `format=csv` — with the DRF content-negotiation reason and the two file:line citations, so nobody re-discovers it.
4. A report response is a flat list of dicts; the CSV and the JSON are the same rows.
5. `shared/ui/chart/` is the only home for chart components, because `no-restricted-imports` makes cross-feature reuse impossible — and every chart goes inside `ChartFrame`, which is what supplies § 25's required data-table fallback.
6. No chart library, with the one-paragraph reasoning from `## Product rules` above, so `RPT-1`…`RPT-5` inherit the decision instead of relitigating it.

Add a closing cross-reference line to § 25's chart-type table, and — in **§ 25 itself, line 1624** — change the parenthetical *"`RPT-0` (Reporting Foundation, unplanned)"* to name this story, since it is no longer unplanned. Do not otherwise edit § 25.

### 14 — `apps/README.md`

**File: `backend/apps/README.md`** — the `reports` row (line 75) already reads "Aggregations, dashboards, exports" and needs no change. Add one line under **What `core` is for** (after line 50's "A helper used by exactly one app lives in that app.") recording why `aggregation.py`/`export.py` live in `apps/reports` rather than `apps/core` despite being used by five future stories: those five are all `RPT-*` reports inside one business area, so rule 1 ("belongs to exactly one business area → that app") matches before rule 2 ever applies.

### 15 — `frontend/src/README.md`

**File: `frontend/src/README.md`** — in the paragraph listing `shared/ui/` sub-folders (around lines 67-70, which currently name `shared/ui/form/` and `shared/ui/confirm/`), add `shared/ui/chart/` as the third multi-file folder following that shape, with a one-clause note that its components exist there rather than in a feature because of the `no-restricted-imports` boundary.

---

## Edge Cases & Failure Modes

- **`?from=` later than `?to=`** → `parse_date_range` raises DRF `ValidationError({"from": [...]})`, rendered as a `400` with `error.fields.from` by `apps/core/exceptions.py`, and picked up by the frontend's existing `applyServerErrors`. Not a 500, and not a silently-empty chart.
- **A range wider than `MAX_RANGE_DAYS`** → `400` naming the limit. Without this, `?bucket=day&from=2020-01-01` gap-fills ~2,400 rows into one response and one SVG.
- **`?bucket=quarter`** (or any unknown value) → `400` listing the three valid values, from `parse_bucket`. Not a silent fallback to `day`, which would return a chart the user did not ask for.
- **A period with no rows at all** → `bucketed_counts` still returns one row per bucket with `value: 0`. `ChartFrame`'s `isEmpty` is what decides whether to show the `Empty` state instead; the natural predicate for a report is "every value is 0", not "the array is empty", because the array is never empty after gap-filling. Document this on `isEmpty`'s prop so no consumer gets it wrong.
- **`TruncWeek` and the spine disagreeing.** Django truncates a week to **Monday**. If `_bucket_starts` steps in 7-day increments from an arbitrary `start` instead of snapping to Monday first, every generated key misses the database's key and the entire series reads as zeros — a total failure that looks like "no data" rather than an error. Enforced in `_advance`/`_bucket_starts` (task 2) and checked directly in `## Verification Steps` step 3.
- **Server timezone vs. bucket boundaries.** With `USE_TZ = True` and a non-UTC `DJANGO_TIME_ZONE`, a `Trunc*` without explicit `tzinfo` and a spine built in a different zone shift relative to each other, misfiling rows at the day boundary. Both sides read `timezone.get_current_timezone()` (task 2).
- **Default `Meta.ordering` fragmenting an aggregate.** `Ticket.Meta.ordering = ("-created_at",)` (`apps/tickets/models.py:107`) joins itself into the `GROUP BY` unless `.order_by()` is called explicitly on the aggregate queryset, producing one row per ticket instead of one per bucket. This is the classic Django aggregation bug and it fails *quietly* — the numbers are just wrong. Every aggregate chain in task 2 ends in an explicit `.order_by(...)`.
- **`?export=csv` on a report whose `csv_columns` is empty** → an empty file with no header row. `BaseReportView` does not guard this; the subclass declaring no `csv_columns` is the bug, and `RPT-1`'s own verification catches it. Noted here so it is a known, deliberate omission rather than an oversight.
- **A label containing a comma, a quote, or a newline in CSV** → handled by `csv.writer`'s own quoting. This is precisely why `rows_to_csv` must not build lines by string-joining.
- **Arabic labels in the exported CSV** → the `UTF8_BOM` prefix is what makes Excel decode them correctly; without it they are mojibake on a double-click while looking fine in every developer tool. Verified in `## Verification Steps` step 5.
- **A single-point or all-equal-value line series** → no division by a zero value range, and no zero-length `<path>` (task 8's last bullet).
- **RTL charts.** `check-rtl.mjs` reads text and cannot see SVG coordinate math (its own docstring, `scripts/check-rtl.mjs:5`), so a chart that draws left-to-right under `dir="rtl"` passes every automated check in this repo. Verified only by eye, step 7.
- **`downloadAttachment`'s signature.** The refactor in task 10 must keep `(id: number, filename: string) => Promise<void>` exactly — `AttachmentsSection.tsx:89` calls it inside a `try`/`catch` that toasts `attachments.downloadFailed` on rejection, and `downloadFile` must keep rejecting rather than swallowing, or that error path goes dead.

---

## Test Plan

Per standing project policy this project authors no automated tests (`CONVENTIONS.md` § 16, and every prior story's `## Test Plan`). This story adds none.

Its checks are: the backend's `manage.py check` and `ruff`; direct `manage.py shell` exercise of all five `aggregation.py` functions and both `export.py` functions against the real seeded database, including the three quiet-failure modes above (week snapping, timezone, `Meta.ordering` fragmentation); the frontend's `lint`, `format:check`, `check:rtl`, and `build`; an `en`/`ar` key-set comparison of the new `chart` block; and a bilingual visual check of every chart component rendered against fixture data. All spelled out below.

---

## Verification Steps

1. **Backend checks:** from `backend/`, `python manage.py check` — no errors — and `ruff check apps/reports/ && ruff format --check apps/reports/` — clean. Confirm `python manage.py makemigrations --check --dry-run` reports **no changes** (this story adds no model, so it must not generate a migration).
2. **Aggregation helpers, real data, happy path.** From `backend/`, `python manage.py shell`:
   ```python
   from apps.reports.aggregation import bucketed_counts, grouped_counts, parse_bucket, parse_date_range, to_series
   from apps.tickets.models import Ticket
   start, end = parse_date_range({})                      # 30-day default
   rows = bucketed_counts(Ticket.objects.all(), date_field="created_at", start=start, end=end)
   assert len(rows) == 30, len(rows)                      # gap-filled: exactly one row per day
   assert sum(r["value"] for r in rows) == Ticket.objects.filter(created_at__gte=start, created_at__lt=end).count()
   print(grouped_counts(Ticket.objects.all(), field="status"))
   ```
   The `len(rows) == 30` assertion is the gap-fill proof, and the `sum(...) == count()` assertion is the `Meta.ordering`-fragmentation proof — a fragmented aggregate returns one row per ticket and fails the first assertion loudly.
3. **Week bucketing.** In the same shell, `bucketed_counts(..., bucket="week")` over a 30-day range → 5 rows (or 4, depending on where the range starts relative to Monday), **every `value` summing to the same total as step 2's daily run**, and every `bucket` key falling on a Monday: `assert all(date.fromisoformat(r["bucket"]).weekday() == 0 for r in rows)`. A mismatched spine shows here as a total of `0`.
4. **Validation errors.** In the shell, confirm each raises `rest_framework.exceptions.ValidationError`: `parse_date_range({"from": "not-a-date"})`, `parse_date_range({"from": "2026-06-01", "to": "2026-01-01"})`, `parse_date_range({"from": "2020-01-01", "to": "2026-01-01"})` (over `MAX_RANGE_DAYS`), `parse_bucket({"bucket": "quarter"})`.
5. **CSV export, including Arabic.** In the shell:
   ```python
   from apps.reports.export import csv_response, rows_to_csv
   rows = [{"bucket": "2026-01-01", "value": 3}, {"bucket": "2026-01-02", "value": 0}]
   text = rows_to_csv(rows, columns=(("bucket", "الفترة"), ("value", "القيمة")))
   print(repr(text))          # starts with '﻿', CRLF line endings, headers quoted as needed
   r = csv_response(rows, columns=(("bucket", "Period"), ("value", "Value")), filename="ticket-volume")
   print(r["Content-Type"], r["Content-Disposition"])
   # -> text/csv; charset=utf-8   attachment; filename="ticket-volume.csv"
   ```
   Then write `text` to a `.csv` file and open it in Excel (or LibreOffice) — the Arabic headers must render as Arabic, not mojibake. This is the only check that catches a missing BOM.
6. **Frontend gates:** from `frontend/`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, and `npm run build` — all clean, no TypeScript errors.
7. **Bilingual chart rendering.** The charts have no screen yet, so render them from a scratch route or a temporary mount in `App.tsx` (**revert before finishing**) with fixture data: a two-series `LineChart` over 14 buckets, and a five-category `BarChart` in both orientations, each wrapped in `ChartFrame` with a `ChartDataTable`. Confirm, in **English**: both series visually distinguishable with the browser in greyscale (macOS/Windows accessibility display filter, or DevTools' "Emulate vision deficiencies → Achromatopsia") — this is what proves the dash patterns, not the hues, are carrying the distinction; every bar labelled with its value; the "Show data table" toggle reveals the fallback table and `aria-expanded` flips. Then switch to **Arabic**: the time axis must run right-to-left, horizontal bars must grow leftward from the right edge, and no label may be mirrored or clipped.
8. **Chart keyboard parity.** With the same fixture render, `Tab` through the line's data points and the bars: each takes focus with a visible ring, and its `aria-label` (check in DevTools' accessibility pane, or with a screen reader) reads the same text its hover `<title>` shows.
9. **Locale key parity:** manually diff the new `chart` block's key paths in `frontend/src/shared/i18n/locales/en/common.json` against `ar/common.json` — identical sets (no automated script exists for this).
10. **Attachment download regression.** With the backend up, `npm run dev`, open a customer profile with at least one attachment and click **Download**. The file must save with its original name exactly as before — this is the check that task 10's refactor of `downloadAttachment.ts` did not break its one existing caller. Then confirm the failure path still works: stop the backend, click **Download** again, and the `attachments.downloadFailed` toast must appear.

---

## Done Criteria

- [ ] `backend/apps/reports/aggregation.py` — `parse_date_range`, `parse_bucket`, `bucketed_counts`, `grouped_counts`, `to_series` plus `_bucket_starts`/`_advance`; explicit `tzinfo` on every `Trunc*`, explicit `.order_by()` on every aggregate chain, Monday-snapped week spine.
- [ ] `backend/apps/reports/export.py` — `rows_to_csv` and `csv_response`; UTF-8 BOM, `csv.writer` quoting, CRLF, `attachment` disposition; returns a plain `HttpResponse`, not a DRF `Response`.
- [ ] `backend/apps/reports/views.py` — `BaseReportView` with `EXPORT_PARAM = "export"` (**not** `format`, with the DRF reason in a comment), no `permission_map` of its own, `get_report` raising `NotImplementedError`.
- [ ] **No** `apps/reports/urls.py`, **no** `config/api_urls.py` change, **no** `Permissions.REPORTS_VIEW`, **no** grant migration, **no** new migration of any kind — all four deferred to `RPT-1` per `## Prerequisites`.
- [ ] `frontend/src/shared/ui/chart/` — `types.ts`, `ChartFrame.tsx`, `ChartDataTable.tsx`, `LineChart.tsx`, `BarChart.tsx`, `index.ts`. `ChartFrame`'s `table` prop is **required**. Charts compose existing primitives and restyle none.
- [ ] `LineChart` varies `stroke-dasharray` per series (not hue alone), `BarChart` labels every bar with its value, both flip their axis under `useDirection() === 'rtl'`, and every data point/bar is focusable with an `aria-label` matching its `<title>`.
- [ ] `frontend/src/shared/lib/download.ts` created; `features/customers/api/downloadAttachment.ts` delegates to it with its exported signature unchanged.
- [ ] `chart` block added to both `shared/i18n/locales/en/common.json` and `ar/common.json` with an identical key set. No new feature namespace, no `resources.ts` change.
- [ ] **No** `frontend/package.json` dependency added; **no** `frontend/src/index.css` change; **no** `features/reports/` folder, route, or sidebar link.
- [ ] `CONVENTIONS.md` § 27 added (six points, including the `export=csv` trap with its file:line citations); § 25 line 1624's "unplanned" parenthetical updated to name this story.
- [ ] `backend/apps/README.md` and `frontend/src/README.md` updated with the placement notes from tasks 14 and 15.
- [ ] Verified by shell against real data: gap-fill row count and sum-equals-count (step 2), Monday-snapped week bucketing (step 3), all four validation errors (step 4), CSV headers/disposition and Arabic-in-Excel (step 5).
- [ ] Verified in the browser: bilingual + RTL chart rendering, greyscale series distinguishability, data-table toggle, keyboard/hover parity (steps 7-8), and the attachment-download regression in both its success and failure paths (step 10).
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 56 (`RPT-1`, Ticket Reports).**
