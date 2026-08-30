# Story 56 — Ticket Reports (Story: SUPPORTOS-77)

## Prerequisites

- **Story 55 completed** (`RPT-0`, Reporting Foundation, `SUPPORTOS-76`, [55-story-reporting-foundation-SUPPORTOS-76.md](55-story-reporting-foundation-SUPPORTOS-76.md)). Everything it shipped is on disk and verified: `apps/reports/aggregation.py` (255 lines), `apps/reports/export.py` (60 lines), `apps/reports/views.py::BaseReportView` (54 lines), `frontend/src/shared/ui/chart/` (`ChartFrame` 101 lines, `LineChart` 151, `BarChart` 127, `ChartDataTable` 51, `types.ts` 24, `index.ts` 5), `frontend/src/shared/lib/download.ts` (32 lines), and `CONVENTIONS.md` § 27.
- **This story adds the five things Story 55 deliberately deferred**, in the same change as the first real report — exactly as that story's `## Prerequisites` and this feature's `00-overview.md` both specify: `Permissions.REPORTS_VIEW`, its grant migration, `apps/reports/urls.py`, the `config/api_urls.py` include line, and the whole `features/reports/` frontend folder. None of those is a new decision; each was blocked on a view existing to declare it (`apps/core/permissions.py:5-7`, `backend/apps/README.md:52-56`).
- **Verified: `Ticket` has no `channel` field, and this story does not add one.** `Message.Channel` (`apps/communications/models.py:20-25`: `email`/`whatsapp`/`chat`/`sms`/`web_form`) lives on `Message`, which relates to `Ticket` by `Message.ticket` (`models.py:30-32`, `related_name="messages"`). "Volume by channel" (intake) therefore means **the channel of a ticket's earliest inbound message** — its origin — derived on read by a `Subquery` annotation, not persisted. Verified live against this project's Postgres: the annotation feeds `grouped_counts` unchanged, in both its `include_null` branches (see `## Product rules` for the exact queryset and the shell output).
- **Verified defect in `RPT-0`'s `bucketed_counts`, which this story is the first to hit and must fix.** `apps/reports/aggregation.py:153` sorts the collected series keys with a bare `sorted({...})`. The moment `series_field` yields a SQL NULL — which the origin-channel annotation does for every ticket created directly in the staff UI rather than arriving through a channel — that line raises `TypeError: '<' not supported between instances of 'str' and 'NoneType'`. Reproduced live:
  ```
  --- series_field=status (no NULLs) ---      rows 90  ✓
  --- series_field=origin_channel (NULLs) --- EXCEPTION: TypeError '<' not supported between instances of 'str' and 'NoneType'
  ```
  `grouped_counts` (lines 167-203) already has an explicit `include_null`/`null_label` NULL policy; `bucketed_counts` has none at all. That asymmetry is the actual defect. Task 3 gives `bucketed_counts` the same contract. **This is not scope creep** — `RPT-3` splits by `assigned_agent` (nullable, `SET_NULL`, `apps/tickets/models.py:79-86`) and would hit the identical crash.
- **Verified frontend defect class this story must avoid: a bare `YYYY-MM-DD` bucket string rendered through `useFormatters().date()` shows the WRONG DAY in any negative-UTC-offset timezone.** `formatDate` (`frontend/src/shared/lib/format.ts:39-49`) does `new Intl.DateTimeFormat(...).format(new Date(value))`, and JS parses a bare `YYYY-MM-DD` as **UTC midnight**. Measured:
  ```
  new Date('2026-01-01')  ->  UTC: Jan 1, 2026 | America/New_York: Dec 31, 2025 | Asia/Riyadh: Jan 1, 2026
  same value with { timeZone: 'UTC' } -> Jan 1, 2026 in ALL of UTC / New_York / Riyadh / Honolulu
  ```
  A bucket is a calendar date, not an instant, so every bucket label in this story passes `{ dateStyle: 'medium', timeZone: 'UTC' }`. `useFormatters().date()` already forwards an options object (`frontend/src/shared/hooks/useFormatters.ts:16-17`) — no shared-code change needed.
- **`no-restricted-imports` forbids `features/reports/` importing anything from `features/tickets/`** (`frontend/.oxlintrc.json:8-18`). `TICKET_STATUSES`/`TICKET_PRIORITIES` (`features/tickets/types/ticket.ts:2-6`) are therefore **re-declared locally** in `features/reports/types/report.ts`. This is the established pattern, not a workaround: `features/tickets/types/ticket.ts:10` already documents its own constants as a duplicate of `Ticket.Status`, and `CONVENTIONS.md` line 1668-1672 records the same duplication for `statusBadge.ts` across `tickets`/`portal`.
- **No `Ticket`/`Message` model change, no schema migration.** The only migration this story writes is a `RunPython` permission grant, in an app that has never had one.

---

## Story Goal

The first real report, and the proof that `RPT-0`'s foundation works end to end:

1. **Ticket metrics API** — two endpoints under `/api/reports/tickets/`, both `BaseReportView` subclasses so both get `?from=`/`?to=`/`?bucket=`/`?export=csv` for free:
   - `GET /api/reports/tickets/volume/` — ticket count per time bucket, optionally split into one line per `?series=status|priority|category|channel`. Feeds the Line chart (`CONVENTIONS.md` § 25 row 1, "Trend Over Time").
   - `GET /api/reports/tickets/breakdown/` — ticket count per distinct value of `?dimension=status|priority|category|channel`, descending. Feeds the Bar chart (§ 25 row 2, "Compare Categories").
2. **Report UI** — a `/reports/tickets` screen rendering both charts inside `ChartFrame`, with a date-range control, a dimension picker, and a CSV export button per chart.
3. **The deferred `RPT-0` wiring** — `reports.view`, its grant, the app's URLs, the API include, the frontend feature folder, route, and sidebar link.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| Two endpoints, not one | `BaseReportView.get_report` returns a **flat list of dicts** (`apps/reports/views.py:44-53`) so the CSV and the JSON are the same rows. A single endpoint returning both a trend and a breakdown would break that contract for its own CSV. Two flat reports = two clean exports, and they map 1:1 onto § 25's two `RPT-1` rows. |
| `apps/reports/tickets.py` | The domain half — origin-channel derivation and the dimension whitelist. `aggregation.py` stays generic (it "knows nothing about a ticket", its own docstring line 6-8); everything ticket-specific lands here, the same `search.py`/`policy.py` split. |
| The `bucketed_counts` NULL fix | Task 3. See `## Prerequisites` — a verified crash, hit by this story and `RPT-3`. |
| `features/reports/` | The intake's "report UI". Modelled on `features/audit-log/` (7 files, read-only, one screen, no mutations) rather than on a CRUD feature. |

