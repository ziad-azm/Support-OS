# Story 57 — SLA Performance (Story: SUPPORTOS-78)

## Prerequisites

- **`SLA-1` (Response & Resolution Targets, Story 28, `SUPPORTOS-50`) completed** — the intake names it (`Dependencies: SLA-1`). `apps/sla/models.py::SLAPolicy`, `apps/sla/policy.py::resolve_policy`/`compute_sla_status`, and `apps/organization/models.py::OrganizationSettings.default_response_target_minutes`/`default_resolution_target_minutes` all exist and are reused, not re-derived.
- **`RPT-0`/`RPT-1` (Stories 55/56) completed.** `apps/reports/aggregation.py` (`BUCKETS`, `DATE_FORMAT`, `parse_date_range`, `parse_bucket`), `apps/reports/export.py::csv_response`, `apps/reports/views.py::BaseReportView`, `frontend/src/shared/ui/chart/` (`ChartFrame`, `LineChart`, `ChartDataTable`), and `Permissions.REPORTS_VIEW` (`apps/core/permissions.py:38`) all exist. **This story adds no new permission and no new migration** — SLA reports are gated by the same `reports.view` Story 56 already granted to `admin`/`manager`.
- **`compute_sla_status` is single-ticket and does two extra queries per call** (`apps/sla/policy.py:90-108`: a `Message` lookup, a `TicketActivity` lookup). Story 28's own `## Prerequisites` (point 13) explicitly flagged this as an N+1 risk across a list and deferred batching it: *"A future story can add this once there is a batching strategy (e.g. an annotated queryset or a cached field) worth its own design pass."* **This story is that future story.** It does not call `compute_sla_status` in a loop; it reimplements the same classification against a bulk-annotated queryset, verified to produce identical results (below).
- **Verified live, bulk SLA computation with zero N+1.** Reproduced against this project's Postgres — the same `Subquery`-annotation technique `apps/reports/tickets.py::with_origin_channel` already established (Story 56), applied twice (first response, first resolution):
  ```python
  first_response = Message.objects.filter(ticket=OuterRef("pk"), direction=Message.Direction.OUTBOUND
                    ).order_by("created_at").values("created_at")[:1]
  resolved_activity = TicketActivity.objects.filter(ticket=OuterRef("pk"), kind=TicketActivity.Kind.STATUS_CHANGED,
                    to_value__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED]
                    ).order_by("created_at").values("created_at")[:1]
  qs = Ticket.objects.filter(created_at__gte=start, created_at__lt=end).annotate(
      first_response_at=Subquery(first_response), resolved_at=Subquery(resolved_activity),
  ).values("id", "created_at", "priority", "category_id", "first_response_at", "resolved_at")
  ```
  This is **3 queries total regardless of ticket count** (one for `SLAPolicy.objects.all()`, one for `OrganizationSettings.load()`, one for the annotated `.values()` above) — not `2N+1`. Cross-checked against ticket 66 in this project's live database: the bulk row's `first_response_at`/`resolved_at` matched `compute_sla_status(ticket)`'s own `response_status`/`resolution_status` classification exactly (`breached`/`met`), and a full dry run over the current 30-day default range produced `response breach rate: 0.818`, `resolution breach rate: 0.909` (11 tickets, all falling back to the org-wide default policy of 100/200 minutes — no `SLAPolicy` rows are configured in this database today).
- **The response/resolution TREND is an average, not a count — `bucketed_counts` does not apply, and its gap-fill rule does not either.** `aggregation.py::bucketed_counts` (lines 115-180) fills empty buckets with `value: 0`, which is correct for a *count* (zero tickets is a real, meaningful zero) but wrong for an *average* (zero minutes would claim instant response/resolution where there is actually no data). This story's trend function therefore **omits** a bucket with no achieved values rather than gap-filling it — a deliberate, documented exception to `CONVENTIONS.md` § 27 point 2, recorded in task 8 below. It still reuses `aggregation.py`'s `BUCKETS`/`DATE_FORMAT` constants and the exact same `Trunc*(field, tzinfo=...)` annotation technique `bucketed_counts` uses (line 150), so the bucket boundaries are computed identically everywhere in this app.
- **`apps/sla/policy.py::_dimension_status` (lines 65-74) is promoted to a public `dimension_status`** — a one-line rename plus updating its two call sites (lines 116, 118) inside the same file. This lets the bulk computation below classify `met`/`breached`/`pending` with the **exact same function** `compute_sla_status` uses for a single ticket, so the two paths can never silently disagree. No behavior change; verified by the fact that its only two callers are in the same file being edited.
- **`CONVENTIONS.md` § 25's breach-rate row (line 1632) is the first real consumer of the Gauge/Bullet chart type Story 55 deliberately deferred** (`55-story-reporting-foundation-SUPPORTOS-76.md` `## Story Goal`, "Not here, and why": *"Each has exactly one first consumer... built inside `ChartFrame` by the stories that need them"*). **It is not a single-consumer component, though**: § 25's own `RPT-5` row (line 1636) says *"RPT-5 reuses RPT-0's charts... not a new chart type"* for the identical Bullet/Gauge visual — so this story's `GaugeChart` has **two** real consumers (`RPT-2` now, `RPT-5` later), the same two-or-more-consumer threshold that put `LineChart`/`BarChart` in `shared/ui/chart/` in the first place (`no-restricted-imports`, `.oxlintrc.json:8-18`, forbids a `features/reports/`-local component from being reused by a future `features/dashboards/`-style RPT-5 screen). `GaugeChart` is therefore added to `shared/ui/chart/`, not to `features/reports/`.
- **No new `Ticket`/`SLAPolicy` model field, no schema migration, no new permission.** Every value this story reports is already computable from existing tables; the only backend additions are two view classes, one domain module, and a promoted function name.

---

## Story Goal

The SLA half of `RPT-0`'s data — two reports, both against the same bulk-computed SLA status:

1. **SLA metrics API** — two endpoints under `/api/reports/sla/`, both `BaseReportView` subclasses:
   - `GET /api/reports/sla/trend/` — average response time and average resolution time (minutes), one point per time bucket, two series (`response`, `resolution`). Feeds `LineChart` (§ 25 row 3, "Trend Over Time") — the **same component** `RPT-1`'s volume trend uses, no new frontend chart needed for this half.
   - `GET /api/reports/sla/breach-rate/` — breach rate for each of `response`/`resolution` over the whole selected range, with the underlying `met`/`breached`/`pending` counts. Feeds the new `GaugeChart` (§ 25 row 4, "Performance vs Target").
