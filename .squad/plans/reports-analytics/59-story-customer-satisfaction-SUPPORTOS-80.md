# Story 59 — Customer Satisfaction (Story: SUPPORTOS-80)

## Prerequisites

- **`RPT-0`/`RPT-1`/`RPT-2`/`RPT-3` (Stories 55/56/57/58) completed.** `apps/reports/aggregation.py` (`bucketed_counts`, `grouped_counts`, `parse_date_range`, `parse_bucket`), `apps/reports/export.py::csv_response`, `apps/reports/views.py::BaseReportView`, `Permissions.REPORTS_VIEW` (already granted to `admin`/`manager`), `frontend/src/shared/ui/chart/` (`ChartFrame`, `LineChart`, `ChartDataTable`) all exist. **This story adds no new permission and no new migration.**
- **`PORTAL-5` (Submit Feedback/CSAT, Story 47) is the one data source this story reads.** `Feedback` (`apps/tickets/models.py:169-218`): `rating` a three-value `TextChoices` (`satisfied`/`neutral`/`dissatisfied`, 179-186), `created_at` from `TimeStampedModel` — already exists, reused unchanged, no model or migration change.
- **Verified live: this is the FIRST `RPT-*` report needing NO new backend domain module.** Unlike `RPT-1`'s `apps/reports/tickets.py` (channel needed a `Subquery` join), `RPT-2`'s `apps/reports/sla.py` (policy resolution needed a bulk resolver), and `RPT-3`'s `apps/reports/agents.py` (agent names needed a bulk `User` lookup), `Feedback.rating` is a plain, non-nullable, already-queryable field on the row being counted — `bucketed_counts`/`grouped_counts` (`aggregation.py`) work against `Feedback.objects` **exactly as-is**, with no annotation, no join, no whitelist. Reproduced live against this project's Postgres:
  ```python
  bucketed_counts(Feedback.objects.all(), date_field="created_at", start=start, end=end,
                   bucket="day", series_field="rating")
  # -> 30 gap-filled rows; the one nonzero row: {'bucket': '2026-08-29', 'value': 1, 'series': 'satisfied'}
  grouped_counts(Feedback.objects.filter(created_at__gte=start, created_at__lt=end), field="rating")
  # -> [{'key': 'satisfied', 'value': 1}]
  ```
  This story's two views therefore call `aggregation.py` directly from `get_report`, the same shape `TicketVolumeReportView`/`TicketBreakdownReportView` already use for their own inline calls (`views.py:79-95`, `112-122`) — no `apps/reports/csat.py` is created.
