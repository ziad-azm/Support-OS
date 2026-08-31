# Story 60 — Management Dashboards (Story: SUPPORTOS-81)

## Prerequisites

- **`RPT-0`/`RPT-1`/`RPT-2`/`RPT-3`/`RPT-4` (Stories 55-59) completed.** This is the intake's own dependency line (`Dependencies: RPT-1..4`) and the **last** story in `EPIC 11`. `apps/reports/aggregation.py::grouped_counts`, `apps/reports/sla.py::sla_breach_rate`, `apps/reports/views.py::BaseReportView`, `Permissions.REPORTS_VIEW` (already granted to `admin`/`manager`), and `frontend/src/shared/ui/chart/GaugeChart.tsx` all exist. **This story adds no new permission and no new migration** — the sixth `RPT-*` story in a row for which this holds.
- **§ 25 row 7 (RPT-5) is explicit and literal: "Bullet Chart grid... `RPT-5` reuses `RPT-0`'s charts... not a new chart type."** `GaugeChart.tsx`'s own docstring (written during `RPT-2`, `GaugeChart.tsx:9-10`) already says *"RPT-5 reuses this component unchanged (§ 25 line 1636)"* — this story is that promise kept: **`shared/ui/chart/GaugeChart.tsx` receives ZERO code changes.** Every one of the four KPIs is instead defined so it fits the component's *existing* contract exactly.
- **`GaugeChart`'s existing contract is a 0-1 "badness" fraction** (`GaugeValue.value`, `GaugeChart.tsx:21-26`: *"0-1 fraction, e.g. a breach rate"*) **against fixed zone thresholds** (`GOOD_THRESHOLD = 0.1`, `WARN_THRESHOLD = 0.25`, `GaugeChart.tsx:18-19`) where **0 is always best, 1 is always worst**. This story's entire design discipline is: define every KPI as "what fraction of X is bad," never "what fraction is good" — so all four gauges share one honest, uniform reading (low = good, everywhere on the dashboard) with no per-KPI threshold, no inverted zone order, and no new prop on `GaugeChart`. A "higher is better, invert the zones" variant was considered for the CSAT KPI (raw `%satisfied`) and rejected: it would require changing `GaugeChart`'s already-shipped, already RTL-verified geometry for one KPI's sake, when the exact same information is already expressible as a dissatisfaction rate — a pure reframing, not a data loss.
- **The four KPIs, defined and verified live against this project's Postgres (default 30-day range: 13 tickets, 10 open, 9 unassigned-open):**
  | KPI | Definition | Value verified |
  |---|---|---|
  | `open_rate` | open tickets (created in range) ÷ all tickets (created in range) | `10 / 13 = 0.769` |
  | `sla_health` | pooled SLA breaches ÷ pooled SLA-evaluated tickets, both dimensions combined | `(11+12) / (13+13) = 0.885` |
  | `csat_risk` | (`neutral` + `dissatisfied` feedback) ÷ all feedback (submitted in range) | `0 / 1 = 0.0` |
  | `agent_load` | unassigned open tickets ÷ all open tickets | `9 / 10 = 0.9` |

  Reproduced with the exact code shape task 2 uses:
  ```python
  open_tickets = Ticket.objects.filter(created_at__gte=start, created_at__lt=end).exclude(
      status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED])
  # open_rate = open_tickets.count() / total; agent_load = unassigned / open_tickets.count()
  breach = sla_breach_rate(start, end)  # sla_health = sum(breached) / sum(met+breached), both rows
  feedback = grouped_counts(Feedback.objects.filter(created_at range), field="rating")
  # csat_risk = (neutral+dissatisfied) / sum(all counts)
  ```