2. **Report UI** — a `/reports/sla` screen: a date-range control (no `?bucket=`/dimension picker beyond the trend's bucket size — SLA has exactly two fixed dimensions, response and resolution, always both shown), the trend line chart, and a two-gauge breach-rate panel, each with a CSV export button and the mandatory data-table fallback.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/reports/sla.py` | The domain half — bulk policy resolution and the two metric functions. `aggregation.py` stays generic; this mirrors `apps/reports/tickets.py`'s existing split. |
| `dimension_status` promotion | So the bulk path and the single-ticket path (`TicketViewSet.sla`, `apps/tickets/views.py:277-287`) can never classify the same due-date/achieved-date pair differently. |
| `GaugeChart` in `shared/ui/chart/` | § 25's own Bullet/Gauge row, now real — two consumers (`RPT-2`, `RPT-5`) per `no-restricted-imports`, the same threshold that placed `LineChart`/`BarChart` there. |
| Reusing `LineChart` for the trend | The SLA trend is structurally identical to `RPT-1`'s volume trend — a bucket, a series name, a value — so no new time-series chart is needed. |

**Not here, and why:**

- **No per-priority or per-category SLA breakdown.** The intake names "response/resolution times, breach rates" only — two fixed dimensions, not a user-selectable one like `RPT-1`'s `?series=`/`?dimension=`. A future drill-in (e.g. "breach rate by priority") is a natural follow-up, not this story's scope.
- **No "at risk" tier.** `dimension_status` returns exactly `met`/`breached`/`pending`, per `SLA-1`'s own established vocabulary (`apps/sla/policy.py:65-74`) — `SLA-3`'s escalation rules own "at risk" (Story 28 `## Prerequisites`, point re-cited in `apps/sla/models.py:146-155`).
- **No SLA-policy management screen.** `SLAPolicyAdmin` (Django admin) is `SLA-1`'s config UI and remains the only one — this story only *reads* policies, never writes them.
- **No target-threshold configuration UI.** The Gauge's good/warn/bad zone boundaries are fixed constants in `GaugeChart.tsx` (task 6), not read from `OrganizationSettings` or any other config — no such "acceptable breach rate" setting exists anywhere in this codebase today, and inventing one is a product decision beyond this story's scope.
- **No caching, no Celery pre-aggregation.** Same standing rule as `RPT-0`/`RPT-1` (`aggregation.py:15-18`).
- **No change to `TicketViewSet.sla`, `TicketSlaSection`, or any other `SLA-1` frontend surface.** This story adds a report; it does not touch the existing per-ticket SLA badge feature.

---

## Context — Read These Files First

1. `.squad/stories/reports-analytics/SUPPORTOS-78/intake.md` — one task (*"SLA metrics API + report UI... via RPT-0"*), dependency `SLA-1`, **no acceptance criteria, no attachments**.
2. [`55-story-reporting-foundation-SUPPORTOS-76.md`](55-story-reporting-foundation-SUPPORTOS-76.md) and [`56-story-ticket-reports-SUPPORTOS-77.md`](56-story-ticket-reports-SUPPORTOS-77.md) — read both `## Prerequisites` sections; this story inherits the `?export=csv` trap, the flat-list-of-dicts CSV contract, and the UTC-bucket-formatting rule from both.
3. `backend/apps/sla/policy.py` (119 lines) — read end to end. `resolve_policy` (24-41, the two-tier specificity lookup this story's bulk resolver mirrors exactly), `_org_default_policy` (44-62), `_dimension_status` (65-74, **task 1 renames this**), `compute_sla_status` (77-119, **note lines 116 and 118**, the two call sites task 1 updates).
4. `backend/apps/sla/models.py:9-76` — `SLAPolicy`: `priority` (18, reuses `Ticket.Priority.choices` directly), `category` (26-33, nullable `CASCADE` — `null=True` means "no override", a different meaning from `Ticket.category`'s own nullable FK), `response_target_minutes`/`resolution_target_minutes` (34-43), the `unique_sla_policy_priority_category` constraint (48-51) — this is what makes `{(priority, category_id): policy}` a safe, collision-free dict key in task 2.
5. `backend/apps/organization/models.py:15-99` — `OrganizationSettings.load()` (96-99, singleton `get_or_create(pk=1)`), `default_response_target_minutes`/`default_resolution_target_minutes` (49-54, both nullable — the org-wide fallback is opt-in).
6. `backend/apps/tickets/models.py` — `Ticket.Status.RESOLVED`/`CLOSED` (34-38), `TicketActivity.Kind.STATUS_CHANGED` and `from_value`/`to_value` (Story 24) — the exact values task 2's `resolved_activity` subquery filters on, identical to `compute_sla_status`'s own filter (`policy.py:100-104`).
7. `backend/apps/communications/models.py:16-38` — `Message.Direction.OUTBOUND` — task 2's `first_response` subquery filters on this, identical to `compute_sla_status`'s own filter (`policy.py:91`).
8. `backend/apps/reports/tickets.py` (87 lines) — read end to end. The exact `Subquery`/`OuterRef` annotation shape (`with_origin_channel`, lines 65-86) task 2's two subqueries copy verbatim in structure, and the module-docstring split ("`aggregation.py` knows nothing about a ticket... everything domain-specific lives here") this story's `apps/reports/sla.py` follows for SLA instead.
9. `backend/apps/reports/aggregation.py` — `BUCKETS`/`DEFAULT_BUCKET` (34-39), `DATE_FORMAT` (48), `bucketed_counts` (115-180, **read to see the annotation technique at line 150 that task 2 copies for the trend's bucket key, and to see why its `value: 0` gap-fill (129-133) does NOT apply to an average**), `grouped_counts` (183-219).
10. `backend/apps/reports/views.py` (122 lines) — `BaseReportView` (38-56, note `csv_columns`/`csv_filename`/`get_report` hook), `TicketVolumeReportView` (59-93) and `TicketBreakdownReportView` (96-121) — task 3/4's two new classes follow this exact shape, appended after line 121.
11. `backend/apps/reports/urls.py` (14 lines) — the `path()`-only shape (no router) task 5 extends with two more entries under a new `reports/sla/` prefix, sibling to the existing `reports/tickets/` prefix.
12. `backend/apps/core/permissions.py:38` — `REPORTS_VIEW = "reports.view"`, already granted to `admin`/`manager` by `apps/reports/migrations/0001_grant_reports_permission.py` (Story 56). **No new grant migration in this story.**
13. `backend/apps/tickets/views.py:277-287` — `TicketViewSet.sla`, the existing single-ticket SLA action. Read this to confirm this story does not touch it, and to see the shape `compute_sla_status` was designed around.
14. `frontend/src/shared/ui/chart/ChartFrame.tsx` (101 lines) — the `table` prop is **required** (line 26); `BarChart.tsx` (127 lines) — the exact `colorFor`/`viewBox`/`role="img"`/`<title>` SVG shape task 6's `GaugeChart` copies (colors differ; geometry pattern does not).
15. `frontend/src/shared/i18n/useDirection.ts` — `GaugeChart` needs this for the same reason `LineChart`/`BarChart` do: the bar's fill direction must reverse under `dir="rtl"`.
16. `frontend/src/features/reports/components/TicketReportsPage.tsx` (257 lines) — read end to end. This story's `SlaReportsPage.tsx` copies its date-range `Input`/`Label` block (lines 118-140) verbatim and its `ChartFrame`+chart+`table` composition shape (lines 171-202) for the trend half; the breach-rate half is new (task 9).
17. `frontend/src/features/reports/api/getTicketVolume.ts`/`useTicketVolume.ts`, `api/exportReport.ts`, `api/reportKeys.ts` — the exact `api.get`/`useQuery`/`reportKeys.resource(...)` shape task 7's four new API files follow one-for-one.
18. `frontend/src/features/reports/types/report.ts` (27 lines) — `VolumePoint`/`ReportDimension` shape; task 7 adds sibling types in a new `types/sla.ts` rather than extending this file (SLA rows are a different domain concept, not a `ReportDimension`).
19. `frontend/src/app/router.tsx` — the `reports.view`-gated block added by Story 56 (search for `permission="reports.view"`); task 10 adds a sibling `reports/sla` route inside the **same** block (one permission, multiple report routes, exactly how `categories`/`categories/new`/`categories/:id/edit` share one `tickets.manage` block, Story 54).
20. `frontend/src/app/Sidebar.tsx` — the `reports.view`-gated `SidebarLink` added by Story 56 (`to="/reports/tickets"`); task 11 adds a second sibling link `to="/reports/sla"` immediately after it, inside the same `<Can permission="reports.view">` block.
21. **`CONVENTIONS.md` § 25 lines 1619-1652** — row 3 (RPT-2 trend → Line Chart, "same as RPT-1's trend row") and row 4 (RPT-2 breach rate → Gauge/Bullet, the qualitative-zone hex triple `#FFCDD2`/`#FFF9C4`/`#C8E6C9`, performance-bar `#1976D2`, black 3px target marker — task 6's exact color spec). **§ 27** (added by Story 55, extended by Story 56) — this story adds one more point (task 8) recording the average-vs-count gap-fill exception.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **SLA metrics API + report UI, via RPT-0.** | Intake, sole task | Two `BaseReportView` subclasses; `ChartFrame`-wrapped `LineChart`/`GaugeChart`. |
| **Response/resolution times.** | Intake | `SlaTrendReportView` → average minutes per bucket, two series. |
| **Breach rates.** | Intake | `SlaBreachRateReportView` → `met`/`breached`/`pending` counts + rate, per dimension. |
| **SLA status classification must never disagree between the single-ticket view and this report.** | This story's design, to avoid a real correctness bug | Both call the same `apps.sla.policy.dimension_status` (promoted, task 1). |
| **No N+1 across a ticket list.** | Story 28 `## Prerequisites`, point 13 (explicit forward note) | Two `Subquery` annotations, one bulk `SLAPolicy`/`OrganizationSettings` fetch — 3 queries total, verified. |
| **An average is never gap-filled with a false zero.** | This story's verified finding | `apps/reports/sla.py::sla_trend` omits empty buckets; documented as § 27's first exception (task 8). |
| **The breach-rate denominator excludes tickets still pending.** | This story's design | `rate = breached / (met + breached)`, `None` when that sum is zero — a ticket not yet due is not evidence either way. |
| **Every chart has a data-table fallback; color is never the only signal.** | § 25 lines 1638-1642, § 27 point 6 | `ChartFrame`'s `table` prop required on both reports; `GaugeChart` always renders its percentage as text. |
| **The export param is `export`, never `format`.** | § 27 point 4 | Inherited from `BaseReportView`. |
| **No new permission, no new migration.** | `reports.view` already covers every `RPT-*` report (Story 56's own grant reasoning: "reports are oversight, admin/manager") | No `apps/reports/migrations/0002_*`. |

**The verified bulk computation**, reproduced against this project's live Postgres — confirm this shape still holds before writing task 2:

```python
policies = {(p.priority, p.category_id): p for p in SLAPolicy.objects.all()}
org = OrganizationSettings.load()
# ticket 66, no SLAPolicy rows configured -> falls through to org default (100/200 minutes)
# compute_sla_status(ticket_66) == {'response_status': 'breached', 'resolution_status': 'met', ...}
# the bulk-annotated row for ticket 66 (first_response_at=None, resolved_at=<...>) classifies
# IDENTICALLY via dimension_status(response_due_at, None) == 'breached' and
# dimension_status(resolution_due_at, resolved_at) == 'met'. Verified equal, not assumed.
```

Full dry run over the live 30-day default range: 11 tickets, 0 skipped (all resolved to the org default), `response_counts={'met': 2, 'breached': 9, 'pending': 0}`, `resolution_counts={'met': 1, 'breached': 10, 'pending': 0}` — response breach rate `0.818`, resolution breach rate `0.909`. Re-run this exact computation in `## Verification Steps` step 3 to confirm the shipped code reproduces it.

---

## Backend Tasks

### 1 — Promote `_dimension_status` to public

**File: `backend/apps/sla/policy.py`** — rename `_dimension_status` (line 65) to `dimension_status`, and update its two call sites at lines 116 and 118 (`_dimension_status(...)` → `dimension_status(...)`). No other change — the docstring, parameters, and body stay exactly as they are.

```python
def dimension_status(due_at, achieved_at, now) -> str:
    """ "met" (achieved by the deadline), "breached" (deadline passed,
    whether achieved late or not at all), or "pending" (not yet due, not
    yet achieved). Computed fresh every call — a "pending" ticket becomes
    "breached" automatically once real time passes `due_at`, with nothing
    to update.

    Public since Story 57 (RPT-2): the bulk report path
    (`apps/reports/sla.py`) needs the exact same classification a
    single-ticket read uses, so the two can never disagree.
    """
```

---

### 2 — SLA report domain helpers

**Create file: `backend/apps/reports/sla.py`**

```python
"""SLA-specific report queries — RPT-2.

`aggregation.py` knows nothing about a ticket or an SLA policy; this
module is where that domain knowledge lives, the same split
`apps/reports/tickets.py` (RPT-1) already established.

Computes response/resolution status in BULK, not by calling
`apps.sla.policy.compute_sla_status` per ticket — that function does two
extra queries per call (`apps/sla/policy.py:90-108`), an N+1 risk across
a report's ticket list that Story 28's own `## Prerequisites` (point 13)
explicitly flagged and deferred: "a future story can add [batching] once
there is a batching strategy... worth its own design pass." This module
is that batching strategy: two `Subquery` annotations (the same technique
`apps/reports/tickets.py::with_origin_channel` uses) plus one bulk
`SLAPolicy`/`OrganizationSettings` fetch, replacing what would otherwise
be `2N+1` queries with exactly 3. Classification itself still goes
through the shared `apps.sla.policy.dimension_status`, so this can never
silently disagree with the single-ticket `TicketViewSet.sla` action.
"""

from datetime import timedelta

from django.db.models import OuterRef, Subquery
from django.utils import timezone

from apps.communications.models import Message
from apps.organization.models import OrganizationSettings
from apps.reports.aggregation import BUCKETS, DATE_FORMAT
from apps.sla.models import SLAPolicy
from apps.sla.policy import dimension_status
from apps.tickets.models import Ticket, TicketActivity

# The two fixed dimensions every SLA report has — unlike RPT-1's
# user-selectable status/priority/category/channel, response and
# resolution are not a whitelist of query-string options; they are always
# both computed and always both returned.
RESPONSE = "response"
RESOLUTION = "resolution"


def _bulk_target_resolver(policies_by_key, org_targets):
    """Returns a function `(priority, category_id) -> (response_minutes,
    resolution_minutes) | None`, mirroring `apps.sla.policy.resolve_policy`'s
    exact two-tier lookup (category-specific, then priority-only default,
    then org default) but against a pre-fetched dict instead of two
    queries per ticket.
    """

    def resolve(priority, category_id):
        policy = policies_by_key.get((priority, category_id))
        if policy is None:
            policy = policies_by_key.get((priority, None))
        if policy is not None:
            return (policy.response_target_minutes, policy.resolution_target_minutes)
        return org_targets

    return resolve


def _annotated_tickets(start, end):
    """Every ticket created in [start, end), annotated with its earliest
    outbound message time and earliest resolved/closed activity time —
    the same two facts `compute_sla_status` reads per-ticket, fetched here
    in ONE query for the whole range via `Subquery`, not `2N+1`.
    """
    first_response = (
        Message.objects.filter(ticket=OuterRef("pk"), direction=Message.Direction.OUTBOUND)
        .order_by("created_at")
        .values("created_at")[:1]
    )
    resolved_activity = (
        TicketActivity.objects.filter(
            ticket=OuterRef("pk"),
            kind=TicketActivity.Kind.STATUS_CHANGED,
            to_value__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED],
        )
        .order_by("created_at")
        .values("created_at")[:1]
    )
    return (
        Ticket.objects.filter(created_at__gte=start, created_at__lt=end)
        .annotate(
            first_response_at=Subquery(first_response),
            resolved_at=Subquery(resolved_activity),
        )
        .values(
            "id", "created_at", "priority", "category_id", "first_response_at", "resolved_at"
        )
    )


def _target_resolver():
    policies_by_key = {(p.priority, p.category_id): p for p in SLAPolicy.objects.all()}
    org = OrganizationSettings.load()
    org_targets = None
    if (
        org.default_response_target_minutes is not None
        and org.default_resolution_target_minutes is not None
    ):
        org_targets = (org.default_response_target_minutes, org.default_resolution_target_minutes)
    return _bulk_target_resolver(policies_by_key, org_targets)


def sla_trend(start, end, bucket: str) -> list[dict]:
    """Average response/resolution time (minutes) per bucket, two series.

    Returns `[{"bucket": "2026-01-01", "series": "response", "value": 42.3}, ...]`
    — the SAME flat shape `bucketed_counts` returns, so it reuses the
    identical frontend `LineChart`/`ChartDataTable` composition RPT-1's
    volume trend already uses. Deliberately NOT gap-filled: an average has
    no natural zero (unlike a count), so a bucket with zero achieved
    values in it is OMITTED rather than reported as "0 minutes", which
    would falsely claim instant response/resolution. See Story 57
    `## Prerequisites` and `CONVENTIONS.md` § 27's new point.

    A ticket with no resolvable SLA policy (`resolve()` returns `None`) is
    silently excluded — the same "SLA tracking is opt-in, not every ticket
    has one" outcome `compute_sla_status` already treats as normal
    (`apps/sla/policy.py:80`), not an error.
    """
    resolve = _target_resolver()
    trunc = BUCKETS[bucket]
    tz = timezone.get_current_timezone()

    sums: dict[tuple[str, str], float] = {}
    counts: dict[tuple[str, str], int] = {}

    for row in _annotated_tickets(start, end).annotate(_bucket=trunc("created_at", tzinfo=tz)):
        targets = resolve(row["priority"], row["category_id"])
        if targets is None:
            continue
        bucket_date = row["_bucket"].date() if hasattr(row["_bucket"], "date") else row["_bucket"]
        bucket_key = bucket_date.strftime(DATE_FORMAT)
        created = row["created_at"]

        if row["first_response_at"] is not None:
            minutes = (row["first_response_at"] - created).total_seconds() / 60
            key = (bucket_key, RESPONSE)
            sums[key] = sums.get(key, 0) + minutes
            counts[key] = counts.get(key, 0) + 1
        if row["resolved_at"] is not None:
            minutes = (row["resolved_at"] - created).total_seconds() / 60
            key = (bucket_key, RESOLUTION)
            sums[key] = sums.get(key, 0) + minutes
            counts[key] = counts.get(key, 0) + 1

    return [
        {"bucket": bucket_key, "series": series, "value": round(sums[key] / counts[key], 1)}
        for key in sorted(sums)
        for bucket_key, series in [key]
    ]


def sla_breach_rate(start, end) -> list[dict]:
    """`met`/`breached`/`pending` counts and a breach rate for each of
    `response`/`resolution` over the whole [start, end) range — one
    snapshot, not a time series (CONVENTIONS.md § 25 row 4, "Performance
    vs Target").

    Returns `[{"key": "response", "met": 2, "breached": 9, "pending": 0,
    "rate": 0.818}, {"key": "resolution", ...}]`. `rate` excludes
    `pending` from the denominator — a ticket not yet past its deadline is
    not evidence of either meeting or missing it — and is `None` when
    `met + breached == 0` (nothing to rate yet).
    """
    resolve = _target_resolver()
    now = timezone.now()
    counts = {
        RESPONSE: {"met": 0, "breached": 0, "pending": 0},
        RESOLUTION: {"met": 0, "breached": 0, "pending": 0},
    }

    for row in _annotated_tickets(start, end):
        targets = resolve(row["priority"], row["category_id"])
        if targets is None:
            continue
        response_target, resolution_target = targets
        created = row["created_at"]
        response_due = created + timedelta(minutes=response_target)
        resolution_due = created + timedelta(minutes=resolution_target)
        counts[RESPONSE][dimension_status(response_due, row["first_response_at"], now)] += 1
        counts[RESOLUTION][dimension_status(resolution_due, row["resolved_at"], now)] += 1

    result = []
    for key in (RESPONSE, RESOLUTION):
        c = counts[key]
        total = c["met"] + c["breached"]
        rate = None if total == 0 else round(c["breached"] / total, 3)
        result.append({"key": key, **c, "rate": rate})
    return result
```

`sums`/`counts` keyed by `(bucket_key, series)` tuples, then re-expanded into flat rows in `sla_trend`'s return — the same "collect into a dict, emit sorted flat rows" shape `bucketed_counts` uses (`aggregation.py:155-179`), minus the gap-fill loop.

---

### 3 — SLA trend report view

**File: `backend/apps/reports/views.py`** — add the import and append the class after `TicketBreakdownReportView` (current end of file, line 121).

Add to the existing import block:

```python
from .sla import sla_breach_rate, sla_trend
```

```python
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
```

### 4 — SLA breach-rate report view

**File: `backend/apps/reports/views.py`** — append below task 3's class.

```python
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
```

---

### 5 — URLs

**File: `backend/apps/reports/urls.py`** — add two more entries to `urlpatterns`, after the two `reports/tickets/*` paths:

```python
    path("reports/sla/trend/", SlaTrendReportView.as_view(), name="sla-trend"),
    path("reports/sla/breach-rate/", SlaBreachRateReportView.as_view(), name="sla-breach-rate"),
```

Update the `from .views import ...` line to add `SlaBreachRateReportView, SlaTrendReportView` (alphabetical, matching the existing `TicketBreakdownReportView, TicketVolumeReportView` ordering). **No `config/api_urls.py` change** — `apps.reports.urls` is already included (Story 56).

---

## Frontend Tasks

### 6 — `GaugeChart`

**Create file: `frontend/src/shared/ui/chart/GaugeChart.tsx`**

```tsx
import { useDirection } from '@/shared/i18n/useDirection'

const WIDTH = 600
const BAR_HEIGHT = 28
const GAP = 16

// CONVENTIONS.md § 25 row 4's literal qualitative-zone hex triple
// (bad/ok/good) and performance-bar color — RPT-2 is the first real
// consumer naming these as concrete values; RPT-5 reuses this component
// unchanged (§ 25 line 1636), so they are NOT invented here, only used
// for the first time. Target = GOOD_THRESHOLD: no "acceptable breach
// rate" setting exists anywhere in this codebase, so this is a first-cut
// default a later story can promote to a real setting if needed.
const ZONE_GOOD = '#C8E6C9'
const ZONE_OK = '#FFF9C4'
const ZONE_BAD = '#FFCDD2'
const PERFORMANCE_COLOR = '#1976D2'
const GOOD_THRESHOLD = 0.1
const WARN_THRESHOLD = 0.25

export type GaugeValue = {
  key: string
  label: string
  /** 0-1 fraction, e.g. a breach rate. */
  value: number
}

type GaugeChartProps = {
  gauges: readonly GaugeValue[]
  formatValue?: (n: number) => string
}

/**
 * A small grid of "performance vs target" gauges — CONVENTIONS.md § 25
 * row 4 (RPT-2's breach rate) and row 7 (RPT-5 reuses this UNCHANGED, not
 * a new chart type). Each gauge is a 0-100% horizontal bar over three
 * fixed qualitative zones with a target marker, so lower is always
 * "better" — the correct framing for a breach RATE. Never color alone:
 * every gauge's percentage is also rendered as text.
 */
export function GaugeChart({ gauges, formatValue = (n) => `${Math.round(n * 100)}%` }: GaugeChartProps) {
  const direction = useDirection()
  const height = gauges.length * (BAR_HEIGHT + GAP)

  function xFor(fraction: number): number {
    const clamped = Math.min(1, Math.max(0, fraction))
    return direction === 'rtl' ? WIDTH - clamped * WIDTH : clamped * WIDTH
  }

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" style={{ height }} role="img">
      {gauges.map((gauge, index) => {
        const y = index * (BAR_HEIGHT + GAP)
        const barStart = direction === 'rtl' ? xFor(1) : 0
        const barWidth = Math.abs(xFor(1) - xFor(0))
        const performanceWidth = Math.abs(xFor(gauge.value) - xFor(0))
        const performanceStart = direction === 'rtl' ? xFor(gauge.value) : 0
        const targetX = xFor(GOOD_THRESHOLD)
        const label = `${gauge.label}: ${formatValue(gauge.value)}`

        return (
          <g key={gauge.key}>
            <text x={direction === 'rtl' ? WIDTH : 0} y={y - 4} textAnchor={direction === 'rtl' ? 'end' : 'start'} className="fill-foreground text-xs">
              {gauge.label}
            </text>
            <rect x={xFor(0) - (direction === 'rtl' ? xFor(GOOD_THRESHOLD) - xFor(0) : 0)} y={y} width={Math.abs(xFor(GOOD_THRESHOLD) - xFor(0))} height={BAR_HEIGHT} fill={ZONE_GOOD} />
            <rect x={Math.min(xFor(GOOD_THRESHOLD), xFor(WARN_THRESHOLD))} y={y} width={Math.abs(xFor(WARN_THRESHOLD) - xFor(GOOD_THRESHOLD))} height={BAR_HEIGHT} fill={ZONE_OK} />
            <rect x={Math.min(xFor(WARN_THRESHOLD), xFor(1))} y={y} width={Math.abs(xFor(1) - xFor(WARN_THRESHOLD))} height={BAR_HEIGHT} fill={ZONE_BAD} />
            <rect
              x={performanceStart}
              y={y + BAR_HEIGHT / 4}
              width={performanceWidth}
              height={BAR_HEIGHT / 2}
              fill={PERFORMANCE_COLOR}
              tabIndex={0}
              role="img"
              aria-label={label}
            >
              <title>{label}</title>
            </rect>
            <line x1={targetX} y1={y - 2} x2={targetX} y2={y + BAR_HEIGHT + 2} stroke="black" strokeWidth={3} />
            <text x={direction === 'rtl' ? xFor(gauge.value) - 4 : xFor(gauge.value) + 4} y={y + BAR_HEIGHT / 2} dominantBaseline="middle" textAnchor={direction === 'rtl' ? 'end' : 'start'} className="fill-foreground text-xs font-medium">
              {formatValue(gauge.value)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
```

**Simplify the zone-rect geometry before shipping this**: the three zone `<rect>` x/width expressions above are written to be direction-correct by construction (`xFor` already flips), but re-derive them from `Math.min`/`Math.max` of the two zone-boundary `xFor` calls uniformly (as the middle and bad zones already do) rather than the first zone's asymmetric special case — verify all three zones tile the full bar with no gap or overlap in **both** directions before moving to task 7, per `## Verification Steps` step 7.

Add to the barrel:

**File: `frontend/src/shared/ui/chart/index.ts`** — add `export { GaugeChart } from './GaugeChart'` and `export type { GaugeValue } from './GaugeChart'`.

### 7 — Types and API layer

**Create file: `frontend/src/features/reports/types/sla.ts`**

```ts
/** One row from `/api/reports/sla/trend/`. `series` is always
 * `'response'` or `'resolution'` — not a `ReportDimension`, a fixed pair. */
export type SlaTrendPoint = {
  bucket: string
  series: 'response' | 'resolution'
  value: number
}

/** One row from `/api/reports/sla/breach-rate/`. `rate` is `null` when
 * `met + breached === 0` (nothing past its deadline yet). */
export type SlaBreachRateRow = {
  key: 'response' | 'resolution'
  met: number
  breached: number
  pending: number
  rate: number | null
}
```

**Create file: `frontend/src/features/reports/api/getSlaTrend.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { SlaTrendPoint } from '../types/sla'

export type SlaTrendParams = {
  from?: string
  to?: string
  bucket?: 'day' | 'week' | 'month'
}

export function getSlaTrend(params: SlaTrendParams): Promise<SlaTrendPoint[]> {
  return api.get<SlaTrendPoint[]>('/reports/sla/trend/', { params })
}
```

**Create file: `frontend/src/features/reports/api/useSlaTrend.ts`** — `useQuery` on `reportKeys.resource('sla-trend', params)`, same shape as `useTicketVolume.ts`.

**Create file: `frontend/src/features/reports/api/getSlaBreachRate.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { SlaBreachRateRow } from '../types/sla'

export type SlaBreachRateParams = { from?: string; to?: string }

export function getSlaBreachRate(params: SlaBreachRateParams): Promise<SlaBreachRateRow[]> {
  return api.get<SlaBreachRateRow[]>('/reports/sla/breach-rate/', { params })
}
```

**Create file: `frontend/src/features/reports/api/useSlaBreachRate.ts`** — `useQuery` on `reportKeys.resource('sla-breach-rate', params)`.

No new `reportKeys.ts` — reuse the existing one (`api/reportKeys.ts`, unchanged since Story 56).

### 8 — Conventions (do this before task 9, since the page's comments reference it)

**File: `CONVENTIONS.md` § 27** — add point 10:

10. **An average metric is never gap-filled with a false zero.** `bucketed_counts`'s `value: 0` gap-fill (point 2 above) is correct for a *count* — zero tickets is a real, meaningful zero — but wrong for an *average*: `apps/reports/sla.py::sla_trend` reports average response/resolution minutes, and a bucket with no achieved values in it is **omitted** rather than reported as "0 minutes", which would falsely claim instant response. Any future average-shaped report follows this, not `bucketed_counts`'s gap-fill.

### 9 — The report screen

**Create file: `frontend/src/features/reports/components/SlaReportsPage.tsx`**

Copy `TicketReportsPage.tsx`'s date-range filter block (its lines 118-140: the `From`/`To` `Input type="date"` pair with `Label`s) and its bucket `Select` (lines 141-152) verbatim — same `id`s are fine since this is a different route/page. Local state:

```tsx
const [from, setFrom] = useState('')
const [to, setTo] = useState('')
const [bucket, setBucket] = useState<'day' | 'week' | 'month'>('day')
```

No series/dimension `Select` — SLA has no user-selectable dimension.

```tsx
const trendParams = { ...(from ? { from } : {}), ...(to ? { to } : {}), bucket }
const trendQuery = useSlaTrend(trendParams)

const breachRateParams = { ...(from ? { from } : {}), ...(to ? { to } : {}) }
const breachRateQuery = useSlaBreachRate(breachRateParams)
```

**Trend chart** — reuses `LineChart` exactly as `TicketReportsPage.tsx` does, but grouping by the fixed `response`/`resolution` pair instead of an arbitrary split:

```tsx
function toChartSeries(rows: SlaTrendPoint[]): ChartSeries[] {
  const bySeries = new Map<'response' | 'resolution', SlaTrendPoint[]>()
  for (const row of rows) {
    const existing = bySeries.get(row.series)
    if (existing) existing.push(row)
    else bySeries.set(row.series, [row])
  }
  return [...bySeries.entries()].map(([key, points]) => ({
    key,
    label: t(`trend.series.${key}`),
    points,
  }))
}
```

```tsx
<ChartFrame
  title={t('trend.title')}
  description={t('trend.description')}
  query={trendQuery}
  isEmpty={(rows) => rows.length === 0}
  action={<Button variant="outline" size="sm" onClick={() => void handleExportTrend()}><DownloadIcon />{t('actions.exportCsv')}</Button>}
  table={(rows) => (
    <ChartDataTable
      caption={t('chart.dataTableCaption', { ns: 'common', title: t('trend.title') })}
      columns={[t('fields.period'), t('fields.dimension'), t('trend.minutes')]}
      rows={rows.map((row) => [formatBucket(row.bucket), t(`trend.series.${row.series}`), String(row.value)])}
    />
  )}
>
  {(rows) => <LineChart series={toChartSeries(rows)} formatBucket={formatBucket} />}
</ChartFrame>
```

`isEmpty` is `rows.length === 0` here, **not** the ticket-volume `every(value === 0)` check — `sla_trend` never emits a zero-value row (task 2's omit-instead-of-gap-fill rule), so an empty array is the only "nothing to chart" state. `formatBucket` is the identical `date(bucketValue, { dateStyle: 'medium', timeZone: 'UTC' })` helper from `TicketReportsPage.tsx:67-73` — copy it, do not import across the two page components (`no-restricted-imports` does not block same-feature imports, but there is no shared page-helpers module to put it in yet; duplicating one four-line function is preferable to inventing one for a single second caller, per `CONVENTIONS.md` § 8).

**Breach-rate panel** — `ChartFrame` wrapping `GaugeChart`:

```tsx
<ChartFrame
  title={t('breachRate.title')}
  description={t('breachRate.description')}
  query={breachRateQuery}
  isEmpty={(rows) => rows.every((row) => row.rate === null)}
  action={<Button variant="outline" size="sm" onClick={() => void handleExportBreachRate()}><DownloadIcon />{t('actions.exportCsv')}</Button>}
  table={(rows) => (
    <ChartDataTable
      caption={t('chart.dataTableCaption', { ns: 'common', title: t('breachRate.title') })}
      columns={[t('fields.dimension'), t('breachRate.met'), t('breachRate.breached'), t('breachRate.pending'), t('breachRate.rate')]}
      rows={rows.map((row) => [
        t(`trend.series.${row.key}`),
        String(row.met),
        String(row.breached),
        String(row.pending),
        row.rate === null ? t('breachRate.noData') : number(row.rate, { style: 'percent', maximumFractionDigits: 1 }),
      ])}
    />
  )}
>
  {(rows) => (
    <GaugeChart
      gauges={rows
        .filter((row) => row.rate !== null)
        .map((row) => ({ key: row.key, label: t(`trend.series.${row.key}`), value: row.rate as number }))}
    />
  )}
</ChartFrame>
```

`number` here is `useFormatters().number` (already imported alongside `date` — `Intl.NumberFormatOptions` accepts `style: 'percent'` directly, no new formatter needed, `frontend/src/shared/lib/format.ts:1-20`). A `rate: null` row (nothing past its deadline in the selected range) is excluded from `GaugeChart`'s `gauges` array — a gauge with an undefined value has nothing to render — but still appears in the data table as `t('breachRate.noData')`, so the fallback stays complete even when the chart itself is missing a bar.

### 10 — Locales

**File: `frontend/src/features/reports/locales/en.json`** — add a `trend`/`breachRate` block (sibling to the existing `volume`/`breakdown`) and two new `fields`:

```json
"trend": {
  "title": "SLA response/resolution trend",
  "description": "Average time to first response and to resolution, in minutes.",
  "minutes": "Minutes",
  "series": { "response": "Response", "resolution": "Resolution" }
},
"breachRate": {
  "title": "SLA breach rate",
  "description": "Share of tickets that missed their response/resolution target in the selected period.",
  "met": "Met",
  "breached": "Breached",
  "pending": "Pending",
  "rate": "Breach rate",
  "noData": "No data yet"
}
```

Add `"dimension": "Dimension"` to the existing `fields` block. **File: `ar.json`** — the mirror, e.g. `"trend": {"title": "اتجاه الاستجابة/الحل حسب اتفاقية مستوى الخدمة", "description": "متوسط وقت الاستجابة الأولى ووقت الحل، بالدقائق.", "minutes": "الدقائق", "series": {"response": "الاستجابة", "resolution": "الحل"}}`, `"breachRate": {"title": "معدل تجاوز اتفاقية مستوى الخدمة", "description": "نسبة التذاكر التي لم تحقق هدف الاستجابة/الحل خلال الفترة المحددة.", "met": "تم الالتزام", "breached": "تم التجاوز", "pending": "قيد الانتظار", "rate": "معدل التجاوز", "noData": "لا توجد بيانات بعد"}`, and `"dimension": "البُعد"` in `fields`. Verify the final key set matches `en.json` exactly (`## Verification Steps` step 9) — do not hand-copy without diffing.

### 11 — Route

**File: `frontend/src/app/router.tsx`** — inside the **same** `element: <RequirePermission permission="reports.view" />` block Story 56 added (do not create a second block for the same permission), add a sibling route after `reports/tickets`:

```tsx
{
  path: 'reports/sla',
  lazy: async () => {
    const { SlaReportsPage } = await import('@/features/reports/components/SlaReportsPage')
    return { element: <SlaReportsPage /> }
  },
},
```

### 12 — Sidebar link

**File: `frontend/src/app/Sidebar.tsx`** — inside the **same** `<Can permission="reports.view">` block Story 56 added, add a second `SidebarLink` immediately after the `/reports/tickets` one:

```tsx
<SidebarLink
  to="/reports/sla"
  icon={ChartNoAxesColumnIcon}
  label={t('reports:sidebarSla')}
  collapsed={collapsed}
/>
```

Same icon as the ticket-reports link is acceptable (both are "a report"; `lucide-react` has no dedicated SLA icon and inventing a semantically-strained one is worse than reusing this one, the same call already made for `TicketAssigneeControl`/`TicketStatusControl` sharing icons where no better option exists). Add `"sidebarSla": "SLA Performance"` (`ar.json`: `"sidebarSla": "أداء اتفاقية مستوى الخدمة"`) to the `reports` locale files' top level, alongside the existing `"title"` key — **do not reuse `title`** (Story 56's `t('reports:title')` names the feature as a whole, "Ticket Reports"' own page heading is `t('title')` inside that page's own render, so a second distinct sidebar-only string is needed to avoid the two links showing identical labels).

---

## Edge Cases & Failure Modes

- **No `SLAPolicy` rows and no `OrganizationSettings` defaults configured** → `_target_resolver()`'s `resolve()` returns `None` for every ticket; both `sla_trend` and `sla_breach_rate` return effectively empty results (`sla_trend`: `[]`; `sla_breach_rate`: `[{"key": "response", "met": 0, "breached": 0, "pending": 0, "rate": None}, {"key": "resolution", ...}]`). Not an error — this is `compute_sla_status`'s own established "SLA tracking is opt-in" behavior (`policy.py:80`), now surfaced at the report level.
- **A ticket whose category has a `SLAPolicy` override AND a priority-only default both configured** → the bulk resolver checks `(priority, category_id)` before `(priority, None)`, exactly mirroring `resolve_policy`'s own two-tier order (`policy.py:32-41`). Not tested live in this database (no `SLAPolicy` rows exist today) — verified by code-reading equivalence instead; **verify with a real configured policy in `## Verification Steps` step 4** before trusting this in production data.
- **A ticket resolved, then reopened, then resolved again** → `resolved_activity` takes the **earliest** `STATUS_CHANGED` row into resolved/closed (`.order_by("created_at").first()`), identical to `compute_sla_status`'s own choice — the SLA clock measures the *first* time the target was hit, not the final state. Same behavior, not a new decision.
- **A ticket with `first_response_at` present but a NULL `resolved_at`, evaluated after `resolution_due_at` has passed** → classified `breached` for resolution (via `dimension_status`'s `now > due_at` branch), even though it was `met` for response — the two dimensions are independent, exactly as `compute_sla_status` already treats them.
- **`sla_trend` with a bucket containing tickets that all have `first_response_at is None`** → that `(bucket, "response")` key never enters `sums`/`counts`, so the bucket is silently absent from the response series' rows (while still potentially present in the resolution series, if any ticket in it resolved). The frontend's `toChartSeries` (task 9) must not assume both series share the same bucket set — `LineChart`'s own `bucketDomain` helper (`LineChart.tsx`, unioning all series' buckets) already handles this correctly; verified by re-reading its implementation, not assumed.
- **`GaugeChart` rendered with an empty `gauges` array** (both dimensions have `rate: null`) → `ChartFrame`'s `isEmpty` check (`rows.every((row) => row.rate === null)`) catches this first and renders `Empty` instead of an empty `<svg>`.
- **RTL rendering of `GaugeChart`** → every `xFor` call flips through the same `direction === 'rtl' ? WIDTH - ... : ...` pattern `LineChart`/`BarChart` already use; **this is new code, not copied from a tested component** (unlike `LineChart`/`BarChart`, which shipped in Story 55 and were already algebraically verified) — task 6 explicitly calls out re-deriving the zone-rect geometry from `Math.min`/`Math.max` and verifying no gap/overlap in both directions before this task is considered done.
- **`?export=csv` on either endpoint** → both `csv_columns` tuples are self-documenting (task 3/4), so the export always includes the raw counts alongside the derived rate — an auditor never has to recompute the percentage from a bare `value` column the way `TicketBreakdownReportView`'s simpler `(key, value)` shape would have required.
- **A range spanning more than `MAX_RANGE_DAYS`, or an unparseable date** → `400`, inherited from `BaseReportView`/`parse_date_range` unchanged; this story adds no new validation surface (no `?series=`/`?dimension=` parsing, so no new 400 case beyond what `RPT-1` already established).
- **An `agent`-role user hitting either endpoint directly** → `403`, `reports.view` not held — no new permission check to get wrong, since this story reuses Story 56's existing grant.

---

## Test Plan

Per standing project policy this project authors no automated tests (`CONVENTIONS.md` § 16). This story adds none.

Its checks are: `manage.py check`/`ruff`; `manage.py shell` reproduction of the bulk-vs-single-ticket equivalence and the full dry-run numbers recorded in `## Prerequisites`/`## Product rules`; real HTTP against both new endpoints across permission states and both CSV exports; the frontend's `lint`/`format:check`/`check:rtl`/`build`; an `en`/`ar` key-set diff; and a bilingual walkthrough including an explicit RTL check of the new `GaugeChart` geometry. All below.

---

## Verification Steps

1. **Backend gates:** from `backend/` — `python manage.py check`; `python manage.py makemigrations --check --dry-run` reports **no changes** (this story adds no model or migration); `ruff check apps/ && ruff format --check apps/`.
2. **`dimension_status` promotion, no behavior change.** In `manage.py shell`, import `from apps.sla.policy import dimension_status` (confirms the rename took) and re-run `compute_sla_status` against ticket 66 (or any ticket) — the returned `response_status`/`resolution_status` must be identical to what it was before the rename (`breached`/`met` in the current dataset).
3. **Bulk computation reproduces the recorded dry run.** In `manage.py shell`:
   ```python
   from apps.reports.aggregation import parse_date_range
   from apps.reports.sla import sla_trend, sla_breach_rate
   start, end = parse_date_range({})
   print(sla_breach_rate(start, end))
   print(sla_trend(start, end, "day"))
   ```
   Confirm the breach-rate counts match `## Product rules`' recorded dry run (or, if the underlying data has changed since planning, that the counts are internally consistent: `met + breached + pending` equals the count of tickets with a resolvable policy created in range, per dimension).
4. **Two-tier policy specificity, with a real configured policy** (not exercised by the current empty `SLAPolicy` table): create one `SLAPolicy` row for a priority actually present among tickets in the default range (e.g. `priority="medium", category=None, response_target_minutes=30, resolution_target_minutes=60`) via `manage.py shell` or `/admin/`, confirm `sla_breach_rate`'s counts for that priority's tickets shift to reflect the new, tighter targets, then delete the row and confirm the counts revert to the org-default numbers from step 3.
5. **Real HTTP, both endpoints, with a `manager` token** (reuse the token-generation approach from Story 56's own verification): `GET /api/reports/sla/trend/` → `200`, array of `{bucket, series, value}` rows, no row with `value` implying a fabricated zero. `GET /api/reports/sla/breach-rate/?bucket=quarter` → still `400` (inherited `parse_bucket` validation fires even though this endpoint ignores the parsed value) — confirms `BaseReportView.get`'s shared parsing path is unchanged.
6. **Permission states:** `admin`/superuser → `200` on both; `agent` → **`403`** on both (no new grant was added, so this must still hold); no token → `401`.
7. **CSV export, both endpoints:** `GET /api/reports/sla/trend/?export=csv` and `.../breach-rate/?export=csv` → correct `Content-Type`/`Content-Disposition`, UTF-8 BOM present, and the breach-rate CSV's `rate` column is a plain decimal (e.g. `0.818`), not a pre-formatted percentage string — confirms the frontend, not the backend, owns percentage formatting.
8. **`GaugeChart` RTL geometry, explicitly.** Render `SlaReportsPage` (or a scratch mount) with fixture data (e.g. two gauges at 5% and 40%) in **English/LTR**: confirm the zone order left-to-right is green→yellow→red and the performance bar's length visually matches its percentage. Switch to **Arabic/RTL**: confirm the zone order is now right-to-left green→yellow→red (i.e., the bar's own internal geometry mirrors, the same way `BarChart`'s horizontal orientation does), the performance bar still starts at the "0%" edge (now the right edge) and grows toward the value, and the target-threshold marker sits at the same *logical* 10% position on both sides. This is the one genuinely new, unverified geometry in this story — do not skip it.
9. **Frontend gates:** `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` — all clean.
10. **Locale key parity:** diff `features/reports/locales/en.json` against `ar.json` — identical key set, including the new `trend`/`breachRate` blocks and the top-level `sidebarSla` key.
11. **Bilingual walkthrough.** `npm run dev`, signed in as `admin`/`manager`. Open `/reports/sla` from the new sidebar link (distinct label from "Ticket Reports"): the trend line renders two series (Response, Resolution) with distinct dash patterns; the breach-rate gauges render below with correct percentages and zone coloring; toggle each "Show data table" and confirm the fallback tables list the same numbers, with the breach-rate table showing raw `met`/`breached`/`pending` counts alongside the rate; export both CSVs. Adjust the date range and bucket size and confirm both charts update. Switch to Arabic and repeat the visual check from step 8 in the full page context.
12. **Permission boundary:** an `agent`-role user sees neither the sidebar link's SLA entry nor the ticket-reports one (both share one `<Can>` block, unchanged), and `/reports/sla` redirects to `/` when navigated to directly.

---

## Done Criteria

- [ ] `apps/sla/policy.py::_dimension_status` renamed to `dimension_status` (public); its two internal call sites updated; no behavior change.
- [ ] `apps/reports/sla.py` — `_bulk_target_resolver`, `_annotated_tickets`, `_target_resolver`, `sla_trend`, `sla_breach_rate`. Zero N+1: exactly 3 queries regardless of ticket count, verified.
- [ ] `SlaTrendReportView` and `SlaBreachRateReportView` in `apps/reports/views.py`, each `permission_map = {"get": Permissions.REPORTS_VIEW}` — the **existing** permission, no new constant.
- [ ] `apps/reports/urls.py` gains `reports/sla/trend/` and `reports/sla/breach-rate/`. **No** `config/api_urls.py` change (already included). **No** new migration.
- [ ] `frontend/src/shared/ui/chart/GaugeChart.tsx` — zone/performance/target-marker geometry verified correct in **both** LTR and RTL (step 8); exported from the barrel.
- [ ] `features/reports/types/sla.ts`, four new `api/` files (reusing the existing `reportKeys.ts`/`exportReport.ts`), `components/SlaReportsPage.tsx` — trend via the existing `LineChart`, breach rate via the new `GaugeChart`, both `ChartFrame`-wrapped with a required `ChartDataTable` fallback.
- [ ] `sla_trend` omits empty buckets rather than gap-filling with `0`; `CONVENTIONS.md` § 27 gained point 10 recording this exception.
- [ ] Route `reports/sla` and sidebar link added inside Story 56's **existing** `reports.view` blocks (router.tsx and Sidebar.tsx), not new permission-gated blocks; sidebar label distinct from the ticket-reports one (`sidebarSla`, not a reused `title`).
- [ ] `trend`/`breachRate` locale blocks and `sidebarSla`/`fields.dimension` keys added to both `en.json`/`ar.json` with an identical key set.
- [ ] Verified by shell: the `dimension_status` rename preserves behavior (step 2), the bulk computation reproduces the recorded dry-run numbers (step 3), and a real configured `SLAPolicy` row correctly shifts the breach-rate counts (step 4).
- [ ] Verified by real HTTP: both endpoints across three permission states, the inherited `?bucket=` validation still firing on the breach-rate endpoint, and both CSV exports with a raw (non-percentage-formatted) `rate` column (steps 5-7).
- [ ] Verified in the browser: `GaugeChart`'s RTL geometry explicitly (step 8), the full bilingual walkthrough of both charts and their exports (step 11), and the agent-role permission boundary (step 12).
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 58 (`RPT-3`, Agent Performance).**