- **`bucketed_counts`'s `series_field` only emits series that actually occur in the data** (`aggregation.py:169`, `series_keys = sorted({key[1] for key in counts})`) — a rating value that has never been submitted (today: `neutral`, `dissatisfied`) produces **no line at all**, not a flat zero line. This is existing, already-shipped `bucketed_counts` behavior (unchanged by this story), and is the correct outcome — a missing series is different from an all-zero one, the same distinction `RPT-1`'s status/priority trends already rely on.
- **`CONVENTIONS.md` § 25 row 6 (RPT-4) splits into two chart types**: "trend over time" → Line Chart ("same as RPT-1's trend row"), reusing `LineChart` unchanged — the third `RPT-*` story to reuse it, no new frontend chart for the trend half. "satisfied/neutral/dissatisfied breakdown" → **Waffle Chart**, explicitly *not* Pie/Donut (`charts.csv` rates Pie/Donut `risk:high` for accessibility, Waffle `risk:low` for the identical use case), "10×10 grid standard", "always labeled with percentage text". This is a genuinely new chart type — the first Waffle consumer in this epic.
- **`WaffleChart` goes in `shared/ui/chart/`, not `features/reports/`** — not because a second consumer is currently named (unlike `GaugeChart`, which had `RPT-5` named as a second consumer before it was built), but because `CONVENTIONS.md` § 27 point 6 already states the rule unconditionally: *"`frontend/src/shared/ui/chart/` is the only home for chart components... a report screen never renders [a chart] directly [outside `ChartFrame`]."* This rule was written during `RPT-0` planning without a consumer-count qualifier, and every chart type this epic has needed so far (`LineChart`/`BarChart` from `RPT-0` itself, `GaugeChart` from `RPT-2`) has followed it without exception — `WaffleChart` does too, for consistency with an already-written project rule rather than a fresh per-story judgment call.
- **A percentage-to-square allocation needs care, or the grid does not sum to 100.** Naive `Math.round()` on three independent percentages can produce 99 or 101 total squares (e.g. three categories at 33.3% each round to 33+33+33=99, not 100). This story uses the **largest-remainder method** (Hamilton's apportionment): floor every category's exact square count, then hand out the leftover squares to the categories with the largest fractional remainder, largest first. Verified algebraically against 8 cases including exact thirds, a 2-way split, a 5-way equal split, and a single-category 100%/0%/0% case — every one sums to exactly 100:
  ```
  [60,25,15] -> [60,25,15]   [1,0,0] -> [100,0,0]   [7,3] -> [70,30]
  [33,33,34] -> [33,33,34]   [1,1,1] -> [34,33,33]  [100,0,0] -> [100,0,0]
  [2,1] -> [67,33]           [5,5,5,5,5] -> [20,20,20,20,20]
  ```
- **No RTL-specific coordinate math is needed for `WaffleChart`, unlike `LineChart`/`BarChart`/`GaugeChart`.** Those are hand-built SVG, which never flips under `dir="rtl"` on its own (verified, `LineChart`/`BarChart`'s own `useDirection()` calls exist precisely because of this). `WaffleChart` is a plain CSS Grid of `<div>` cells — CSS Grid's own column-flow direction already follows the ambient `dir` attribute with no extra code, the same reason `DataTable.tsx`'s table layout needs no manual RTL handling. This is a documented CSS behavior, not yet visually confirmed in this project's own browser — flagged explicitly for a visual check in `## Verification Steps`, not assumed.
- **Individual waffle cells are `aria-hidden`, not individually focusable/labeled** — a deliberate accessibility choice, different from `LineChart`'s per-point and `BarChart`'s per-bar `tabIndex`/`aria-label`. A Waffle's 100 cells are not 100 independent data points the way a bar chart's bars are; each cell is a fragment of ONE category's aggregate percentage. Per-cell ARIA labels would be 100 near-identical, redundant stops for a screen reader. Instead, the whole grid carries one `role="img"` with a single summary `aria-label` (all categories and percentages), and the **legend** (real, visible DOM text — not ARIA-only) is what "always labeled with percentage text" (§ 25) actually means here, backed by the mandatory `ChartDataTable` fallback every `ChartFrame` already requires.
- **No new `Feedback` model field, no schema migration.**

---

## Story Goal

The CSAT half of `RPT-0`'s data — two endpoints, both calling `aggregation.py` directly, one report screen:

1. **CSAT metrics API**:
   - `GET /api/reports/csat/trend/` — feedback count per time bucket, one line per rating (`satisfied`/`neutral`/`dissatisfied`, whichever have ever been submitted). `BaseReportView` subclass calling `bucketed_counts` directly against `Feedback`.
   - `GET /api/reports/csat/breakdown/` — feedback count per rating over the whole selected range, descending. `BaseReportView` subclass calling `grouped_counts` directly against `Feedback`.
2. **Report UI** — a `/reports/csat` screen: a date-range + bucket control, a `ChartFrame`-wrapped `LineChart` for the trend, and a `ChartFrame`-wrapped new `WaffleChart` for the breakdown — each with the mandatory `ChartDataTable` fallback and a CSV export button.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| Two views, no new domain module | `Feedback.rating` needs no join/annotation/whitelist — `aggregation.py` already handles it, the same "no bespoke helper needed" shape `TicketVolumeReportView`/`TicketBreakdownReportView` already use inline. |
| `WaffleChart` in `shared/ui/chart/` | § 25 row 6 names it explicitly; `CONVENTIONS.md` § 27 point 6 already requires every chart component to live there, unconditionally. |
| Largest-remainder square allocation | The only way to guarantee a 10×10 grid actually has 100 squares — verified algebraically, not assumed. |
| Reusing `LineChart` for the trend | Structurally identical to `RPT-1`'s ticket-status trend and `RPT-2`'s SLA trend — a bucket, a series name, a value. |

**Not here, and why:**

- **No CSAT-per-agent cross-reference.** `RPT-3` already reports an agent's own CSAT rate (`apps/reports/agents.py::CSAT`); this story is the org-wide trend/breakdown, not a per-agent view. The two are deliberately separate reports, not merged.
- **No CSAT score weighting (e.g., "1.0/0.5/0.0" composite).** Same reasoning `RPT-3`'s `## Prerequisites` already gave for its own "% satisfied" scalar: no numeric weighting for `neutral` exists anywhere in this codebase, and this story's breakdown is a genuine three-category Part-to-Whole view (the exact shape § 25 asks for), not a scalar needing one.
- **No comment/free-text analysis.** `Feedback.comment` exists on the model but nothing in the intake asks for it, and free-text aggregation (word clouds, sentiment-from-text) is a materially different, unrequested feature.
- **No filter by ticket dimension** (priority/category/channel/agent). Not in the intake; a future drill-in, the same scope discipline every prior `RPT-*` story has applied to its own "not here" list.
- **No caching, no Celery pre-aggregation.** Same standing rule as every prior `RPT-*` story.

---

## Context — Read These Files First

1. `.squad/stories/reports-analytics/SUPPORTOS-80/intake.md` — one task (*"CSAT metrics API + report UI — Aggregate satisfaction trends via RPT-0"*), dependency `PORTAL-5`, **no acceptance criteria, no attachments**.
2. [`56-story-ticket-reports-SUPPORTOS-77.md`](56-story-ticket-reports-SUPPORTOS-77.md) — the closest structural sibling: this story's two views mirror `TicketVolumeReportView`/`TicketBreakdownReportView` almost exactly, minus the dimension whitelist (CSAT has exactly one series field, `rating`, never chosen by the caller).
3. `backend/apps/tickets/models.py:169-218` — `Feedback`: `Rating` choices (179-186: `SATISFIED`/`NEUTRAL`/`DISSATISFIED`), `ticket` `OneToOneField` (193-), `customer` FK (206-208), `rating` (209, `CharField`, not nullable), `comment` (210, `blank=True`, unused by this story). No numeric field anywhere on this model.
4. `backend/apps/reports/aggregation.py` — `bucketed_counts` (115-180, note the gap-fill loop 172-179 and the "series only for values that occur" behavior at line 169) and `grouped_counts` (183-219) — this story calls both **directly**, unmodified, no new parameters needed.
5. `backend/apps/reports/views.py` — `BaseReportView` (40-58), `TicketVolumeReportView` (61-95) and `TicketBreakdownReportView` (98-122) — task 1/2's two new classes are the closest possible copy of this exact pair, appended after `AgentPerformanceReportView` (current end of file, line 185).
6. `backend/apps/reports/urls.py` (29 lines) — the `path()`-only list task 3 extends with two more entries under a new `reports/csat/` prefix, sibling to `reports/tickets/`, `reports/sla/`, `reports/agents/`.
7. `frontend/src/shared/ui/chart/BarChart.tsx` (127 lines) — the `colorFor`/`--chart-N` cycling convention task 4's `WaffleChart` reuses for its own per-category colors (§ 25 gives Waffle no literal hex triple the way it gave `GaugeChart` one — "distinct accessible color pair per category" with no specific values, so the existing categorical `--chart-1..5` tokens are the correct, already-established choice, not a new color decision).
8. `frontend/src/shared/ui/chart/ChartFrame.tsx:14-29` — the `table` prop is **required**; task 6's `CsatReportsPage.tsx` supplies a `ChartDataTable` for both charts, same as every prior report.
9. `frontend/src/features/reports/components/TicketReportsPage.tsx` (257 lines) and `SlaReportsPage.tsx` (207 lines) — **both** define their own identical 4-line `formatBucket` helper (`TicketReportsPage.tsx:67-73`, `SlaReportsPage.tsx:58-64`). Task 5 promotes this to `features/reports/lib/formatBucket.ts` — the third occurrence is what crosses `CONVENTIONS.md` § 8's "used by two or more → move it" threshold (a feature-local `lib/`, not `shared/src/`, the same placement `features/tickets/lib/statusBadge.ts` already uses for a helper scoped to one feature).
10. `frontend/src/features/portal/locales/en.json:86-89` and `ar.json:86-89` — the **existing** `ratings.satisfied`/`neutral`/`dissatisfied` wording (English: "Satisfied"/"Neutral"/"Dissatisfied"; Arabic: "راضٍ"/"محايد"/"غير راضٍ") from the portal CSAT submission form. Task 7 duplicates this wording verbatim into the `reports` locale files — the same "an agent's name has no cross-feature-safe source, but an enum's *wording* can still be copied" duplication `RPT-1` already established for `status`/`priority`/`channel`, forced by the same `no-restricted-imports` boundary.
11. `frontend/src/features/reports/api/getTicketBreakdown.ts`/`useTicketBreakdown.ts`, `api/exportReport.ts`, `api/reportKeys.ts` — the exact shape task 9's four new API files follow.
12. `frontend/src/app/router.tsx` and `frontend/src/app/Sidebar.tsx` — the existing `reports.view`-gated block/`<Can>`, now holding three sibling routes/links (`reports/tickets`, `reports/sla`, `reports/agents`); tasks 10/11 add a fourth.
13. **`CONVENTIONS.md` § 25 line 1635** (RPT-4's table row, including the exact zone/color language quoted above) and **§ 27** — this story adds one new point (task 8) recording the largest-remainder rounding rule, so a future part-to-whole report does not reinvent or get wrong the same rounding problem.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **CSAT metrics API + report UI, via RPT-0.** | Intake, sole task | Two `BaseReportView` subclasses; `ChartFrame`-wrapped `LineChart`/`WaffleChart`. |
| **Aggregate satisfaction trends.** | Intake | `CsatTrendReportView` → `bucketed_counts(Feedback.objects.all(), ..., series_field="rating")`. |
| **(Implied by § 25's own row) a satisfied/neutral/dissatisfied breakdown.** | § 25 row 6 | `CsatBreakdownReportView` → `grouped_counts(Feedback.objects.filter(...), field="rating")`. |
| **No dimension whitelist, no `?series=`/`?dimension=` param.** | This story's design — `rating` is always the series/field, never chosen | Both views call `aggregation.py` with a hardcoded `field`/`series_field`. |
| **A missing rating series is omitted, never a false zero line.** | Existing `bucketed_counts` behavior (`aggregation.py:169`), unchanged | No new code — inherited automatically. |
| **A Waffle grid always sums to exactly 100 squares.** | This story's verified finding | Largest-remainder allocation in `WaffleChart.tsx`. |
| **Every chart has a data-table fallback; color is never the only signal.** | § 25 lines 1638-1642, § 27 point 6 | `ChartFrame`'s `table` prop required; `WaffleChart`'s legend renders real text, not ARIA-only. |
| **The export param is `export`, never `format`.** | § 27 point 4 | Inherited from `BaseReportView`. |
| **No new permission, no new migration.** | `reports.view` already covers every `RPT-*` report | No `apps/reports/migrations/0002_*`. |

---

## Backend Tasks

### 1 — CSAT trend report view

**File: `backend/apps/reports/views.py`** — add `Feedback` to the existing `from apps.tickets.models import Ticket` import line, and append the class after `AgentPerformanceReportView` (current end of file, line 185).

```python
from apps.tickets.models import Feedback, Ticket
```

```python
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
```

### 2 — CSAT breakdown report view

**File: `backend/apps/reports/views.py`** — append below task 1's class.

```python
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
```

`include_null` is left at its default `False` — `Feedback.rating` is a required, non-blank `CharField` (`models.py:209`), so no row can ever have a NULL rating; `include_null`/`null_label` would be dead parameters here.

---

### 3 — URLs

**File: `backend/apps/reports/urls.py`** — add `CsatBreakdownReportView, CsatTrendReportView` to the `from .views import (...)` block (alphabetical: after `AgentPerformanceReportView`, before `SlaBreachRateReportView`), and two more entries to `urlpatterns`, after the three `reports/agents/*`/`reports/sla/*` paths:

```python
    path("reports/csat/trend/", CsatTrendReportView.as_view(), name="csat-trend"),
    path("reports/csat/breakdown/", CsatBreakdownReportView.as_view(), name="csat-breakdown"),
```

**No `config/api_urls.py` change** — `apps.reports.urls` is already included (Story 56).

---

## Frontend Tasks

### 4 — `WaffleChart`

**Create file: `frontend/src/shared/ui/chart/WaffleChart.tsx`**

```tsx
import { useTranslation } from 'react-i18next'

import type { ChartCategory } from './types'

const GRID_SIZE = 10
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE

function colorFor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`
}

/**
 * Largest-remainder (Hamilton) apportionment: floor every category's
 * exact share of TOTAL_CELLS, then hand out the leftover cells to the
 * categories with the largest fractional remainder, largest first. A
 * naive Math.round per category can under- or over-shoot 100 (three
 * categories at 33.3% each round to 99, not 100) — this method always
 * sums to exactly TOTAL_CELLS. Verified against 8 cases including exact
 * thirds, a 2-way split, and a 5-way equal split — see Story 59
 * `## Prerequisites`.
 */
function allocateCells(values: readonly number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total === 0) return values.map(() => 0)
  const exact = values.map((v) => (v / total) * TOTAL_CELLS)
  const floors = exact.map(Math.floor)
  const remainders = exact.map((e, i) => e - floors[i])
  let remaining = TOTAL_CELLS - floors.reduce((sum, f) => sum + f, 0)
  const order = remainders
    .map((_, i) => i)
    .sort((a, b) => remainders[b] - remainders[a])
  const result = [...floors]
  for (let i = 0; i < remaining; i++) result[order[i]] += 1
  return result
}

type WaffleChartProps = {
  categories: readonly ChartCategory[]
  formatValue?: (n: number) => string
}

/**
 * A 10×10 grid, one square per percentage point — CONVENTIONS.md § 25
 * row 6 (RPT-4's satisfied/neutral/dissatisfied breakdown), explicitly
 * NOT Pie/Donut (`charts.csv` rates those risk:high for accessibility;
 * Waffle is risk:low for the identical Part-to-Whole use case).
 *
 * Individual cells are `aria-hidden` — 100 near-identical decorative
 * fragments of ONE aggregate percentage each are not 100 independent
 * data points the way a bar chart's bars are. The grid carries one
 * summary `role="img"`/`aria-label`; the LEGEND below it is real, visible
 * text (not ARIA-only) — that is what "always labeled with percentage
 * text" (§ 25) means here, backed by `ChartFrame`'s own mandatory
 * `ChartDataTable` fallback.
 */
export function WaffleChart({ categories, formatValue = String }: WaffleChartProps) {
  const { t } = useTranslation('common')
  const counts = categories.map((c) => c.value)
  const cellCounts = allocateCells(counts)
  const total = counts.reduce((sum, v) => sum + v, 0)

  const cells: number[] = []
  cellCounts.forEach((count, categoryIndex) => {
    for (let i = 0; i < count; i++) cells.push(categoryIndex)
  })

  const summaryLabel = categories
    .map((c, i) => `${c.label}: ${formatValue(total === 0 ? 0 : cellCounts[i])}%`)
    .join(', ')

  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={summaryLabel}
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, maxWidth: 240 }}
      >
        {cells.map((categoryIndex, cellIndex) => (
          <div
            key={cellIndex}
            aria-hidden="true"
            className="aspect-square rounded-xs"
            style={{ backgroundColor: colorFor(categoryIndex) }}
          />
        ))}
      </div>
      <ul className="flex flex-wrap gap-4">
        {categories.map((category, index) => (
          <li key={category.key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className="size-3 rounded-xs"
              style={{ backgroundColor: colorFor(index) }}
            />
            {category.label}
            {' — '}
            {formatValue(total === 0 ? 0 : cellCounts[index])}
            {t('chart.percentSuffix', { defaultValue: '%' })}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Two things to verify before wiring this into task 6, not assume:**

- The `t('chart.percentSuffix', { defaultValue: '%' })` call is a placeholder — **do not ship it as-is**. A bare `%` sign is not correctly localized for Arabic-indic numerals in every locale; confirm whether `useFormatters().number(v, { style: 'percent' })` (already used by `SlaReportsPage.tsx`/`AgentReportsPage.tsx` for `csat`'s own percentage) produces better output than string-concatenating `%`, and if so, pass pre-formatted strings into `formatValue` from `CsatReportsPage.tsx` instead of doing the `%` suffix inside `WaffleChart` itself — mirroring how `BarChart`/`LineChart` accept a `formatValue` callback rather than formatting internally. **Prefer removing the inline `%` and `chart.percentSuffix` key entirely**, and have task 6 pass a `formatValue` that already returns a complete formatted string (e.g. `"60%"`) — the simpler, more consistent design, matching every other chart's `formatValue` contract exactly.
- `cellCounts[index]` is a **cell count** (0-100), which is only a true percentage because `TOTAL_CELLS = 100`. If `GRID_SIZE` ever changes, this silently stops being a percentage — add a one-line comment at `TOTAL_CELLS`'s declaration noting this coupling, so a future edit does not break the implicit assumption.

Add to the barrel:

**File: `frontend/src/shared/ui/chart/index.ts`** — add `export { WaffleChart } from './WaffleChart'`. No new exported type — `WaffleChart` reuses `ChartCategory` like `BarChart` does.

### 5 — Promote `formatBucket` to a shared helper

**Create file: `frontend/src/features/reports/lib/formatBucket.ts`**

```ts
import type { useFormatters } from '@/shared/hooks/useFormatters'

/** A bucket is a calendar date, not an instant — a bare YYYY-MM-DD is
 * parsed as UTC midnight by the JS Date constructor, so formatting
 * without timeZone: 'UTC' shows the previous day west of Greenwich. See
 * Story 56 `## Prerequisites`. Third occurrence (after `TicketReportsPage`
 * and `SlaReportsPage` each defined their own copy) is what crosses
 * CONVENTIONS.md § 8's "used by two or more → move it" threshold. */
export function formatBucket(
  date: ReturnType<typeof useFormatters>['date'],
  bucketValue: string,
): string {
  return date(bucketValue, { dateStyle: 'medium', timeZone: 'UTC' })
}
```

**File: `frontend/src/features/reports/components/TicketReportsPage.tsx`** — delete the inline `formatBucket` function (lines 67-73) and its `date` destructure's now-single remaining use; replace call sites `formatBucket(x)` with `formatBucket(date, x)`, importing `{ formatBucket } from '../lib/formatBucket'`.

**File: `frontend/src/features/reports/components/SlaReportsPage.tsx`** — the identical change (delete its own inline copy, lines 58-64, import the shared one instead).

Verify both pages still build and their existing bucket-label rendering is unchanged after this refactor — this is a pure extraction, no behavior change (`## Verification Steps` step 6 covers this explicitly).

### 6 — Types and API layer

No new row type for the trend endpoint — `/api/reports/csat/trend/` returns rows shaped exactly like `VolumePoint`/`SlaTrendPoint` (`{bucket, series, value}`), but with `series` typed as the three rating literals rather than an open string. **Create file: `frontend/src/features/reports/types/csat.ts`**:

```ts
export const CSAT_RATINGS = ['satisfied', 'neutral', 'dissatisfied'] as const
export type CsatRating = (typeof CSAT_RATINGS)[number]

/** One row from `/api/reports/csat/trend/`. */
export type CsatTrendPoint = {
  bucket: string
  series: CsatRating
  value: number
}

/** One row from `/api/reports/csat/breakdown/`. Deliberately typed as
 * `{key, value}`, NOT `ChartCategory` — unlike RPT-3's agent rows, a
 * rating's `label` is a frontend-translatable enum (`ratings.satisfied`
 * etc.), so the backend sends no label and the frontend builds
 * `ChartCategory[]` itself, the same `labelForDimensionValue`-style
 * mapping RPT-1's breakdown page already does. */
export type CsatBreakdownRow = {
  key: CsatRating
  value: number
}
```

**Create file: `frontend/src/features/reports/api/getCsatTrend.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { CsatTrendPoint } from '../types/csat'

export type CsatTrendParams = { from?: string; to?: string; bucket?: 'day' | 'week' | 'month' }

export function getCsatTrend(params: CsatTrendParams): Promise<CsatTrendPoint[]> {
  return api.get<CsatTrendPoint[]>('/reports/csat/trend/', { params })
}
```

**Create file: `frontend/src/features/reports/api/useCsatTrend.ts`** — `useQuery` on `reportKeys.resource('csat-trend', params)`, the same shape as `useSlaTrend.ts`.

**Create file: `frontend/src/features/reports/api/getCsatBreakdown.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { CsatBreakdownRow } from '../types/csat'

export type CsatBreakdownParams = { from?: string; to?: string }

export function getCsatBreakdown(params: CsatBreakdownParams): Promise<CsatBreakdownRow[]> {
  return api.get<CsatBreakdownRow[]>('/reports/csat/breakdown/', { params })
}
```

**Create file: `frontend/src/features/reports/api/useCsatBreakdown.ts`** — `useQuery` on `reportKeys.resource('csat-breakdown', params)`. No new `reportKeys.ts` — reuse the existing one.

### 7 — Locales

**File: `frontend/src/features/reports/locales/en.json`** — add a top-level `csat` block and a `sidebarCsat` key:

```json
"sidebarCsat": "Customer Satisfaction",
"csat": {
  "trend": {
    "title": "Satisfaction trend",
    "description": "Feedback ratings received in the selected period, over time."
  },
  "breakdown": {
    "title": "Satisfaction breakdown",
    "description": "Share of feedback ratings for the selected period."
  },
  "ratings": {
    "satisfied": "Satisfied",
    "neutral": "Neutral",
    "dissatisfied": "Dissatisfied"
  },
  "fields": { "rating": "Rating", "count": "Feedback count" }
}
```

**File: `ar.json`** — the mirror, with `ratings` copied **verbatim** from `features/portal/locales/ar.json:87-89` (`"satisfied": "راضٍ"`, `"neutral": "محايد"`, `"dissatisfied": "غير راضٍ"`) so the staff report and the customer-facing submission form never disagree in Arabic:

```json
"sidebarCsat": "رضا العملاء",
"csat": {
  "trend": {
    "title": "اتجاه الرضا",
    "description": "تقييمات التغذية الراجعة الواردة خلال الفترة المحددة، عبر الزمن."
  },
  "breakdown": {
    "title": "توزيع الرضا",
    "description": "نسبة تقييمات التغذية الراجعة للفترة المحددة."
  },
  "ratings": {
    "satisfied": "راضٍ",
    "neutral": "محايد",
    "dissatisfied": "غير راضٍ"
  },
  "fields": { "rating": "التقييم", "count": "عدد التقييمات" }
}
```

Verify the final key set matches `en.json` exactly (`## Verification Steps` step 10) — do not hand-copy without diffing.

### 8 — The report screen

**Create file: `frontend/src/features/reports/components/CsatReportsPage.tsx`**

Copy `SlaReportsPage.tsx`'s date-range + bucket filter block verbatim (its own copy, `id="agent-report-from"`-style — use `csat-report-from`/`csat-report-to` ids here). Local state:

```tsx
const [from, setFrom] = useState('')
const [to, setTo] = useState('')
const [bucket, setBucket] = useState<'day' | 'week' | 'month'>('day')

const trendParams = { ...(from ? { from } : {}), ...(to ? { to } : {}), bucket }
const trendQuery = useCsatTrend(trendParams)

const breakdownParams = { ...(from ? { from } : {}), ...(to ? { to } : {}) }
const breakdownQuery = useCsatBreakdown(breakdownParams)
```

```tsx
function labelForRating(rating: CsatRating): string {
  return t(`csat.ratings.${rating}`)
}
```

**Trend chart** — reuses `LineChart` exactly as the other two report pages do:

```tsx
function toChartSeries(rows: CsatTrendPoint[]): ChartSeries[] {
  const bySeries = new Map<CsatRating, CsatTrendPoint[]>()
  for (const row of rows) {
    const existing = bySeries.get(row.series)
    if (existing) existing.push(row)
    else bySeries.set(row.series, [row])
  }
  return [...bySeries.entries()].map(([key, points]) => ({ key, label: labelForRating(key), points }))
}
```

```tsx
<ChartFrame
  title={t('csat.trend.title')}
  description={t('csat.trend.description')}
  query={trendQuery}
  isEmpty={(rows) => rows.length === 0}
  action={<Button variant="outline" size="sm" onClick={() => void handleExportTrend()}><DownloadIcon />{t('actions.exportCsv')}</Button>}
  table={(rows) => (
    <ChartDataTable
      caption={t('chart.dataTableCaption', { ns: 'common', title: t('csat.trend.title') })}
      columns={[t('fields.period'), t('csat.fields.rating'), t('csat.fields.count')]}
      rows={rows.map((row) => [formatBucket(date, row.bucket), labelForRating(row.series), String(row.value)])}
    />
  )}
>
  {(rows) => <LineChart series={toChartSeries(rows)} formatBucket={(b) => formatBucket(date, b)} />}
</ChartFrame>
```

**Breakdown chart** — `ChartFrame` wrapping `WaffleChart`, with the enum-label mapping RPT-1's breakdown page already established (`labelForDimensionValue`-shape, here `labelForRating`):

```tsx
<ChartFrame
  title={t('csat.breakdown.title')}
  description={t('csat.breakdown.description')}
  query={breakdownQuery}
  isEmpty={(rows) => rows.length === 0}
  action={<Button variant="outline" size="sm" onClick={() => void handleExportBreakdown()}><DownloadIcon />{t('actions.exportCsv')}</Button>}
  table={(rows) => (
    <ChartDataTable
      caption={t('chart.dataTableCaption', { ns: 'common', title: t('csat.breakdown.title') })}
      columns={[t('csat.fields.rating'), t('csat.fields.count')]}
      rows={rows.map((row) => [labelForRating(row.key), String(row.value)])}
    />
  )}
>
  {(rows) => (
    <WaffleChart
      categories={rows.map((row) => ({ key: row.key, label: labelForRating(row.key), value: row.value }))}
      formatValue={(v) => number(v, { style: 'percent', maximumFractionDigits: 0 })}
    />
  )}
</ChartFrame>
```

Passing `formatValue={(v) => number(v, { style: 'percent', ... })}` here means `WaffleChart` receives a **cell count 0-100** and must format it as `v / 100` for `Intl.NumberFormat`'s `style: 'percent'` (which expects a 0-1 fraction, not 0-100) — **resolve this unit mismatch explicitly** before finalizing task 4/8 together: either have `WaffleChart` call `formatValue(cellCounts[index] / 100)` internally (passing a true 0-1 fraction, consistent with how `SlaReportsPage`/`AgentReportsPage` already call `number(row.rate, { style: 'percent' })` with a 0-1 input), or have the page's `formatValue` divide by 100 itself. **Prefer the former** — `WaffleChart` should always call `formatValue` with a 0-1 fraction, matching every other percentage-shaped `formatValue` callback in this codebase (`GaugeChart`'s own default excepted, which formats a 0-1 input as `Math.round(n*100)+'%'` for the *same* reason). Fix `WaffleChart.tsx`'s `formatValue` calls in task 4 to pass `cellCounts[index] / 100`, not the raw cell count, before this task is done.

`exportReport`/`toast` wiring mirrors `SlaReportsPage.tsx`'s two-export-buttons shape exactly (`handleExportTrend`/`handleExportBreakdown`, each calling `exportReport('/reports/csat/...', 'csat-...', params)`).

### 9 — Route

**File: `frontend/src/app/router.tsx`** — inside the **same** `reports.view`-gated block, add a fourth sibling route after `reports/agents`:

```tsx
{
  path: 'reports/csat',
  lazy: async () => {
    const { CsatReportsPage } = await import('@/features/reports/components/CsatReportsPage')
    return { element: <CsatReportsPage /> }
  },
},
```

### 10 — Sidebar link

**File: `frontend/src/app/Sidebar.tsx`** — inside the **same** `<Can permission="reports.view">` block, add a fourth `SidebarLink` immediately after `/reports/agents`:

```tsx
<SidebarLink
  to="/reports/csat"
  icon={ChartNoAxesColumnIcon}
  label={t('reports:sidebarCsat')}
  collapsed={collapsed}
/>
```

Same icon as the other three report links, same reasoning already given twice (no dedicated icon exists; reusing this one beats inventing a semantically-strained new one).

---

## Edge Cases & Failure Modes

- **No `Feedback` rows at all in the selected range** → `bucketed_counts` still returns one gap-filled row per bucket... **except this only happens with `series_field` set when at least one series exists at all**; with zero `Feedback` rows anywhere, `counts` is empty, `series_keys` is `[None]`... **verify this exact branch live before shipping** (`## Verification Steps` step 2) — it is a genuinely different code path from `RPT-1`'s status/priority trends, which always have at least one series (every `Ticket` has a `status`), whereas a fresh deployment could have literally zero `Feedback` rows ever submitted.
- **A rating that has never been submitted** (today: `neutral`, `dissatisfied`) → absent from both the trend's series list and the breakdown's rows — not shown as a zero-value line or a zero-count Waffle category. `WaffleChart`'s `categories` prop is simply shorter; `allocateCells` still sums correctly over however many categories are actually passed.
- **A Waffle grid with only one category (100% one rating)** → `allocateCells([N])` returns `[100]` (verified in the dry run above, the `[100,0,0]`/`[1,0,0]` cases) — a single-color grid, not a rendering error.
- **A Waffle grid with a genuine 3-way near-tie** (e.g. 33/33/34) → the largest-remainder method still sums to exactly 100, verified; no category visually "steals" a square from another due to rounding drift.
- **RTL rendering of the Waffle grid** → expected to mirror automatically via CSS Grid's own `dir`-aware column flow, with **no manual coordinate code**, unlike every other chart in this epic. This is the one part of this story not yet visually confirmed in a real browser — explicit verification step, not an assumption carried into `## Done Criteria` unchecked.
- **`?export=csv` on the trend endpoint with zero series** → `csv_columns` still writes just the header row, the same "empty body, correct header" behavior `RPT-1`'s own CSV export already established for an unsplit report.
- **`formatBucket`'s extraction (task 5)** → a pure refactor; if `TicketReportsPage.tsx`/`SlaReportsPage.tsx`'s bucket-label rendering changes AT ALL after this task, that is a regression to catch in `## Verification Steps` step 6, not an acceptable side effect of "also fixing something" — this task changes zero behavior, only where the four lines live.
- **An `agent`-role user hitting either endpoint directly** → `403`, `reports.view` not held — no new permission check to get wrong, reuses Story 56's existing grant.

---

## Test Plan

Per standing project policy this project authors no automated tests (`CONVENTIONS.md` § 16). This story adds none.

Its checks are: `manage.py check`/`ruff`; `manage.py shell` reproduction of both endpoints' recorded dry-run numbers, including the zero-`Feedback` edge case; real HTTP against both endpoints across permission states and CSV export; the frontend's `lint`/`format:check`/`check:rtl`/`build`; a Node-level re-verification of `allocateCells`'s largest-remainder math against the same 8 cases recorded in `## Prerequisites`; an `en`/`ar` key-set diff (including the copied `ratings` wording matching `portal`'s exactly); and a bilingual walkthrough with an explicit RTL check of the Waffle grid. All below.

---

## Verification Steps

1. **Backend gates:** from `backend/` — `python manage.py check`; `python manage.py makemigrations --check --dry-run` reports **no changes**; `ruff check apps/ && ruff format --check apps/`.
2. **Both endpoints reproduce the recorded dry run, including the zero-data branch.** In `manage.py shell`:
   ```python
   from apps.reports.aggregation import bucketed_counts, grouped_counts, parse_date_range
   from apps.tickets.models import Feedback
   start, end = parse_date_range({})
   trend = bucketed_counts(Feedback.objects.all(), date_field="created_at", start=start, end=end, bucket="day", series_field="rating")
   print(len(trend), [r for r in trend if r["value"] > 0])
   print(grouped_counts(Feedback.objects.filter(created_at__gte=start, created_at__lt=end), field="rating"))
   ```
   Then, in the same shell, temporarily wrap the same two calls in a transaction that deletes all `Feedback` rows first (`Feedback.objects.all().delete()` inside `with transaction.atomic(): ... transaction.set_rollback(True)`, or simply note the row count before/after and restore by not committing) to confirm **neither call raises** when there is truly zero feedback data — this is the branch named in `## Edge Cases`, verify it does not crash before trusting it in production.
3. **Real HTTP, both endpoints, with a `manager` token:** `GET /api/reports/csat/trend/` → `200`, array of `{bucket, series, value}`. `GET /api/reports/csat/breakdown/` → `200`, array of `{key, value}`, descending. Both `?export=csv` → correct `Content-Type`/`Content-Disposition` (`csat-trend.csv`, `csat-breakdown.csv`), UTF-8 BOM present.
4. **Permission states:** `admin`/superuser → `200` on both; `agent` → **`403`**; no token → `401`.
5. **`allocateCells` re-verified in Node**, the same 8 cases recorded in `## Prerequisites`, confirming every result sums to exactly 100 — run this as a standalone script against the actual shipped `WaffleChart.tsx` source (extract the function or import it in a scratch test file), not re-derived from memory.
6. **`formatBucket` extraction regression check.** Before and after task 5, capture a screenshot or copy the rendered bucket labels on `TicketReportsPage`/`SlaReportsPage` for the same date range — confirm byte-identical output post-refactor.
7. **Frontend gates:** `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` — all clean.
8. **The `WaffleChart` percent-fraction unit fix, explicitly.** Confirm `WaffleChart.tsx` calls `formatValue` with a 0-1 fraction (`cellCounts[index] / 100`), not a raw 0-100 cell count — render one waffle with a known allocation (e.g. `[60, 40]`) and confirm the legend reads "60%"/"40%", not "6000%"/"4000%" or "0.6%"/"0.4%" (both plausible unit-mismatch bugs if the fix from task 8 is skipped).
9. **Bilingual walkthrough.** `npm run dev`, signed in as `admin`/`manager`. Open `/reports/csat` from the new sidebar link (fourth distinct label): the trend line renders with a per-rating legend; the Waffle grid renders 100 small squares in a 10×10 layout with a legend below showing each rating's percentage; toggle "Show data table" on both and confirm the fallback tables match. Export both CSVs. Adjust the date range/bucket and confirm both charts update. Switch to Arabic and confirm: the trend line's time axis runs RTL (already-verified `LineChart` behavior), and — the one new check — **the Waffle grid's column order visually mirrors** (first-filled column now on the right) with no manual code producing this; if it does NOT mirror, `## Prerequisites`'s CSS-Grid-auto-RTL assumption was wrong and needs a real fix (`direction: rtl` override or an explicit reversed cell order), not a shrug.
10. **Locale key parity:** diff `features/reports/locales/en.json` against `ar.json` — identical key set, including the new `csat` block and `sidebarCsat`. Additionally confirm `csat.ratings.*`'s Arabic values match `features/portal/locales/ar.json:87-89` **exactly**, character for character.
11. **Permission boundary:** an `agent`-role user sees no "Customer Satisfaction" sidebar entry, and `/reports/csat` redirects to `/` when navigated to directly.

---

## Done Criteria

- [ ] `CsatTrendReportView`/`CsatBreakdownReportView` added to `apps/reports/views.py`, each `permission_map = {"get": Permissions.REPORTS_VIEW}` — the **existing** permission; both call `bucketed_counts`/`grouped_counts` directly, no new `apps/reports/csat.py` module.
- [ ] `apps/reports/urls.py` gains `reports/csat/trend/` and `reports/csat/breakdown/`. **No** `config/api_urls.py` change. **No** new migration.
- [ ] `frontend/src/shared/ui/chart/WaffleChart.tsx` — `allocateCells` verified to always sum to exactly 100 (step 5); cells are `aria-hidden`, the grid carries one summary `role="img"`; `formatValue` is called with a 0-1 fraction, not a raw cell count (step 8); exported from the barrel.
- [ ] `formatBucket` promoted to `features/reports/lib/formatBucket.ts`; `TicketReportsPage.tsx`/`SlaReportsPage.tsx` both updated to import it, with zero rendering change (step 6).
- [ ] `features/reports/types/csat.ts`, four new `api/` files (reusing the existing `reportKeys.ts`/`exportReport.ts`), `components/CsatReportsPage.tsx` — trend via the existing `LineChart`, breakdown via the new `WaffleChart`, both `ChartFrame`-wrapped with a required `ChartDataTable` fallback.
- [ ] Route `reports/csat` and sidebar link added inside the **existing** `reports.view` blocks; sidebar label distinct from the other three (`sidebarCsat`).
- [ ] `csat` locale block and `sidebarCsat` key added to both `en.json`/`ar.json` with an identical key set; `ratings.*` Arabic wording matches `features/portal/locales/ar.json` exactly.
- [ ] Verified by shell: both endpoints reproduce the recorded dry-run numbers, including a confirmed-non-crashing zero-`Feedback` branch (step 2).
- [ ] Verified by real HTTP: both endpoints, three permission states, both CSV exports (steps 3-4).
- [ ] Verified in Node: the largest-remainder allocation, re-run against the shipped source, not re-derived from memory (step 5).
- [ ] Verified in the browser: the full bilingual walkthrough, with the Waffle grid's RTL mirroring explicitly confirmed (not assumed) (step 9), and the agent-role permission boundary (step 11).
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 60 (`RPT-5`, Management Dashboards).**