**Not here, and why:**

- **No SLA, agent, or CSAT metric.** `RPT-2`/`RPT-3`/`RPT-4` own those (`SupportOs backlog.MD:643-657`). This story's endpoints are `tickets`-prefixed precisely so those stories add siblings rather than overload these.
- **No dashboard combining several charts into a KPI grid.** `RPT-5` (`SupportOs backlog.MD:659-663`).
- **No Bullet/Gauge or Waffle chart, and no new chart component in `shared/ui/chart/`.** § 25 assigns Line + Bar to `RPT-1`, and both already exist. This story is the first *consumer* of `shared/ui/chart/`, not a contributor to it.
- **No `Ticket.origin_channel` persisted field.** It would need a backfill migration plus an edit to every channel adapter's create path, to serve one report that a `Subquery` already answers. Revisit only if the annotation is measurably slow (`aggregation.py:15-18`'s own standing rule).
- **No caching, no Celery pre-aggregation, no materialized view.** Same rule.
- **No drill-through from a chart to a filtered ticket list.** Not in the intake; a real feature with its own URL-state design, and `TicketListPage`'s filters already exist for a user who wants the rows.
- **No `page`/`page_size` on either endpoint.** A report response is a bounded series (≤ 366 buckets, `MAX_RANGE_DAYS`, `aggregation.py:46`) or a bounded breakdown (≤ the number of distinct enum values or categories), and `BaseReportView` is a plain `APIView` with no pagination class. Deliberate.

---

## Context — Read These Files First

1. `.squad/stories/reports-analytics/SUPPORTOS-77/intake.md` — one task, **no acceptance criteria, no attachments** (`attachments/` exists and is empty).
2. [`55-story-reporting-foundation-SUPPORTOS-76.md`](55-story-reporting-foundation-SUPPORTOS-76.md) — read `## Prerequisites` (the `?export=csv` trap and the `HttpResponse`-bypasses-the-renderer mechanism) and the "Not here, and why" list, which is this story's own to-do list.
3. [`00-overview.md`](00-overview.md) — the deferral table naming exactly what `RPT-1` picks up, and the three inherited findings.
4. **`CONVENTIONS.md` § 27** (Reporting, added by Story 55) — the seven rules this story is the first to be bound by. **§ 25 lines 1627-1642** — the chart table's `RPT-1` rows (row 1 trend → Line, "multi-series needs distinct color **and** distinct line style"; row 2 categories → Bar, "one distinct color per bar… always sort descending by value") and the accessibility floor.
5. `backend/apps/reports/aggregation.py` (255 lines) — read end to end. `parse_date_range` (51-92), `parse_bucket` (104-112), `bucketed_counts` (115-164, **note line 153, the crash task 3 fixes**), `grouped_counts` (167-203, note the `include_null`/`null_label` contract task 3 mirrors), `to_series` (206-217).
6. `backend/apps/reports/views.py` (54 lines) — `BaseReportView`: `csv_columns`/`csv_filename` class attributes (40-42), the `get_report(request, *, start, end, bucket)` hook (44-45), and `get` (47-53). Note it declares **no** `permission_map` — every subclass must.
7. `backend/apps/reports/export.py` (60 lines) — `csv_response`'s `(key, header)` column contract (50-59), which task 6's `csv_columns` must match.
8. `backend/apps/communications/models.py:16-38` — `Message.Direction` and `Message.Channel`; `Message.ticket`'s `related_name="messages"` (line 31). The origin-channel subquery is built against exactly these.
9. `backend/apps/tickets/models.py` — `Ticket.Status` (34-38), `Ticket.Priority` (40-44), `category` FK (65-72, nullable `SET_NULL`), `Meta.ordering = ("-created_at",)` (104-107, the aggregate-fragmentation hazard § 27 point 3 names).
10. `backend/apps/core/permissions.py:26-37` — the `Permissions` class; task 1 appends one line. Lines 5-11 and 22-24 are the rule that kept it out of Story 55.
11. `backend/apps/accounts/migrations/0006_grant_audit_log_permission.py` (39 lines) — read all of it. The exact `GRANTS` dict / `grant` / `revoke` / `RunPython` shape task 2 copies, and the precedent for a **view-only oversight permission** granted narrowly. Compare `backend/apps/tickets/migrations/0002_grant_ticket_permissions.py:5-13`, whose comment states this project's role reasoning verbatim: *"agents work tickets day to day, managers need oversight, admin is explicit-by-grant"*.
12. `backend/apps/knowledge_base/urls.py` (21 lines) — a `SimpleRouter` plus a `path()` for a plain `APIView` (line 20). This story's `urls.py` is the `path()`-only half of that, no router.
13. `backend/config/api_urls.py` (26 lines) — the include list; task 7 adds one line **before** the `re_path(r"^", ApiNotFoundView...)` catch-all at line 25.
14. `frontend/src/shared/ui/chart/ChartFrame.tsx` (101 lines) — the prop contract task 11 consumes: `title` (15), `description?` (17), `query` (18), `children(data)` (20), `isEmpty?` (22), **`table` — required** (26), `action?` (28).
15. `frontend/src/shared/ui/chart/LineChart.tsx:46-49` — `{ series, formatValue?, formatBucket? }`; `BarChart.tsx:14-17` — `{ categories, orientation?, formatValue? }`; `ChartDataTable.tsx:12-16` — `{ columns, rows, caption }`. `types.ts` — `ChartPoint`/`ChartSeries`/`ChartCategory`.
16. `frontend/src/shared/lib/download.ts` (32 lines) — `downloadFile(url, filename, params?)`. Task 10's CSV export button calls this; note it takes a `params` object, which is how `?export=csv&from=…` is passed.
17. `frontend/src/features/audit-log/` (all 7 files) — **the structural model for this story's feature folder**: `api/auditLogKeys.ts` (a bare `featureKey('auditLog')`), `api/getAuditLogs.ts` (a typed params type + one `api.getPage` call), `api/useAuditLogs.ts`, `components/AuditLogListPage.tsx` (read its docstring, lines 22-29 — the "no PageHeader action, Select-filter-plus-page-reset" reasoning), `types/auditLog.ts`, `locales/{en,ar}.json`.
18. `frontend/src/features/tickets/components/TicketListPage.tsx:152-190` — the `Select` filter row this story's dimension picker copies, including the `"all"` sentinel comment (lines 50-53) and the `aria-label` + `size="sm"` on every `SelectTrigger`.
19. `frontend/src/features/tickets/types/ticket.ts:1-10` — `TICKET_STATUSES`/`TICKET_PRIORITIES` and the comment documenting them as a deliberate duplicate of the backend enum. Task 8 re-declares equivalents; **do not import from here**.
20. `frontend/src/shared/hooks/useFormatters.ts:16-17` — `date(v, o?: Intl.DateTimeFormatOptions)`. The `o` passthrough is what makes the `timeZone: 'UTC'` fix a call-site change, not a shared-code change.
21. `frontend/src/shared/i18n/resources.ts` (83 lines) — the explicit namespace map; task 12 adds two imports and one line per language, per its own docstring (lines 35-42).
22. `frontend/src/app/router.tsx:296-322` — the `tickets.manage`-gated `categories` block (Story 54), the nearest sibling to the new `reports.view` block; and `:326-338`, the `audit_log.view` block, which is the closest structural match (one route, one permission, read-only).
23. `frontend/src/app/Sidebar.tsx:2-17` (icon imports), `:143-151` (the `tickets.manage` categories block added by Story 54), `:193-199` (the `audit_log.view` block — the shape task 14 copies), and `:75-84` (the `useTranslation` namespace array, which **must** gain `'reports'`).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Ticket metrics API using RPT-0.** | Intake, sole task | Both views subclass `BaseReportView`; all aggregation goes through `aggregation.py`, none hand-written (§ 27 point 1). |
| **Volume/trends by time.** | Intake | `TicketVolumeReportView` → `bucketed_counts`. |
| **…by status / category / channel.** | Intake | `?series=` on volume, `?dimension=` on breakdown; both validated against one whitelist in `apps/reports/tickets.py`. `priority` is included as a fourth dimension — it is the one remaining `Ticket` enum the same code path serves for free, and § 25's row-2 chart is identical for it. |
| **A ticket's "channel" is its earliest inbound message's channel.** | This story's design, forced by `Ticket` having no channel field | `apps/reports/tickets.py::with_origin_channel()`, a `Subquery` annotation. Tickets with no inbound message (created in the staff UI) count under a translated **"Direct"** label, not dropped — 6 of 11 rows in this project's current database are exactly that, so dropping them would understate volume by more than half. |
| **Category bars sorted descending, never re-sorted client-side.** | § 25 line 1630, § 27 | `grouped_counts` orders `-count`; `BarChart` does not re-sort (`BarChart.tsx` docstring). |
| **Multi-series lines carry a distinct dash, not just a hue.** | § 25 line 1629 | Already in `LineChart.tsx`'s `SERIES_DASH` (line 12). Nothing to add — just do not pass more than 5 series. |
| **Every chart has a data-table fallback.** | § 25 lines 1638-1642, § 27 point 6 | `ChartFrame`'s `table` prop is required; both charts pass a `ChartDataTable`. |
| **A bucket is a calendar date — format it in UTC.** | This story's verified finding | Every `date(bucket, { dateStyle: 'medium', timeZone: 'UTC' })` call site. |
| **Reports are oversight: `admin` and `manager`, not `agent`.** | `tickets/migrations/0002`'s own comment, "managers need oversight" | `apps/reports/migrations/0001_grant_reports_permission.py`. |
| **The export param is `export`, never `format`.** | § 27 point 4 | Inherited from `BaseReportView`; the frontend's `downloadFile` call passes `{ export: 'csv', ... }`. |