- **`open_rate`/`agent_load` reuse an EXISTING "what counts as open" convention, not a new one.** `apps/sla/assignment_rules.py:48-59::_pick_least_loaded` (*"the candidate with the fewest currently-open (not resolved/closed) assigned tickets"*) and `apps/sla/tasks.py:64-66` both define "open" as `.exclude(status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED])` — the complement, not an inclusion list of `[OPEN, IN_PROGRESS]`. This story reuses that exact exclude-based definition (verified to produce identical counts against today's data, since `Status` has only these four values) because it is future-proof against a status value being added later, and because it is already the established codebase idiom for "agent workload," which `agent_load` is directly named after.
- **`sla_health` pools `RPT-2`'s two dimensions (response, resolution) into one scalar by summing counts, not averaging rates.** `sla_health = (response_breached + resolution_breached) / (response_evaluated + resolution_evaluated)` — a weighted pool, not an unweighted mean of two percentages, so a dimension with more evaluated tickets correctly carries more weight. Reuses `apps/reports/sla.py::sla_breach_rate`'s existing return shape (`met`/`breached` counts per dimension) directly; no change to that function.
- **`csat_risk` reframes `RPT-4`'s own breakdown, not `RPT-3`'s per-agent "% satisfied".** `RPT-3`'s CSAT metric (`apps/reports/agents.py::CSAT`) is `satisfied / (met+breached)`-shaped per agent; this KPI is org-wide and inverted (`(neutral+dissatisfied) / total`, a badness fraction) so it fits the same 0-1-badness convention as the other three gauges on this one dashboard. Reuses `apps/reports/aggregation.py::grouped_counts` directly (the exact call `CsatBreakdownReportView` already makes, `views.py:230-232`), not a new query.
- **A KPI with an undefined denominator (no tickets, no evaluated SLA pairs, no feedback in range) returns `value: null`**, the same "omit rather than fabricate a zero" rule `RPT-2`/`RPT-3`/`RPT-4` already established (`CONVENTIONS.md` § 27 point 10 and its predecessors). Verified: Python's `csv.writer` renders `None` as an empty cell, not the literal string `"None"` — confirmed live, no special-case needed in `csv_response`.
- **This story adds one new point to `CONVENTIONS.md` § 27** recording the "reuse `GaugeChart` with zero code changes by framing every KPI as a 0-1 badness fraction against the existing thresholds" recipe — the concrete, generalizable lesson this story teaches for any future gauge-shaped KPI.
- **No new `Ticket`/`Feedback`/`SLAPolicy` model field, no schema migration.** This is `EPIC 11`'s last story; after it, `RPT-0` through `RPT-5` are all implemented.

---

## Story Goal

The combined-KPI half of `RPT-0`'s data — one endpoint, one dashboard screen, reusing `GaugeChart` unchanged:

1. **Dashboard KPI API** — `GET /api/reports/dashboard/kpis/`, a single `BaseReportView` subclass returning the four KPIs above as flat `{key, value}` rows (`value` is `null` when undefined), fixed order (`open_rate`, `sla_health`, `csat_risk`, `agent_load` — the intake's own ordering).
2. **Report UI** — a `/reports/dashboard` screen: a date-range control (no bucket — a whole-period snapshot, the same shape `SlaBreachRateReportView`/`AgentPerformanceReportView` already use), one `ChartFrame`-wrapped `GaugeChart` showing all four KPIs in one grid, the mandatory `ChartDataTable` fallback, and a CSV export button.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/reports/dashboard.py` | The domain half — combines three existing data sources (`Ticket`, `sla_breach_rate`, `Feedback` via `grouped_counts`) into one flat KPI list. Mirrors the `apps/reports/agents.py`/`sla.py` split. |
| Zero `GaugeChart.tsx` changes | § 25's own explicit instruction; achieved by framing every KPI as the same 0-1 badness fraction the component already expects. |
| Reusing `.exclude(status__in=[RESOLVED, CLOSED])` | Already this codebase's own "open ticket" idiom (`assignment_rules.py`, `tasks.py`) — not invented here. |

**Not here, and why:**

- **No configurable KPI targets/thresholds.** Same standing decision `RPT-2`'s `GOOD_THRESHOLD`/`WARN_THRESHOLD` already made — no "acceptable rate" setting exists anywhere in `OrganizationSettings` or elsewhere, and this story does not add one.
- **No drill-through from a gauge to the underlying report** (e.g., clicking `sla_health` does not navigate to `/reports/sla`). Not in the intake; each of the four detail reports already exists as its own sidebar link for a user who wants to go deeper.
- **No auto-refresh / polling.** A dashboard "at-a-glance" view is still a request-on-load-and-filter-change screen, the same interaction model every other `RPT-*` report uses — no new pattern introduced.
- **No new chart component, no new `shared/ui/chart/` file.** The one deliberate constraint this whole story is designed around.
- **No caching, no Celery pre-aggregation.** Same standing rule as every prior `RPT-*` story — this endpoint is now the single most expensive one (it calls into three other computations), and it is *still* left uncached, on the same "revisit when measurably slow" basis `aggregation.py`'s own module docstring states.

---

## Context — Read These Files First

1. `.squad/stories/reports-analytics/SUPPORTOS-81/intake.md` — one task (*"Combined KPI API + dashboard UI — Open tickets, SLA health, CSAT, agent load in one dashboard reusing RPT-0 charts"*), dependency `RPT-1..4`, **no acceptance criteria, no attachments**.
2. `CONVENTIONS.md` § 25 line 1636 (the `RPT-5` table row, quoted in full in `## Prerequisites`) and **§ 27** (this story adds point 11).
3. `frontend/src/shared/ui/chart/GaugeChart.tsx` (full file, ~115 lines) — read end to end, especially `GaugeValue` (21-26) and the `GOOD_THRESHOLD`/`WARN_THRESHOLD` constants (18-19) and their own comment (7-13) already anticipating this story. **This file is read-only for this story — confirm you are NOT editing it before starting task 6.**
4. `backend/apps/sla/assignment_rules.py:48-59::_pick_least_loaded` and `backend/apps/sla/tasks.py:64-66` — the existing `.exclude(status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED])` "open ticket" idiom task 1's `open_rate`/`agent_load` reuse verbatim.
5. `backend/apps/tickets/models.py:34-38` (`Ticket.Status` choices), `:79-86` (`assigned_agent`, nullable) — the two fields `agent_load` reads.
6. `backend/apps/reports/sla.py::sla_breach_rate` (full function) — its return shape (`[{"key": "response"|"resolution", "met", "breached", "pending", "rate"}, ...]`) is what task 1's `sla_health` pools; read it to confirm `met`/`breached` are the two counts to sum, not `rate` (averaging two already-computed rates would double-weight the smaller dimension).
7. `backend/apps/reports/aggregation.py::grouped_counts` (183-219) — the exact call `CsatBreakdownReportView.get_report` already makes (`views.py:230-232`); task 1's `csat_risk` reuses this identical call, not a new query.
8. `backend/apps/reports/views.py` — `BaseReportView` (1-58), `SlaBreachRateReportView` (RPT-2's whole-range, no-bucket shape, closest structural precedent) and `AgentPerformanceReportView` (RPT-3, another no-bucket snapshot) — task 3's new class is appended after the current end of file (line 232).
9. `backend/apps/reports/urls.py` (34 lines) — the `path()`-only list task 4 extends with one entry under a new `reports/dashboard/` prefix.
10. `backend/apps/reports/export.py::rows_to_csv` — confirm `row.get(key, "")` combined with a `None` value writes an empty CSV cell (verified live in `## Prerequisites`, not re-derived here) — no special-case needed for the `null`-valued KPI rows.
11. `frontend/src/features/reports/components/SlaReportsPage.tsx` (full file) — the breach-rate half (its `ChartFrame`+`GaugeChart` composition, `isEmpty={(rows) => rows.every((row) => row.rate === null)}`, and its `number(v, { style: 'percent', ... })` `formatValue`) is the closest possible copy for task 8's `ManagementDashboardPage.tsx` — same shape, four gauges instead of two, no bucket `Select`.
12. `frontend/src/features/reports/api/getSlaBreachRate.ts`/`useSlaBreachRate.ts`, `api/exportReport.ts`, `api/reportKeys.ts` — the exact shape task 6/7's new API files follow.
13. `frontend/src/app/router.tsx` and `frontend/src/app/Sidebar.tsx` — the existing `reports.view`-gated block/`<Can>`, now holding four sibling routes/links; tasks 9/10 add a fifth (and final) one.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Combined KPI API + dashboard UI, reusing RPT-0 charts.** | Intake, sole task | One `BaseReportView` subclass; `ChartFrame`-wrapped `GaugeChart`, unmodified. |
| **Open tickets, SLA health, CSAT, agent load — in that order.** | Intake's own KPI list | `DASHBOARD_KPIS = ("open_rate", "sla_health", "csat_risk", "agent_load")`, a fixed tuple. |
| **Every KPI is a 0-1 badness fraction against `GaugeChart`'s existing thresholds.** | § 25 row 7, `GaugeChart.tsx`'s own forward comment | No new prop, no per-KPI threshold, no inverted-zone variant. |
| **"Open" reuses the existing `.exclude(status__in=[RESOLVED, CLOSED])` idiom.** | `assignment_rules.py`/`tasks.py` precedent | `apps/reports/dashboard.py::dashboard_kpis`. |
| **SLA health pools counts, not rates.** | This story's design, to avoid double-weighting the smaller dimension | `sum(breached) / sum(met + breached)` across both `sla_breach_rate` rows. |
| **A KPI with no denominator is `null`, never a fabricated `0`.** | § 27 point 10 and its predecessors | `_safe_ratio` helper, `None` on zero denominator. |
| **The export param is `export`, never `format`.** | § 27 point 4 | Inherited from `BaseReportView`. |
| **No new permission, no new migration.** | `reports.view` already covers every `RPT-*` report | No `apps/reports/migrations/0002_*`. |

---

## Backend Tasks

### 1 — Dashboard KPI domain helper

**Create file: `backend/apps/reports/dashboard.py`**

```python
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
    open_tickets = all_tickets.exclude(
        status__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED]
    )
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
```

`sla_breach_rate`/`grouped_counts` imports create no cycle — `apps.reports.dashboard` → `apps.reports.sla`/`apps.reports.aggregation`/`apps.tickets.models`, the same leaf-import shape every other `apps/reports/*.py` module already has. Verify this holds (a one-line `grep` for any `apps.reports` import inside `apps/tickets/models.py`, `apps/reports/sla.py`, `apps/reports/aggregation.py` — none exists in any prior story, and this task adds none).

---

### 2 — Dashboard KPI report view

**File: `backend/apps/reports/views.py`** — add the import and append the class after `CsatBreakdownReportView` (current end of file, line 232).

Add to the existing import block:

```python
from .dashboard import dashboard_kpis
```

```python
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
```

---

### 3 — URLs

**File: `backend/apps/reports/urls.py`** — add `DashboardKpiReportView` to the `from .views import (...)` block (alphabetical: first, before `AgentPerformanceReportView`), and one entry to `urlpatterns`, after the two `reports/csat/*` paths:

```python
    path("reports/dashboard/kpis/", DashboardKpiReportView.as_view(), name="dashboard-kpis"),
```

**No `config/api_urls.py` change** — `apps.reports.urls` is already included (Story 56).

---

## Frontend Tasks

### 4 — Types

**Create file: `frontend/src/features/reports/types/dashboard.ts`**

```ts
/** Fixed order, mirroring `apps/reports/dashboard.py::DASHBOARD_KPIS` —
 * "Open tickets, SLA health, CSAT, agent load", the intake's own list. */
export const DASHBOARD_KPIS = ['open_rate', 'sla_health', 'csat_risk', 'agent_load'] as const
export type DashboardKpi = (typeof DASHBOARD_KPIS)[number]

/** One row from `/api/reports/dashboard/kpis/`. `value` is a 0-1
 * "badness" fraction (0 = best, 1 = worst) — passed straight into
 * `GaugeChart` with no transformation. `null` when there was nothing
 * to rate in the selected period (see Story 60 `## Prerequisites`). */
export type DashboardKpiRow = {
  key: DashboardKpi
  value: number | null
}
```

### 5 — API layer

**Create file: `frontend/src/features/reports/api/getDashboardKpis.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { DashboardKpiRow } from '../types/dashboard'

export type DashboardKpiParams = { from?: string; to?: string }

export function getDashboardKpis(params: DashboardKpiParams): Promise<DashboardKpiRow[]> {
  return api.get<DashboardKpiRow[]>('/reports/dashboard/kpis/', { params })
}
```

**Create file: `frontend/src/features/reports/api/useDashboardKpis.ts`** — `useQuery` on `reportKeys.resource('dashboard-kpis', params)`, the same shape as `useSlaBreachRate.ts`. No new `reportKeys.ts` — reuse the existing one.

### 6 — Locales

**File: `frontend/src/features/reports/locales/en.json`** — add a top-level `dashboard` block and a `sidebarDashboard` key:

```json
"sidebarDashboard": "Management Dashboard",
"dashboard": {
  "title": "Management dashboard",
  "description": "At-a-glance KPIs for the selected period.",
  "kpis": {
    "open_rate": "Open ticket rate",
    "sla_health": "SLA breach rate",
    "csat_risk": "Customer dissatisfaction",
    "agent_load": "Unassigned backlog rate"
  },
  "fields": { "kpi": "KPI", "value": "Value" },
  "noData": "No data yet"
}
```

**File: `ar.json`** — the mirror:

```json
"sidebarDashboard": "لوحة الإدارة",
"dashboard": {
  "title": "لوحة الإدارة",
  "description": "مؤشرات الأداء الرئيسية للفترة المحددة، بنظرة سريعة.",
  "kpis": {
    "open_rate": "معدل التذاكر المفتوحة",
    "sla_health": "معدل تجاوز اتفاقية مستوى الخدمة",
    "csat_risk": "عدم رضا العملاء",
    "agent_load": "معدل التذاكر غير المُعيَّنة"
  },
  "fields": { "kpi": "المؤشر", "value": "القيمة" },
  "noData": "لا توجد بيانات بعد"
}
```

Verify the final key set matches `en.json` exactly (`## Verification Steps` step 8) — do not hand-copy without diffing.

### 7 — The report screen

**Create file: `frontend/src/features/reports/components/ManagementDashboardPage.tsx`**

Copy `SlaReportsPage.tsx`'s date-range filter block (its `From`/`To` `Input type="date"` pair, `id="dashboard-report-from"`-style ids here) — **no bucket `Select`**, this is a whole-period snapshot with no time axis. Local state:

```tsx
const [from, setFrom] = useState('')
const [to, setTo] = useState('')

const params = { ...(from ? { from } : {}), ...(to ? { to } : {}) }
const query = useDashboardKpis(params)

function labelForKpi(key: DashboardKpi): string {
  return t(`dashboard.kpis.${key}`)
}

async function handleExport() {
  try {
    await exportReport('/reports/dashboard/kpis/', 'dashboard-kpis', params)
  } catch {
    toast({ tone: 'error', message: t('actions.exportFailed') })
  }
}
```

```tsx
<ChartFrame
  title={t('dashboard.title')}
  description={t('dashboard.description')}
  query={query}
  isEmpty={(rows) => rows.every((row) => row.value === null)}
  action={
    <Button variant="outline" size="sm" onClick={() => void handleExport()}>
      <DownloadIcon />
      {t('actions.exportCsv')}
    </Button>
  }
  table={(rows) => (
    <ChartDataTable
      caption={t('chart.dataTableCaption', { ns: 'common', title: t('dashboard.title') })}
      columns={[t('dashboard.fields.kpi'), t('dashboard.fields.value')]}
      rows={rows.map((row) => [
        labelForKpi(row.key),
        row.value === null
          ? t('dashboard.noData')
          : number(row.value, { style: 'percent', maximumFractionDigits: 1 }),
      ])}
    />
  )}
>
  {(rows) => (
    <GaugeChart
      gauges={rows
        .filter((row) => row.value !== null)
        .map((row) => ({ key: row.key, label: labelForKpi(row.key), value: row.value as number }))}
      formatValue={(v) => number(v, { style: 'percent', maximumFractionDigits: 1 })}
    />
  )}
</ChartFrame>
```

`number` is `useFormatters().number`, the same `{ style: 'percent' }` call `SlaReportsPage.tsx`/`AgentReportsPage.tsx`/`CsatReportsPage.tsx` already make — locale-correct digit rendering, not `GaugeChart`'s own crude `Math.round(n*100)+'%'` default. A `value: null` row is excluded from `GaugeChart`'s `gauges` array (nothing to draw) but still appears in the data table as `t('dashboard.noData')` — the same pattern `SlaReportsPage.tsx`'s breach-rate panel already established.

`exportReport`/`toast` wiring mirrors every prior report page exactly (`handleExport`, one button, one `ChartFrame`).

### 8 — Route

**File: `frontend/src/app/router.tsx`** — inside the **same** `reports.view`-gated block, add a fifth (final) sibling route after `reports/csat`:

```tsx
{
  path: 'reports/dashboard',
  lazy: async () => {
    const { ManagementDashboardPage } =
      await import('@/features/reports/components/ManagementDashboardPage')
    return { element: <ManagementDashboardPage /> }
  },
},
```

### 9 — Sidebar link

**File: `frontend/src/app/Sidebar.tsx`** — inside the **same** `<Can permission="reports.view">` block, add a fifth (final) `SidebarLink` immediately after `/reports/csat`:

```tsx
<SidebarLink
  to="/reports/dashboard"
  icon={ChartNoAxesColumnIcon}
  label={t('reports:sidebarDashboard')}
  collapsed={collapsed}
/>
```

Same icon as the other four report links, same reasoning already given three times (no dedicated icon exists; reusing this one beats inventing a semantically-strained new one).

---

## Documentation Tasks

### 10 — Conventions

**File: `CONVENTIONS.md` § 27** — add point 11:

11. **A gauge-shaped KPI can always reuse `GaugeChart` with zero code changes — frame it as a 0-1 "badness" fraction.** `GaugeChart`'s zone thresholds (`GOOD_THRESHOLD = 0.1`, `WARN_THRESHOLD = 0.25`) and orientation (0 = best, 1 = worst) are fixed, not props. `RPT-5`'s four dashboard KPIs — an open-ticket rate, a pooled SLA breach rate, a CSAT *dissatisfaction* rate (the inverse of `RPT-3`'s own "% satisfied"), and an unassigned-backlog rate — all fit this contract by construction: whichever raw quantity a KPI starts from, define its gauge input as *the share that is going wrong*, never *the share that is going right*. This is why `CsatRisk` shows dissatisfaction, not satisfaction, even though "% satisfied" is the more intuitive framing in isolation — a single dashboard-wide reading direction beats four gauges that each need to be read differently.

---

## Edge Cases & Failure Modes

- **Zero tickets created in the selected range** → `open_rate` is `null` (denominator 0); `agent_load` is *also* `null` in this case (its own denominator, `open_count`, is necessarily 0 too) — both KPIs disappear from the gauge grid together, not independently, which is correct: there is nothing to rate either way.
- **Tickets exist but none are open** (`open_count == 0`, e.g. everything already resolved) → `open_rate` computes normally (`0 / total = 0.0`, a genuinely good score), but `agent_load`'s own denominator is 0 → `null`. This is the one case where the two KPIs' `null`-ness **diverges** — verify this exact split live (`## Verification Steps` step 2), do not assume both always move together.
- **No `SLAPolicy` and no `OrganizationSettings` defaults configured** (the `sla_health` KPI's own upstream dependency) → `sla_breach_rate` already returns `met: 0, breached: 0` for both dimensions in this case (verified in Story 57), so `evaluated == 0` here too → `sla_health` is `null`. Not a new code path — inherited from `sla_breach_rate` unchanged.
- **No `Feedback` rows submitted in the selected range** → `csat_risk` is `null` — the same zero-`Feedback` branch `RPT-4` already verified does not crash (`grouped_counts` on an empty queryset returns `[]`, so `feedback_counts` is `{}`, `feedback_total` is `0`).
- **All four KPIs `null` at once** (a genuinely empty period) → `ChartFrame`'s `isEmpty` (`rows.every((row) => row.value === null)`) renders `Empty` instead of a blank gauge grid.
- **`open_rate`/`agent_load` share the SAME `open_tickets` queryset but are evaluated with two separate `.count()` calls** (`open_tickets.count()` and `open_tickets.filter(assigned_agent_id__isnull=True).count()`) → two queries, not one — a deliberate, minor inefficiency accepted for code clarity over a single combined aggregate query; this endpoint already makes several queries (`sla_breach_rate` alone issues its own three), so two more for a whole-dashboard snapshot is not a meaningfully different cost class.
- **The four KPIs are scoped by slightly different date fields under the hood** (`open_rate`/`agent_load` by `Ticket.created_at`, `sla_health` by `sla_breach_rate`'s own `Ticket.created_at` scoping, `csat_risk` by `Feedback.created_at` — a ticket created last month with feedback submitted this month contributes to this month's `csat_risk` but not this month's `open_rate`/`agent_load`) → **not a bug**, this exactly matches how `RPT-2` and `RPT-4` already scope their own equivalent endpoints individually; `RPT-5` inherits both scopings unchanged rather than inventing a new unified definition of "period."
- **`?export=csv` with one or more `null`-valued KPIs** → the CSV's `value` column has an empty cell for that row (verified live, `## Prerequisites`), not the literal text `"None"` or `"null"`.
- **An `agent`-role user hitting the endpoint directly** → `403`, `reports.view` not held — no new permission check to get wrong, reuses Story 56's existing grant.

---

## Test Plan

Per standing project policy this project authors no automated tests (`CONVENTIONS.md` § 16). This story adds none.

Its checks are: `manage.py check`/`ruff`; `manage.py shell` reproduction of the four recorded KPI values, plus the "tickets exist but none open" divergent-null case; real HTTP against the endpoint across permission states and CSV export, including the empty-cell check for a `null` KPI; the frontend's `lint`/`format:check`/`check:rtl`/`build`; a diff confirming `GaugeChart.tsx` has **zero** lines changed; an `en`/`ar` key-set diff; and a bilingual walkthrough. All below.

---

## Verification Steps

1. **Backend gates:** from `backend/` — `python manage.py check`; `python manage.py makemigrations --check --dry-run` reports **no changes**; `ruff check apps/ && ruff format --check apps/`.
2. **Dashboard KPIs reproduce the recorded dry run, including the divergent-null case.** In `manage.py shell`:
   ```python
   from apps.reports.aggregation import parse_date_range
   from apps.reports.dashboard import dashboard_kpis
   start, end = parse_date_range({})
   print(dashboard_kpis(start, end))
   ```
   Confirm the four values match `## Prerequisites`' recorded dry run (or are internally consistent if the underlying data has changed). Then, in the same shell, temporarily resolve/close every currently-open ticket in the range (inside a rolled-back `transaction.atomic()`, the same pattern Story 59 used) and re-run `dashboard_kpis` — confirm `open_rate` becomes `0.0` (a real, non-null good score) while `agent_load` becomes `None` (its own denominator now zero) — the one case named in `## Edge Cases` where the two KPIs' null-ness diverges. Roll back before continuing.
3. **Real HTTP, with a `manager` token:** `GET /api/reports/dashboard/kpis/` → `200`, array of exactly 4 `{key, value}` rows in `DASHBOARD_KPIS` order. `GET .../kpis/?bucket=quarter` → still `400` (inherited, unused-but-validated, the same consistency every whole-range `RPT-*` endpoint already establishes).
4. **Permission states:** `admin`/superuser → `200`; `agent` → **`403`**; no token → `401`.
5. **CSV export, including a `null` cell:** `GET /api/reports/dashboard/kpis/?export=csv` → correct `Content-Type`/`Content-Disposition` (`dashboard-kpis.csv`), UTF-8 BOM present; if any KPI is currently `null` in this database, confirm its row's `value` cell is empty, not the text `None`.
6. **`GaugeChart.tsx` has zero diff.** `git diff --stat frontend/src/shared/ui/chart/GaugeChart.tsx` (or the equivalent check against the base this story started from) shows **no changes** — the hard constraint this entire story is built around.
7. **Frontend gates:** `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` — all clean.
8. **Locale key parity:** diff `features/reports/locales/en.json` against `ar.json` — identical key set, including the new `dashboard` block and `sidebarDashboard`.
9. **Bilingual walkthrough.** `npm run dev`, signed in as `admin`/`manager`. Open `/reports/dashboard` from the new sidebar link (fifth and final distinct label): four gauges render (or fewer, if any KPI is `null` in this database — confirmed against the data table, which still lists all four rows). Toggle "Show data table" and confirm the fallback table's numbers match. Export the CSV. Adjust the date range and confirm the gauges update, including a range with zero tickets (confirm the whole panel shows `Empty`). Switch to Arabic and confirm the gauge grid's RTL layout looks correct — this reuses `GaugeChart`'s own already-verified RTL geometry (`RPT-2`), so this is a **sanity check**, not a fresh algebraic verification.
10. **Permission boundary:** an `agent`-role user sees no "Management Dashboard" sidebar entry, and `/reports/dashboard` redirects to `/` when navigated to directly.
11. **EPIC 11 completion sanity check.** With this story done, confirm all five sidebar report links (`Ticket Reports`, `SLA Performance`, `Agent Performance`, `Customer Satisfaction`, `Management Dashboard`) are present and distinct for a `manager`-role user, and absent for an `agent`-role user — the whole epic's access boundary, exercised in one pass.

---

## Done Criteria

- [ ] `apps/reports/dashboard.py` — `DASHBOARD_KPIS`, `_safe_ratio`, `dashboard_kpis`. Reuses `sla_breach_rate`/`grouped_counts` unchanged; `open_rate`/`agent_load` use the existing `.exclude(status__in=[RESOLVED, CLOSED])` idiom, not a new inclusion list.
- [ ] `DashboardKpiReportView` in `apps/reports/views.py`, `permission_map = {"get": Permissions.REPORTS_VIEW}` — the **existing** permission, no new constant.
- [ ] `apps/reports/urls.py` gains `reports/dashboard/kpis/`. **No** `config/api_urls.py` change. **No** new migration.
- [ ] **`frontend/src/shared/ui/chart/GaugeChart.tsx` has zero lines changed** — verified via diff (step 6), not assumed.
- [ ] `features/reports/types/dashboard.ts`, two new `api/` files (reusing the existing `reportKeys.ts`/`exportReport.ts`), `components/ManagementDashboardPage.tsx` — one `ChartFrame`-wrapped `GaugeChart` with all four KPIs, `null`-valued KPIs excluded from the gauge grid but present in the data table.
- [ ] Route `reports/dashboard` and sidebar link added inside the **existing** `reports.view` blocks (fifth and final entry); sidebar label distinct from the other four (`sidebarDashboard`).
- [ ] `dashboard` locale block and `sidebarDashboard` key added to both `en.json`/`ar.json` with an identical key set.
- [ ] `CONVENTIONS.md` § 27 gained point 11, recording the "frame every gauge KPI as a 0-1 badness fraction" reuse recipe.
- [ ] Verified by shell: the four recorded KPI values reproduced, and the `open_rate`/`agent_load` divergent-null case confirmed live, not assumed (step 2).
- [ ] Verified by real HTTP: three permission states, CSV export with a genuinely empty cell for any `null` KPI (steps 3-5).
- [ ] Verified in the browser: the full bilingual walkthrough including an empty-period check (step 9), the agent-role permission boundary (step 10), and a full-epic sidebar sanity pass across all five reports (step 11).
- [ ] Overview `00-overview.md` updated with this story — **`EPIC 11 — Reports & Analytics` is now fully planned, `RPT-0` through `RPT-5`.**

**STOP HERE. Report to the user and confirm EPIC 11 is complete before starting any new epic.**