**The verified origin-channel queryset**, run against this project's Postgres during planning — reproduce it before writing task 4:

```python
origin = Message.objects.filter(
    ticket=OuterRef("pk"), direction=Message.Direction.INBOUND
).order_by("created_at").values("channel")[:1]
qs = Ticket.objects.annotate(origin_channel=Subquery(origin))

grouped_counts(qs, field="origin_channel", include_null=True, null_label="direct")
# -> [{'key': 'direct', 'value': 6}, {'key': 'web_form', 'value': 5}]
grouped_counts(qs, field="origin_channel")
# -> [{'key': 'web_form', 'value': 5}]
```

Both branches work with **`grouped_counts` unchanged** — a `Subquery` alias is a valid `.values()` key and a valid `exclude(...__isnull=True)` target in Postgres. `bucketed_counts` is the one that breaks (`## Prerequisites`), and task 3 fixes it.

---

## Backend Tasks

### 1 — The permission constant

**File: `backend/apps/core/permissions.py`** — append one line to `Permissions` (after `SETTINGS_MANAGE`, line 37):

```python
    REPORTS_VIEW = "reports.view"
```

One constant, not a `REPORTS_MANAGE` pair: every report in EPIC 11 is read-only, and a permission no view declares must not exist (lines 5-7). `ALL_PERMISSIONS` (lines 40-44) derives itself from the class, so `PermissionCatalogView` and `RoleFormPage`'s checklist pick it up with no further edit.

---

### 2 — The grant migration

**Create file: `backend/apps/reports/migrations/0001_grant_reports_permission.py`**

Copy `apps/accounts/migrations/0006_grant_audit_log_permission.py` structurally — same `GRANTS` dict, same `grant`/`revoke` pair, same `RunPython`:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# admin and manager, NOT agent. `tickets/migrations/0002`'s own comment
# states this project's role reasoning: "agents work tickets day to day,
# managers need oversight". A cross-team volume report is oversight, not
# day-to-day queue work. Narrower than `tickets.view` on purpose — an
# agent can already see every ticket they need through the ticket list.
GRANTS = {
    "admin": [Permissions.REPORTS_VIEW],
    "manager": [Permissions.REPORTS_VIEW],
}
```

`dependencies` is the one thing that differs from the audit-log precedent — `apps.reports` has no prior migration and no model, so this is its `0001`:

```python
class Migration(migrations.Migration):
    # No `("reports", ...)` entry: this is the app's first migration. The
    # accounts dependency is what guarantees the seeded roles exist before
    # `grant` runs — same as tickets/0002 and accounts/0006.
    dependencies = [
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

An app with no models can carry a data migration — verified: `apps.reports` is already in `LOCAL_APPS` (`config/settings/base.py:67`) with an empty `migrations/__init__.py`.

---

### 3 — Fix `bucketed_counts`'s NULL series keys

**File: `backend/apps/reports/aggregation.py`** — this is a bug fix in Story 55's code, forced by this story being its first consumer. See `## Prerequisites` for the reproduced `TypeError`.

Add a `null_label` keyword to `bucketed_counts`'s signature (after `series_field`, line 122), mirroring `grouped_counts`'s existing one (line 173):

```python
    series_field: str | None = None,
    null_label: str = "",
```

Extend the docstring to state the policy, then change the two places that touch a series key. At **line 150**, map the NULL as the row is collected:

```python
        series_value = row[series_field] if series_field else None
        if series_field and series_value is None:
            series_value = null_label
        key = (bucket_date, series_value) if series_field else (bucket_date,)
```

and at **line 153**, the sort is then over strings only:

```python
    # Every series key is a string by this point (NULLs became `null_label`
    # above), so this sort cannot raise. It did before: a nullable
    # `series_field` — RPT-1's origin channel, RPT-3's `assigned_agent` —
    # made this `sorted()` compare str with None and TypeError. See Story 56
    # `## Prerequisites`.
    series_keys = sorted({key[1] for key in counts}) if series_field else [None]
```

Note the `if series_field` inside the set comprehension is also dropped — it was always constant within the branch, and reads as if it filtered something.

**Do not** change `grouped_counts`, `to_series`, or any signature's existing parameter order. `null_label` defaults to `""`, so every existing call keeps its behaviour.

---

### 4 — Ticket report domain helpers

**Create file: `backend/apps/reports/tickets.py`**

```python
"""Ticket-specific report queries — RPT-1.

`aggregation.py` deliberately "knows nothing about a ticket" (its own
docstring, lines 6-8): it takes a queryset and a field name. Everything
that DOES know what a ticket is lives here — which dimensions are
reportable, and how a ticket acquires a "channel" it has no field for.
The same split `apps/knowledge_base/search.py` and `apps/sla/policy.py`
already use: the app that owns the question implements the helper, the
view is a thin wrapper.
"""
```

Three module-level constants and two functions:

```python
# The dimensions `?series=`/`?dimension=` accept, mapped to the queryset
# field each resolves to. A whitelist, not `getattr` on user input: an
# arbitrary `?dimension=customer__email` would otherwise be a working
# data-extraction endpoint for anyone with `reports.view`.
DIMENSION_FIELDS = {
    "status": "status",
    "priority": "priority",
    "category": "category__name",
    "channel": ORIGIN_CHANNEL_FIELD,
}

# The annotation alias `with_origin_channel` adds. Named once so the
# whitelist above and the annotation below cannot drift.
ORIGIN_CHANNEL_FIELD = "origin_channel"

# A ticket created in the staff UI has no inbound message, so no origin
# channel — 6 of 11 rows in this project's current database. Counted under
# this key rather than dropped: dropping them would understate total volume
# by more than half, and "created directly" is itself a real answer to
# "where do our tickets come from". Translated for display on the frontend
# via the `channels.direct` locale key, NOT here — a report row carries a
# raw enum-ish value, the same rule `TicketActivity.from_value` follows.
DIRECT_CHANNEL = "direct"
```

(Declare `ORIGIN_CHANNEL_FIELD` and `DIRECT_CHANNEL` **above** `DIMENSION_FIELDS`; the ordering above is for reading, not for the file.)

`category` resolves to `category__name`, not `category_id` — a report axis must be labelled, and a bar chart of numeric ids is unreadable. `Ticket.category` is nullable (`SET_NULL`, `apps/tickets/models.py:65-72`), so a null category is handled by the same `null_label` path as a null channel.

```python
def parse_dimension(query_params, param: str, *, required: bool) -> str | None:
    """`?<param>=` as one of DIMENSION_FIELDS' keys.

    `required=False` (the volume report's `?series=`) returns None when the
    param is absent — one total line, not a split. `required=True` (the
    breakdown's `?dimension=`) raises rather than guessing which axis the
    caller meant. Either way an unknown value raises DRF `ValidationError`
    naming the valid keys, the same shape `parse_bucket` uses
    (`aggregation.py:104-112`).
    """


def with_origin_channel(queryset: QuerySet) -> QuerySet:
    """`queryset` annotated with `origin_channel` — the channel of each
    ticket's EARLIEST INBOUND message, or NULL when it has none.

    Inbound only: an agent's outbound reply says how we answered, not how
    the ticket arrived, and `Message.direction` has no default precisely
    because the two must never be interchangeable
    (`apps/communications/models.py:33-37`).

    A `Subquery`, not a persisted field: a stored `Ticket.origin_channel`
    would need a backfill migration plus an edit to every channel adapter's
    create path, to answer one report. Verified against this project's
    Postgres — the alias is a valid `.values()` key and a valid
    `exclude(...__isnull=True)` target, so `grouped_counts` consumes it with
    no change. See Story 56 `## Product rules`.
    """
    return queryset.annotate(
        origin_channel=Subquery(
            Message.objects.filter(
                ticket=OuterRef("pk"), direction=Message.Direction.INBOUND
            )
            .order_by("created_at")
            .values("channel")[:1]
        )
    )
```

Import `Message` from `apps.communications.models` and `Ticket` from `apps.tickets.models`. **Verify no import cycle before writing**: `apps.communications.models` imports `apps.tickets.models` (`communications/models.py:5`), and neither imports `apps.reports` — so `apps.reports.tickets` → both is a leaf, exactly like `apps/sla/policy.py`'s documented direction (`policy.py:6-10`).

---

### 5 — Ticket volume report view

**File: `backend/apps/reports/views.py`** — append below `BaseReportView`, importing what it needs at the top.

```python
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
```

Two details that matter:

- **`csv_columns` always includes `series`.** `rows_to_csv` writes an empty cell for a key a row lacks (`export.py:46`, `row.get(key, "")`), so the unsplit report exports a blank `Series` column rather than failing — the exact case that method's docstring (lines 35-36) was written for. Verified behaviour, not a hope.
- **`null_label` is dimension-dependent.** A missing channel means "created directly"; a missing category means "uncategorized". Passing one label for both would mislabel one of them.

`_` is `gettext_lazy`, imported at module top. `csv_columns` headers are evaluated lazily, so they localise per request via `LocaleMiddleware`.

---

### 6 — Ticket breakdown report view

**File: `backend/apps/reports/views.py`** — append below task 5's class.

```python
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
```

**The date filter is applied here, not by the helper.** `grouped_counts` has no date awareness by design (it is the "compare categories" half); `bucketed_counts` filters internally (`aggregation.py:141`). Do not add a date filter to `grouped_counts` — three other stories call it and would inherit a parameter they must then always pass.

`include_null=True` on both channel and category: see task 5's second bullet.

---

### 7 — URLs

**Create file: `backend/apps/reports/urls.py`**

```python
from django.urls import path

from .views import TicketBreakdownReportView, TicketVolumeReportView

app_name = "reports"

# No router: these are plain APIViews, not viewsets — the `path()`-only
# half of `apps/knowledge_base/urls.py`'s router-plus-path shape. Nested
# under `reports/tickets/` so RPT-2..RPT-5 add siblings
# (`reports/sla/`, `reports/agents/`, ...) rather than overloading these.
urlpatterns = [
    path("reports/tickets/volume/", TicketVolumeReportView.as_view(), name="ticket-volume"),
    path("reports/tickets/breakdown/", TicketBreakdownReportView.as_view(), name="ticket-breakdown"),
]
```

**File: `backend/config/api_urls.py`** — add one line after the `portal` include (line 22) and **before** the `re_path` catch-all (lines 23-25):

```python
    path("", include("apps.reports.urls")),
```

---

## Frontend Tasks

### 8 — Report types

**Create file: `frontend/src/features/reports/types/report.ts`**

```ts
/** One row from `/api/reports/tickets/volume/`. Mirrors
 * `apps/reports/aggregation.py::bucketed_counts` output. `bucket` is a
 * `YYYY-MM-DD` CALENDAR DATE, not an instant — always format it with
 * `{ timeZone: 'UTC' }`, or it renders as the previous day west of
 * Greenwich. See Story 56 `## Prerequisites`. */
export type VolumePoint = {
  bucket: string
  value: number
  /** Present only when `?series=` was sent. */
  series?: string
}

/** One row from `/api/reports/tickets/breakdown/`. Mirrors
 * `grouped_counts` output — already sorted descending server-side. */
export type BreakdownRow = {
  key: string
  value: number
}

/** The dimensions both endpoints accept, mirroring
 * `apps/reports/tickets.py::DIMENSION_FIELDS`. Re-declared here rather
 * than imported from `features/tickets`: `no-restricted-imports`
 * (`.oxlintrc.json`) forbids the cross-feature import, the same boundary
 * `features/tickets/types/ticket.ts:10` and CONVENTIONS.md line 1668
 * already document for duplicated enums. */
export const REPORT_DIMENSIONS = ['status', 'priority', 'category', 'channel'] as const
export type ReportDimension = (typeof REPORT_DIMENSIONS)[number]
```

### 9 — API layer

**Create file: `frontend/src/features/reports/api/reportKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const reportKeys = featureKey('reports')
```

**Create file: `frontend/src/features/reports/api/getTicketVolume.ts`**

```ts
export type TicketVolumeParams = {
  from?: string
  to?: string
  bucket?: 'day' | 'week' | 'month'
  series?: ReportDimension
}

export function getTicketVolume(params: TicketVolumeParams): Promise<VolumePoint[]> {
  return api.get<VolumePoint[]>('/reports/tickets/volume/', { params })
}
```

`api.get`, not `api.getPage` — neither endpoint paginates (`## Story Goal`), so there is no `meta.pagination` and `getPage` would throw `invalid_envelope` (`shared/lib/api/client.ts:166-171`).

**Create file: `frontend/src/features/reports/api/useTicketVolume.ts`** — `useQuery` on `reportKeys.resource('ticket-volume', params)`.

**Create file: `frontend/src/features/reports/api/getTicketBreakdown.ts`** — same shape, `TicketBreakdownParams = { from?, to?, dimension: ReportDimension }`, returning `BreakdownRow[]`.

**Create file: `frontend/src/features/reports/api/useTicketBreakdown.ts`** — `useQuery` on `reportKeys.resource('ticket-breakdown', params)`.

**Create file: `frontend/src/features/reports/api/exportReport.ts`**

```ts
import { downloadFile } from '@/shared/lib/download'

/** `?export=csv` on the same URL and params the chart already reads, so the
 * file and the chart can never disagree (CONVENTIONS.md § 27 point 5). The
 * param is `export`, NOT `format` — § 27 point 4. */
export function exportReport(
  path: string,
  filename: string,
  params: Record<string, unknown>,
): Promise<void> {
  return downloadFile(path, `${filename}.csv`, { ...params, export: 'csv' })
}
```

`downloadFile`'s `filename` is used verbatim as the `download` attribute, so `.csv` is appended here (the backend appends its own to `Content-Disposition`, which the object-URL path does not read).

### 10 — The report screen

**Create file: `frontend/src/features/reports/components/TicketReportsPage.tsx`**

Follow `AuditLogListPage.tsx`'s shape — `PageHeader` with no action, a filter row of `Select`s above the content, `"all"`-style sentinels where a filter is optional. Local state:

```tsx
const [from, setFrom] = useState('')          // '' = server default (last 30 days)
const [to, setTo] = useState('')
const [bucket, setBucket] = useState<'day' | 'week' | 'month'>('day')
const [series, setSeries] = useState('none')  // 'none' sentinel = one total line
const [dimension, setDimension] = useState<ReportDimension>('status')
```

Two date `<Input type="date">` controls (`shared/ui/primitives/input`) with `aria-label`s, and three `Select`s (bucket, series, dimension) matching `TicketListPage.tsx:152-190`'s markup exactly — `size="sm"` on every `SelectTrigger`, `aria-label` on each, `SelectValue` with no placeholder.

Build the params once and share them between the query and the export button, so they cannot drift:

```tsx
const volumeParams = {
  ...(from ? { from } : {}),
  ...(to ? { to } : {}),
  bucket,
  ...(series !== 'none' ? { series: series as ReportDimension } : {}),
}
const volumeQuery = useTicketVolume(volumeParams)
```

**Volume chart** — `ChartFrame` wrapping `LineChart`:

```tsx
<ChartFrame
  title={t('volume.title')}
  description={t('volume.description')}
  query={volumeQuery}
  isEmpty={(rows) => rows.every((row) => row.value === 0)}
  action={
    <Button variant="outline" size="sm" onClick={() => void handleExportVolume()}>
      <DownloadIcon />
      {t('actions.exportCsv')}
    </Button>
  }
  table={(rows) => (
    <ChartDataTable
      caption={t('chart.dataTableCaption', { ns: 'common', title: t('volume.title') })}
      columns={seriesColumns}
      rows={rows.map((row) => [...])}
    />
  )}
>
  {(rows) => <LineChart series={toChartSeries(rows)} formatBucket={formatBucket} />}
</ChartFrame>
```

`isEmpty` is `rows.every(row => row.value === 0)`, **not** `rows.length === 0` — after gap-filling the array is never empty, which `ChartFrame`'s own `isEmpty` prop comment and Story 55's `## Edge Cases` both call out.

Three local helpers in this file:

- `formatBucket(bucket: string)` → `date(bucket, { dateStyle: 'medium', timeZone: 'UTC' })`. **The `timeZone` is mandatory** — see `## Prerequisites`. Used for the axis labels, the tooltips, and the data table's first column.
- `toChartSeries(rows: VolumePoint[]): ChartSeries[]` — group by `row.series` into `ChartSeries[]`, the frontend twin of `to_series`. When `series === 'none'` every row lacks `series`, so produce a single series keyed `'total'` with `label: t('volume.allTickets')`. Cap at **5 series** and drop the rest with a note in the code comment: `LineChart`'s `SERIES_DASH` has 5 entries (`LineChart.tsx:12`) and `--chart-1..5` has 5 colors, so a 6th line would silently repeat both and violate § 25's "never color alone".
- `labelForDimensionValue(dimension, key)` — translates a raw backend value for display: `status`/`priority` through `t('statuses.<key>')`/`t('priorities.<key>')` in this feature's own namespace, `channel` through `t('channels.<key>')` (including `channels.direct`), and `category` returned as-is (a category name is user data, not a translatable key).

**Breakdown chart** — a second `ChartFrame` wrapping `BarChart`, `orientation="vertical"`, `categories={rows.map(row => ({ key: row.key, label: labelForDimensionValue(dimension, row.key), value: row.value }))}`. Do **not** re-sort (§ 25 line 1630).

### 11 — Locales

**Create files: `frontend/src/features/reports/locales/en.json` and `ar.json`** — identical key sets. English:

```json
{
  "title": "Ticket Reports",
  "volume": {
    "title": "Ticket volume over time",
    "description": "Tickets created in the selected period.",
    "allTickets": "All tickets"
  },
  "breakdown": {
    "title": "Tickets by {{dimension}}",
    "description": "Ticket counts for the selected period, highest first."
  },
  "filters": {
    "from": "From",
    "to": "To",
    "bucket": "Group by",
    "series": "Split by",
    "noSeries": "No split",
    "dimension": "Breakdown by"
  },
  "buckets": { "day": "Day", "week": "Week", "month": "Month" },
  "dimensions": {
    "status": "Status",
    "priority": "Priority",
    "category": "Category",
    "channel": "Channel"
  },
  "statuses": {
    "open": "Open",
    "in_progress": "In progress",
    "resolved": "Resolved",
    "closed": "Closed"
  },
  "priorities": { "low": "Low", "medium": "Medium", "high": "High", "urgent": "Urgent" },
  "channels": {
    "email": "Email",
    "whatsapp": "WhatsApp",
    "chat": "Live chat",
    "sms": "SMS",
    "web_form": "Web form",
    "direct": "Created directly"
  },
  "fields": { "period": "Period", "series": "Series", "value": "Tickets" },
  "actions": { "exportCsv": "Export CSV" }
}
```

The `statuses`/`priorities`/`channels` blocks duplicate copy that exists in `features/tickets/locales/` — the same forced duplication as the type constants (task 8), for the same lint-rule reason. Arabic mirrors it: `"التقارير"`-style translations for the new strings, and the **existing** Arabic wording copied verbatim from `features/tickets/locales/ar.json` (`statuses` lines 23-28, `priorities` 29-34, `conversation.channels` 96-102) for those three blocks, so the two screens never disagree in Arabic. `channels.direct` is new: `"أُنشئت مباشرة"`.

### 12 — Namespace registration

**File: `frontend/src/shared/i18n/resources.ts`** — two imports (alphabetically, `portal` then `reports` then `tasks`) and one line per language:

```ts
import reportsAr from '@/features/reports/locales/ar.json'
import reportsEn from '@/features/reports/locales/en.json'
```

then `reports: reportsEn,` in the `en` block and `reports: reportsAr,` in `ar`. This file is exempt from `no-restricted-imports` (`.oxlintrc.json` overrides, lines 36-41).

### 13 — Route

**File: `frontend/src/app/router.tsx`** — a new block after the `tickets.manage` categories block (which ends at line 322) and before the `audit_log.view` block:

```tsx
{
  element: <RequirePermission permission="reports.view" />,
  children: [
    {
      path: 'reports/tickets',
      lazy: async () => {
        const { TicketReportsPage } =
          await import('@/features/reports/components/TicketReportsPage')
        return { element: <TicketReportsPage /> }
      },
    },
  ],
},
```

`reports/tickets`, not `reports` — `RPT-2`…`RPT-5` add siblings under the same prefix, matching the API's own shape. No index redirect at `/reports`: nothing to redirect to until a second report exists.

### 14 — Sidebar link

**File: `frontend/src/app/Sidebar.tsx`** — add `ChartNoAxesColumnIcon` to the `lucide-react` import block (lines 2-17, alphabetically after `ChevronsRightIcon`), add `'reports'` to the `useTranslation` namespace array (lines 75-84), and a new block before the `audit_log.view` block (line 193):

```tsx
<Can permission="reports.view">
  <SidebarLink
    to="/reports/tickets"
    icon={ChartNoAxesColumnIcon}
    label={t('reports:title')}
    collapsed={collapsed}
  />
</Can>
```

`ChartNoAxesColumnIcon` is a verified export of the installed `lucide-react@1.34.0` (`dist/esm/lucide-react.mjs:38`) and is already used by `ChartFrame.tsx`'s empty state.

---

## Documentation Tasks

### 15 — Conventions

**File: `CONVENTIONS.md` § 27 (Reporting)** — add two points to the existing numbered list, keeping the section's tone:

8. **A report's dimensions are a whitelist, never a field name off the query string.** `apps/reports/tickets.py::DIMENSION_FIELDS` maps the four wire values to queryset fields; `parse_dimension` rejects everything else. An endpoint that resolved `?dimension=` directly would be a general-purpose data-extraction API for anyone with `reports.view`.
9. **A bucket is a calendar date, so format it in UTC.** `bucketed_counts` emits `YYYY-MM-DD`, which JS parses as UTC midnight — rendered through `useFormatters().date()` with no options it shows the **previous day** anywhere west of Greenwich (verified: `'2026-01-01'` → "Dec 31, 2025" in `America/New_York`). Every bucket label passes `{ dateStyle: 'medium', timeZone: 'UTC' }`.

Also amend **point 2** (gap-filling) with one sentence recording the `null_label` fix: *a nullable `series_field` maps NULL to `null_label` before the series keys are sorted — without it the sort compares `str` with `None` and raises (`RPT-1`'s origin channel, `RPT-3`'s `assigned_agent`).*

---

## Edge Cases & Failure Modes

- **`?series=channel` on a database where some tickets have no inbound message** → the `Subquery` yields NULL; task 3's `null_label` maps it to `"direct"` before the sort. **Without task 3 this is a 500, not a 400** — verified `TypeError`, `## Prerequisites`. Checked directly in `## Verification Steps` step 4.
- **`?dimension=` omitted on the breakdown endpoint** → `400` naming the four valid values, from `parse_dimension(required=True)`. Not a silent default to `status`.
- **`?dimension=customer__email`** (or any non-whitelisted value) → `400`, from the same whitelist. This is the security-relevant case: `grouped_counts` interpolates `field` straight into `.values()`, so an unvalidated dimension is an arbitrary-column read.
- **`?series=` and `?dimension=` sent to the wrong endpoint** → ignored, silently. Each view reads only its own param. Acceptable: they are separate endpoints with separate contracts, and erroring on an unknown query param is not a convention this API has anywhere.
- **A dimension with more than 5 distinct values, split as a line series** (`category`, once a few exist) → the 6th line would reuse `--chart-1` *and* `SERIES_DASH[0]`, making two series pixel-identical and breaking § 25's "never color alone". `toChartSeries` caps at 5 (task 10). The breakdown Bar chart has no such cap — bars carry their own text labels, so a repeated hue is not ambiguous there.
- **`?bucket=month` over a 30-day default range** → 1 or 2 rows, depending on where the range straddles a month boundary. Correct, not a bug: `_bucket_starts` snaps to day 1 (`aggregation.py:229-232`).
- **A range spanning more than `MAX_RANGE_DAYS` (366)** → `400` from `parse_date_range` (`aggregation.py:78-85`), inherited. The date inputs do not prevent it client-side; the server error surfaces through `ChartFrame`'s `ErrorState`.
- **Empty period** → every gap-filled row has `value: 0`, so `rows.length` is nonzero and `ChartFrame`'s empty state needs `rows.every(r => r.value === 0)`. Getting this wrong renders a flat zero line instead of the empty state — visually plausible and therefore easy to miss.
- **Bucket label off by one day** → the `timeZone: 'UTC'` requirement, `## Prerequisites`. Note this is **invisible** to anyone testing from UTC or any positive offset, which is most of this project's likely reviewers — it must be checked by overriding the timezone, not by looking.
- **A category named with a comma, or an Arabic category name, in the CSV** → handled by `csv.writer` quoting and the UTF-8 BOM respectively, both already in `export.py`. Re-verified here because this story is the first to export real user-entered text (Story 55 only exported synthetic rows).
- **The unsplit volume CSV** → the `series` column is present in the header and empty in every row, via `row.get(key, "")` (`export.py:46`). Deliberate; the alternative is two `csv_columns` tuples chosen at request time, which makes the export shape depend on a query param.
- **`reports.view` granted to a role but the sidebar link absent** → `Can` reads the permission list from `/auth/me/`, which is cached per session; a user granted the permission mid-session sees the link after their next token refresh. Existing behaviour of every `<Can>` gate, not introduced here.
- **An agent-role user navigating directly to `/reports/tickets`** → `RequirePermission` redirects to `/` (`shared/auth/RequirePermission.tsx:28`). The API independently returns `403`, so the redirect is UX, not the boundary (`CONVENTIONS.md` § 12).

---

## Test Plan

Per standing project policy this project authors no automated tests (`CONVENTIONS.md` § 16). This story adds none.

Its checks are: `manage.py check`, `makemigrations --check` (the grant migration must be the *only* new one — a schema migration here would mean an accidental model change), `migrate` applied and the grant verified in the database, `ruff`; direct `manage.py shell` exercise of `with_origin_channel`/`parse_dimension` and of the task-3 fix in both its crashing and fixed forms; real HTTP across all four dimensions × both endpoints × three permission states, plus both CSV exports; the frontend's `lint`/`format:check`/`check:rtl`/`build`; an `en`/`ar` key-set diff; and a bilingual walkthrough including an explicit non-UTC timezone check. All below.

---

## Verification Steps

1. **Backend gates:** from `backend/` — `python manage.py check`; `python manage.py makemigrations --check --dry-run` must report **no changes** *after* task 2's file exists (if it reports a pending migration, a model was changed by accident); `ruff check apps/ && ruff format --check apps/`.
2. **Migration applies and grants correctly:** `python manage.py migrate reports`, then:
   ```python
   from apps.accounts.models import Role
   print({r.slug: ("reports.view" in r.permissions) for r in Role.objects.all()})
   # -> admin True, manager True, agent False, customer False
   ```
   Then `python manage.py migrate reports zero` and re-check that all four are `False`, confirming `revoke` is real; re-apply before continuing.
3. **The task-3 fix, both directions.** In `manage.py shell`, reproduce the crash against the *pre-fix* behaviour by passing `null_label=""` explicitly is not possible (the fix maps NULL regardless), so verify the fix positively:
   ```python
   from apps.reports.aggregation import bucketed_counts, parse_date_range
   from apps.reports.tickets import with_origin_channel
   from apps.tickets.models import Ticket
   start, end = parse_date_range({})
   rows = bucketed_counts(with_origin_channel(Ticket.objects.all()), date_field="created_at",
                          start=start, end=end, series_field="origin_channel", null_label="direct")
   print(sorted({r["series"] for r in rows}))   # includes 'direct', no TypeError
   assert sum(r["value"] for r in rows) == Ticket.objects.filter(
       created_at__gte=start, created_at__lt=end).count()
   ```
   The `sum` assertion is what proves the NULL rows were **relabelled, not dropped**.
4. **Origin channel derivation:** in the same shell, confirm `grouped_counts(with_origin_channel(Ticket.objects.all()), field="origin_channel", include_null=True, null_label="direct")` returns the two-key result recorded in `## Product rules`, and spot-check one ticket by hand: `Ticket.objects.get(pk=<id>).messages.filter(direction="inbound").order_by("created_at").first().channel` must equal its annotated `origin_channel`.
5. **Real HTTP, all dimensions, with a `manager` token.** For each of `status`, `priority`, `category`, `channel`:
   `GET /api/reports/tickets/volume/?series=<d>` → `200`, enveloped array, every bucket present.
   `GET /api/reports/tickets/breakdown/?dimension=<d>` → `200`, descending by `value`.
   Then the error cases: `breakdown/` with no `dimension` → `400`; `?dimension=customer__email` → `400`; `volume/?series=nonsense` → `400`; `volume/?bucket=quarter` → `400` (inherited); `volume/?from=2020-01-01&to=2026-01-01` → `400` (inherited).
6. **Permission states.** The same two URLs with: an `admin` token → `200`; an `agent` token (has `tickets.view`, not `reports.view`) → **`403`**; no token → `401`. The agent case is the one that proves task 2's grant list is right.
7. **CSV export, both endpoints.** `GET /api/reports/tickets/volume/?series=channel&export=csv` → `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="ticket-volume.csv"`, body starts with the UTF-8 BOM. `GET /api/reports/tickets/volume/?export=csv` (no `series`) → the `Series` column header present, every row's cell empty. `GET /api/reports/tickets/breakdown/?dimension=category&export=csv` after creating a category whose name contains a comma and one in Arabic → open in Excel and confirm the comma name occupies **one** cell and the Arabic name renders as Arabic.
8. **Frontend gates:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`, all clean.
9. **Locale key parity:** diff the key paths of `features/reports/locales/en.json` against `ar.json` — identical sets. Also confirm the `statuses`/`priorities`/`channels` **values** match `features/tickets/locales/ar.json`'s existing Arabic wording for the keys they share.
10. **Bilingual walkthrough.** `npm run dev`, signed in as `admin` or `manager`. Open `/reports/tickets` from the new sidebar link: both charts render; change **Group by** to Week and Month and confirm the x axis re-buckets; change **Split by** through all four dimensions and confirm the line count and legend change, and that `channel` shows a "Created directly" line; change **Breakdown by** through all four and confirm the bars re-label and stay descending. Set an explicit From/To range. Click **Export CSV** on each chart and confirm a file downloads. Toggle **Show data table** on both and confirm the fallback table matches the chart. Then switch to **Arabic** and repeat once — every string translated (no raw `reports.*` keys), the line chart's time axis running right-to-left, and bars laid out RTL.
11. **The timezone trap, explicitly.** This cannot be seen from a UTC machine. In DevTools → ⋮ → More tools → **Sensors** → Location, pick a US location (or run the browser with `TZ=America/New_York`), reload `/reports/tickets`, and confirm the **first bucket label matches the `from` date you selected** rather than the day before it. Cross-check one label against the raw JSON in the Network tab.
12. **Permission boundary in the browser.** Sign in as an `agent`-role user: the "Ticket Reports" sidebar link is absent, and navigating to `/reports/tickets` directly redirects to `/`.

---

## Done Criteria

- [ ] `Permissions.REPORTS_VIEW = "reports.view"` added to `apps/core/permissions.py`; no `REPORTS_MANAGE`.
- [ ] `apps/reports/migrations/0001_grant_reports_permission.py` — grants to `admin` and `manager` only, with a working `revoke`, depending on `("accounts", "0003_seed_roles")`. It is the **only** new migration.
- [ ] `apps/reports/aggregation.py::bucketed_counts` gained a `null_label` keyword and no longer raises `TypeError` on a nullable `series_field`; `grouped_counts`/`to_series` unchanged; every existing call site's behaviour unchanged (`null_label` defaults to `""`).
- [ ] `apps/reports/tickets.py` — `DIMENSION_FIELDS` whitelist, `ORIGIN_CHANNEL_FIELD`, `DIRECT_CHANNEL`, `parse_dimension`, `with_origin_channel`. No import cycle.
- [ ] `TicketVolumeReportView` and `TicketBreakdownReportView` in `apps/reports/views.py`, each declaring `permission_map = {"get": Permissions.REPORTS_VIEW}`, `csv_columns`, and `csv_filename`; `BaseReportView` itself unchanged.
- [ ] `apps/reports/urls.py` created; one `include()` line added to `config/api_urls.py`, **before** the `ApiNotFoundView` catch-all.
- [ ] `features/reports/` — `types/report.ts`, five `api/` files plus `reportKeys.ts`, `components/TicketReportsPage.tsx`, `locales/{en,ar}.json`. No import from `features/tickets`.
- [ ] Both charts render inside `ChartFrame` with a required `ChartDataTable` fallback; `isEmpty` is `rows.every(r => r.value === 0)`, not a length check; the line series is capped at 5; the breakdown is never re-sorted client-side.
- [ ] Every bucket label formatted with `{ dateStyle: 'medium', timeZone: 'UTC' }`.
- [ ] Export buttons call `exportReport`, which sends `export: 'csv'` (never `format`) with the **same** params the chart query used.
- [ ] `reports` namespace registered in `shared/i18n/resources.ts`; route added to `router.tsx` gated on `reports.view`; sidebar link added with `'reports'` in the `useTranslation` array.
- [ ] `CONVENTIONS.md` § 27 gained points 8 and 9, and point 2 gained the `null_label` sentence.
- [ ] Verified by shell: the task-3 fix relabels rather than drops NULLs (sum-equals-count, step 3), and `origin_channel` matches a hand-checked ticket (step 4).
- [ ] Verified by real HTTP: all four dimensions on both endpoints, all five `400` cases, three permission states including an `agent` `403` (steps 5-6), and both CSV exports including a comma-containing and an Arabic category name (step 7).
- [ ] Verified in the browser: bilingual + RTL walkthrough of both charts and every filter (step 10), the non-UTC bucket-label check (step 11), and the agent-role redirect (step 12).
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 57 (`RPT-2`, SLA Performance).**
