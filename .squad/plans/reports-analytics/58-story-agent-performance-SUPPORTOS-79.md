# Story 58 — Agent Performance (Story: SUPPORTOS-79)

## Prerequisites

- **`RPT-0`/`RPT-1`/`RPT-2` (Stories 55/56/57) completed.** `apps/reports/aggregation.py`, `apps/reports/export.py::csv_response`, `apps/reports/views.py::BaseReportView`, `Permissions.REPORTS_VIEW` (`apps/core/permissions.py:38`, already granted to `admin`/`manager`), `frontend/src/shared/ui/chart/` (`ChartFrame`, `BarChart`, `ChartDataTable`) all exist. **This story adds no new permission and no new migration.**
- **`TKT-3` (Assignment, Story 22) and `PORTAL-5` (Submit Feedback, CSAT) are the two data sources this story reads.** `Ticket.assigned_agent` (`apps/tickets/models.py:79-86`, nullable `SET_NULL`) and `Feedback` (`apps/tickets/models.py:169-218`: `ticket` `OneToOneField` `CASCADE`, `rating` a three-value `TextChoices`, no numeric score field) both already exist and are reused unchanged — no model or migration change.
- **Verified live: only 3 of the tickets in this project's default 30-day range have an assigned agent, and only 1 `Feedback` row exists project-wide** (linked to an *unassigned* ticket, so it contributes to no agent's CSAT today). This story's aggregation must produce a correct, non-crashing **empty** result for a metric with no qualifying data (verified below, not assumed) — this is the normal early-project state, not an edge case to special-case away.
- **`CONVENTIONS.md` § 25 row 5 (RPT-3) says "Same as RPT-1's category row"** — Horizontal Bar Chart, "≤15 agents before switching to a paginated table". This story therefore reuses `BarChart`/`ChartDataTable` **unchanged**, `orientation="horizontal"` — no new chart component, unlike `RPT-2` (which needed `GaugeChart`). It is the first `horizontal` `BarChart` consumer; `RPT-1`'s own breakdown only ever used `orientation="vertical"`.
- **Three metrics, one endpoint, one required `?metric=` param** — the exact shape `TicketBreakdownReportView`'s `?dimension=` already established (`views.py:96-122`), not three separate view classes. Unlike a `Ticket` dimension (`status`/`priority`/`category`/`channel`, all frontend-translatable enum values), an **agent is arbitrary user data** — its display name cannot be derived client-side the way `t('statuses.open')` is. So this story's aggregation returns `{"key": <agent id>, "label": <agent name>, "value": <metric>}` directly (label resolved server-side via `User.get_full_name()`, the project's one established display-name convention — `apps/accounts/models.py:128-130`, already reused verbatim by `TicketViewSet.assignable_agents`, `apps/tickets/views.py:148`) — unlike `grouped_counts`'s bare `{"key", "value"}` (`aggregation.py:183-219`), which this story therefore does **not** call.
- **Verified live, the full bulk pipeline, all three metrics, zero N+1** — the same `Subquery`-per-ticket-field technique `RPT-1`'s `with_origin_channel` and `RPT-2`'s `_annotated_tickets` both already established, extended to two annotations at once (`resolved_at`, `feedback_rating`) plus one small bulk `User` name lookup:
  ```
  handled: {42: 1, 43: 1, 4: 1}
  resolution (avg minutes): {42: 1, 4: 1}  # only agents with ≥1 resolved ticket
  csat: {}                                  # 0 today — the one Feedback row's ticket has no assigned_agent
  ranked handled -> [{'key': '42', 'label': 'ziadhosny@azm.com', 'value': 1}, ...]
  ranked resolution -> [{'key': '4', 'label': 'ziad@email.com', 'value': 2730.4}, {'key': '42', ..., 'value': 2.1}]
  ```
  4 queries total regardless of ticket/agent count (one annotated `Ticket.values()`, one bulk `User.objects.filter(pk__in=...)`) — not `2N+1`.
- **CSAT is reported as "% satisfied" (0-1), not a weighted score.** `Feedback.Rating` has three values with no numeric weight anywhere in this codebase. `RPT-4` (Customer Satisfaction, not yet planned) owns the full satisfied/neutral/dissatisfied **breakdown** (`CONVENTIONS.md` § 25 row 6, a Waffle Chart — a categorical Part-to-Whole view). This story needs exactly one scalar per agent to **rank** by; "% satisfied" (`satisfied_count / total_count`) is the simplest, least-invented choice, and reuses the exact `rate`-as-0–1-fraction convention `RPT-2`'s breach rate already established (`apps/reports/sla.py::sla_breach_rate`) rather than inventing a new "1 point for satisfied, 0.5 for neutral, 0 for dissatisfied" weighting with no precedent anywhere in this project.
- **"Resolution time" ranks agents in the SAME descending-by-value direction every other `BarChart` consumer uses** (`CONVENTIONS.md` § 25 line 1630, enforced project-wide since `RPT-1`). For a count or a satisfaction rate, descending means "best/most first" — for resolution time, descending means the **slowest** agents surface first. This is a deliberate scope decision, not an oversight: `BarChart.tsx` has no ascending mode, adding one would be a shared-component change serving one metric of one report, and a manager-facing oversight report surfacing its slowest performers first is a defensible framing, not a bug. Documented here so it is not "fixed" by accident later.
- **No new `Ticket`/`Feedback`/`User` model field, no schema migration.**

---

## Story Goal

The agent half of `RPT-0`'s data — one endpoint, three metrics, one report screen:

1. **Agent metrics API** — `GET /api/reports/agents/performance/?metric=handled|resolution|csat`, a single `BaseReportView` subclass. Returns up to the top 15 agents (`CONVENTIONS.md` § 25 line 1633) ranked descending by the requested metric:
   - `handled` — count of tickets assigned to the agent, created in the selected period.
   - `resolution` — average minutes from ticket creation to first resolved/closed, for that agent's tickets that reached it.
   - `csat` — share of that agent's rated tickets marked `satisfied` (0-1).
2. **Report UI** — a `/reports/agents` screen: a date-range control, a metric picker (`Select`, mirroring `TicketReportsPage.tsx`'s dimension picker), and one `ChartFrame`-wrapped horizontal `BarChart` with the mandatory `ChartDataTable` fallback and a CSV export button.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/reports/agents.py` | The domain half — bulk per-agent aggregation across all three metrics from one annotated queryset, plus the display-name lookup. Mirrors `apps/reports/tickets.py`/`apps/reports/sla.py`'s existing split. |
| One view, `?metric=` required | Mirrors `TicketBreakdownReportView`'s `?dimension=` exactly — one endpoint, a whitelist, no sensible default axis. |
| Reusing `BarChart`/`ChartDataTable` | § 25 row 5 names the identical chart type `RPT-1`'s breakdown already uses; nothing new to build in `shared/ui/chart/`. |
| `key`/`label`/`value` rows, not `key`/`value` | An agent name is arbitrary user data, not a frontend-translatable enum — the label must come from the backend. |

**Not here, and why:**

- **No per-agent drill-in to their own ticket list.** Not in the intake; `TicketListPage`'s own filters already let a manager see one agent's tickets if they want the rows.
- **No CSAT breakdown chart (satisfied/neutral/dissatisfied).** That is `RPT-4`'s own scope (§ 25 row 6, Waffle Chart) — this story reports one derived scalar per agent, not the three-category split.
- **No unassigned/"unattributed" bar.** Unlike `RPT-1`'s ticket dimensions (where a ticket always has *some* status/priority), a ticket with no `assigned_agent` has nothing meaningful to rank — it is excluded from every metric, not shown under a `None`/"Unassigned" label. Contrast `RPT-1`'s `include_null=True` treatment of `category`/`channel`, which this story does not mirror.
- **No target/threshold coloring.** Unlike `RPT-2`'s `GaugeChart`, a ranked bar chart of agents has no single "target" to compare against — `BarChart` already carries no such concept, and this story does not add one.
- **No caching, no Celery pre-aggregation.** Same standing rule as every prior `RPT-*` story.
- **No `assignable_agents()` reuse.** That queryset answers "who *can* be assigned" (`tickets.manage` holders) for the assignment picker — a materially different question from "who *was* assigned and did work in this period." This story ranks only agents who actually appear in the ticket data, not the full assignable roster (an agent with zero handled tickets in the period is simply absent from the chart, not shown at zero).

---

## Context — Read These Files First

1. `.squad/stories/reports-analytics/SUPPORTOS-79/intake.md` — one task (*"Agent metrics API + report UI — Handled/resolution time/CSAT per agent via RPT-0"*), **no explicit dependency line, no acceptance criteria, no attachments**.
2. [`56-story-ticket-reports-SUPPORTOS-77.md`](56-story-ticket-reports-SUPPORTOS-77.md) `## Prerequisites`/`## Product rules` — the `TicketBreakdownReportView` `?dimension=` shape this story's `?metric=` copies one-for-one. [`57-story-sla-performance-SUPPORTOS-78.md`](57-story-sla-performance-SUPPORTOS-78.md) — the bulk `Subquery`-annotation-plus-Python-aggregation shape this story extends to two annotations.
3. `backend/apps/tickets/models.py` — `assigned_agent` (79-86, nullable `SET_NULL` FK to `accounts.User`), `Ticket.Status.RESOLVED`/`CLOSED` (34-38), `TicketActivity.Kind.STATUS_CHANGED` (Story 24), `Feedback` (169-218: `Rating` choices 179-186, `ticket` `OneToOneField` 193-, `customer` FK 206-208, `rating` 209, no numeric field anywhere on this model).
4. `backend/apps/accounts/models.py:89-133` — `User`: `get_full_name()` (128-130, `f"{first_name} {last_name}".strip() or email` — the ONLY display-name convention in this codebase, verified against a real seed user with blank names falling back to its email).
5. `backend/apps/tickets/assignment.py` (60 lines) — `assignable_agents()` (20-36) and its own docstring's *"Deliberately NOT a general user-listing API: SEC-1 owns user admin"* — read this to understand why this story does **not** reuse it as its agent population (see `## Story Goal`, "Not here, and why").
6. `backend/apps/tickets/views.py:148` — `[{"id": agent.id, "name": agent.get_full_name()} for agent in assignable_agents()]`, the one other call site in this codebase building an `{id, name}` pair from `get_full_name()` — the precedent this story's bulk name lookup follows.
7. `backend/apps/reports/tickets.py` (87 lines) and `backend/apps/reports/sla.py` (191 lines) — read both end to end. `apps/reports/agents.py` (task 2) is structurally the third of this family: a module docstring naming what `aggregation.py` does *not* know, a `parse_*` validator raising DRF `ValidationError` off a whitelist (mirrors `parse_dimension`, `tickets.py:43-62`), a `Subquery`-annotated bulk queryset function (mirrors `with_origin_channel`, `tickets.py:65-86`, and `_annotated_tickets`, `sla.py:63-92`), and one aggregation entry point.
8. `backend/apps/reports/aggregation.py:183-219` — `grouped_counts`, read to see why it does **not** fit this story: its rows carry no `label`, only `key`/`value`.
9. `backend/apps/reports/views.py` — `BaseReportView` (1-56), `TicketBreakdownReportView` (97-122, the closest structural precedent: one required whitelist param, `include_null` semantics **not** carried over here — see `## Story Goal`), `SlaTrendReportView`/`SlaBreachRateReportView` (125-164) — task 3's new class is appended after line 164.
10. `backend/apps/reports/urls.py` (23 lines) — the `path()`-only list task 4 extends with one more entry under a new `reports/agents/` prefix.
11. `frontend/src/shared/ui/chart/BarChart.tsx` (127 lines) and `types.ts` — `ChartCategory = {key, label, value}` (already exactly this story's row shape, **no new frontend type needed** beyond what `types.ts` already exports) and `orientation="horizontal"` (`BarChart.tsx:38-82`) — already implemented and used nowhere yet; this story is its first real consumer.
12. `frontend/src/features/reports/components/TicketReportsPage.tsx` (257 lines) — read the breakdown half (`toChartSeries`... no, the **dimension `Select`**, lines 204-217, and the second `ChartFrame`/`BarChart`/`table` composition, lines 219-254) — task 8's `AgentReportsPage.tsx` copies this shape almost verbatim, substituting a `metric` `Select` for the `dimension` one and dropping the `labelForDimensionValue` client-side translation entirely (this story's rows already carry a `label`).
13. `frontend/src/features/reports/api/getTicketBreakdown.ts`/`useTicketBreakdown.ts`, `api/exportReport.ts`, `api/reportKeys.ts` — the exact shape task 6/7's new API files follow.
14. `frontend/src/app/router.tsx` and `frontend/src/app/Sidebar.tsx` — the existing `reports.view`-gated block/`<Can>` (added by Story 56, extended by Story 57); tasks 9/10 add a third sibling route/link inside the **same** blocks, not new ones.
15. **`CONVENTIONS.md` § 25 line 1633** — "≤15 agents before switching to a paginated table", the source of `MAX_AGENTS = 15` in task 2. **§ 27** — this story adds no new point (its "omit missing data" and "descending by value" rules are already covered by points 2/9/10 as written; nothing new to record).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Agent metrics API + report UI, via RPT-0.** | Intake, sole task | One `BaseReportView` subclass; `ChartFrame`-wrapped horizontal `BarChart`. |
| **Handled per agent.** | Intake | Count of tickets created in range with that `assigned_agent`. |
| **Resolution time per agent.** | Intake | Average minutes created→resolved, only agents with ≥1 resolved ticket. |
| **CSAT per agent.** | Intake | Share of rated tickets marked `satisfied`, only agents with ≥1 `Feedback` row. |
| **`?metric=` is required; no default axis.** | This story's design, mirroring `TicketBreakdownReportView` | `parse_metric` raises `ValidationError` when absent — the same "guessing would silently answer a different question" reasoning `parse_dimension` already documents. |
| **≤15 agents, ranked descending.** | § 25 line 1633, § 25 line 1630 | `MAX_AGENTS = 15`; `sorted(..., reverse=True)[:MAX_AGENTS]`. |
| **An agent absent from a metric's underlying data is omitted, never shown at a false value.** | This story's design, consistent with § 27 point 10's "no false zero" for averages, extended here to counts/rates that simply have no data | No `include_null`-style placeholder row for CSAT/resolution. |
| **The export param is `export`, never `format`.** | § 27 point 4 | Inherited from `BaseReportView`. |
| **No new permission, no new migration.** | `reports.view` already covers every `RPT-*` report | No `apps/reports/migrations/0002_*`. |

**The verified bulk pipeline**, reproduced against this project's live Postgres — confirm this shape still holds before writing task 2:

```
handled: {42: 1, 43: 1, 4: 1}
resolution_sum/count -> avg: {42: 2.1, 4: 2730.4}   # minutes
csat: {} (no agent has any linked Feedback today)
ranked handled  -> [{'key':'42','label':'ziadhosny@azm.com','value':1}, {'key':'43','label':'sara.agent@supportos.local','value':1}, {'key':'4','label':'ziad@email.com','value':1}]
ranked resolution -> [{'key':'4','label':'ziad@email.com','value':2730.4}, {'key':'42','label':'ziadhosny@azm.com','value':2.1}]
ranked csat -> []
```

Re-run this exact computation in `## Verification Steps` step 2 to confirm the shipped code reproduces it.

---

## Backend Tasks

### 1 — (No change) Confirm no new permission is needed

No task file to write — this is a checklist item, not a code change. `Permissions.REPORTS_VIEW` (`apps/core/permissions.py:38`) already covers this endpoint; `apps/reports/migrations/0001_grant_reports_permission.py` (Story 56) already grants it to `admin`/`manager`. Verify this explicitly in `## Verification Steps` step 5 rather than assuming it.

### 2 — Agent report domain helpers

**Create file: `backend/apps/reports/agents.py`**

```python
"""Agent-specific report queries — RPT-3.

`aggregation.py` knows nothing about a ticket, an agent, or feedback;
this module is where that domain knowledge lives, the same split
`apps/reports/tickets.py` (RPT-1) and `apps/reports/sla.py` (RPT-2)
already established.

Computes all three metrics — handled count, average resolution minutes,
CSAT ("% satisfied") — from ONE bulk-annotated Ticket queryset, the same
Subquery technique `with_origin_channel` (RPT-1) and `_annotated_tickets`
(RPT-2) already use. 4 queries total regardless of ticket/agent count:
one annotated `.values()` query, one bulk `User` name lookup for the
(at most 15) ranked agents — never one query per agent.
"""

from django.db.models import OuterRef, Subquery
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.tickets.models import Feedback, Ticket, TicketActivity

HANDLED = "handled"
RESOLUTION = "resolution"
CSAT = "csat"
METRICS = (HANDLED, RESOLUTION, CSAT)

# CONVENTIONS.md § 25 line 1633: "≤15 agents before switching to a
# paginated table" — RPT-3's own chart-type guidance.
MAX_AGENTS = 15


def parse_metric(query_params) -> str:
    """`?metric=` as one of METRICS. REQUIRED — there is no sensible
    default axis, the same reasoning `apps.reports.tickets.parse_dimension`
    already documents for `?dimension=` (required=True branch).
    """
    raw = query_params.get("metric")
    if raw not in METRICS:
        valid = ", ".join(METRICS)
        raise ValidationError({"metric": [_("Must be one of: %(valid)s.") % {"valid": valid}]})
    return raw


def _annotated_tickets(start, end):
    """Every ticket created in [start, end) that HAS an assigned agent,
    annotated with its earliest resolved/closed activity time and its
    linked feedback rating (if any) — the two facts every metric needs,
    fetched in ONE query via two `Subquery` annotations, not N+1.
    """
    resolved_activity = (
        TicketActivity.objects.filter(
            ticket=OuterRef("pk"),
            kind=TicketActivity.Kind.STATUS_CHANGED,
            to_value__in=[Ticket.Status.RESOLVED, Ticket.Status.CLOSED],
        )
        .order_by("created_at")
        .values("created_at")[:1]
    )
    feedback_rating = Feedback.objects.filter(ticket=OuterRef("pk")).values("rating")[:1]
    return (
        Ticket.objects.filter(
            created_at__gte=start, created_at__lt=end, assigned_agent_id__isnull=False
        )
        .annotate(
            resolved_at=Subquery(resolved_activity),
            feedback_rating=Subquery(feedback_rating),
        )
        .values("id", "created_at", "assigned_agent_id", "resolved_at", "feedback_rating")
    )


def agent_performance(start, end, metric: str) -> list[dict]:
    """Up to MAX_AGENTS agents, ranked DESCENDING by `metric`
    (CONVENTIONS.md § 25 line 1630 — the same direction every `BarChart`
    consumer uses; for `resolution`, descending surfaces the SLOWEST
    agents first, a deliberate oversight-report framing, see Story 58
    `## Prerequisites`).

    Returns `[{"key": "42", "label": "ziadhosny@azm.com", "value": 1}, ...]`
    — `ChartCategory`'s own shape, so the frontend needs no client-side
    label resolution (unlike RPT-1's ticket dimensions, an agent's name
    is not a frontend-translatable enum).

    An agent absent from the metric's underlying data (no resolved
    ticket, no feedback) is OMITTED, never shown at a false zero — the
    same "no false data point" rule § 27 point 10 established for
    averages, extended here to counts and rates that simply have none.
    """
    handled: dict[int, int] = {}
    resolution_sum: dict[int, float] = {}
    resolution_count: dict[int, int] = {}
    csat_satisfied: dict[int, int] = {}
    csat_total: dict[int, int] = {}

    for row in _annotated_tickets(start, end):
        agent_id = row["assigned_agent_id"]
        handled[agent_id] = handled.get(agent_id, 0) + 1
        if row["resolved_at"] is not None:
            minutes = (row["resolved_at"] - row["created_at"]).total_seconds() / 60
            resolution_sum[agent_id] = resolution_sum.get(agent_id, 0) + minutes
            resolution_count[agent_id] = resolution_count.get(agent_id, 0) + 1
        if row["feedback_rating"] is not None:
            csat_total[agent_id] = csat_total.get(agent_id, 0) + 1
            if row["feedback_rating"] == Feedback.Rating.SATISFIED:
                csat_satisfied[agent_id] = csat_satisfied.get(agent_id, 0) + 1

    if metric == HANDLED:
        values = handled
    elif metric == RESOLUTION:
        values = {
            agent_id: round(resolution_sum[agent_id] / resolution_count[agent_id], 1)
            for agent_id in resolution_count
        }
    else:
        values = {
            agent_id: round(csat_satisfied.get(agent_id, 0) / csat_total[agent_id], 3)
            for agent_id in csat_total
        }

    ranked = sorted(values.items(), key=lambda item: item[1], reverse=True)[:MAX_AGENTS]
    names = {user.id: user.get_full_name() for user in User.objects.filter(pk__in=[a for a, _v in ranked])}
    return [
        {"key": str(agent_id), "label": names[agent_id], "value": value} for agent_id, value in ranked
    ]
```

Import `User` from `apps.accounts.models`, `Feedback`/`Ticket`/`TicketActivity` from `apps.tickets.models`. **Verify no import cycle before writing**: `apps.accounts.models` imports only `apps.core.models`/`apps.core.permissions` (verified — no `apps.reports` or `apps.tickets` import), so `apps.reports.agents` → `apps.accounts.models` and `apps.reports.agents` → `apps.tickets.models` are both leaves, the same pattern `apps.reports.tickets`/`apps.reports.sla` already established.

---

### 3 — Agent performance report view

**File: `backend/apps/reports/views.py`** — add the import and append the class after `SlaBreachRateReportView` (current end of file, line 164).

Add to the existing import block:

```python
from .agents import agent_performance, parse_metric
```

```python
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
```

`csv_filename` is set on `self` inside `get_report`, read back by `BaseReportView.get` (`views.py:50-56`) after `get_report` returns — the base class already reads `self.csv_filename`, not the class default, so this is a normal instance-attribute override, not a change to `BaseReportView` itself. `csv_columns` stays the fixed generic triple (`key`/`label`/`value` header text does not need to vary per metric — the filename already distinguishes which metric was exported).

---

### 4 — URLs

**File: `backend/apps/reports/urls.py`** — add `AgentPerformanceReportView` to the `from .views import (...)` block (alphabetical: after `AgentPerformanceReportView` comes `SlaBreachRateReportView`), and one more entry to `urlpatterns`, after the two `reports/sla/*` paths:

```python
    path("reports/agents/performance/", AgentPerformanceReportView.as_view(), name="agent-performance"),
```

**No `config/api_urls.py` change** — `apps.reports.urls` is already included (Story 56).

---

## Frontend Tasks

### 5 — Types

**Create file: `frontend/src/features/reports/types/agent.ts`**

```ts
/** The three metrics `/api/reports/agents/performance/` accepts via
 * `?metric=`, mirroring `apps/reports/agents.py::METRICS`. */
export const AGENT_METRICS = ['handled', 'resolution', 'csat'] as const
export type AgentMetric = (typeof AGENT_METRICS)[number]
```

No new row type — `/api/reports/agents/performance/` returns rows already shaped exactly like `ChartCategory` (`shared/ui/chart/types.ts`: `{key, label, value}`), so `getAgentPerformance.ts` (task 6) imports that type directly rather than declaring a duplicate.

### 6 — API layer

**Create file: `frontend/src/features/reports/api/getAgentPerformance.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { ChartCategory } from '@/shared/ui/chart'

import type { AgentMetric } from '../types/agent'

export type AgentPerformanceParams = {
  from?: string
  to?: string
  metric: AgentMetric
}

export function getAgentPerformance(params: AgentPerformanceParams): Promise<ChartCategory[]> {
  return api.get<ChartCategory[]>('/reports/agents/performance/', { params })
}
```

**Create file: `frontend/src/features/reports/api/useAgentPerformance.ts`** — `useQuery` on `reportKeys.resource('agent-performance', params)`, the same shape as `useTicketBreakdown.ts`/`useSlaBreachRate.ts`. No new `reportKeys.ts` — reuse the existing one.

### 7 — Locales

**File: `frontend/src/features/reports/locales/en.json`** — add a top-level `agents` block (sibling of `trend`/`breachRate`/`volume`/`breakdown`) and one `sidebarSla`-style new sidebar key:

```json
"sidebarAgents": "Agent Performance",
"agents": {
  "title": "Agent performance",
  "description": "Top agents for the selected period and metric.",
  "filters": { "metric": "Rank by" },
  "metrics": {
    "handled": "Tickets handled",
    "resolution": "Average resolution time",
    "csat": "Satisfaction rate"
  },
  "fields": { "agent": "Agent", "value": "Value" }
}
```

**File: `ar.json`** — the mirror: `"sidebarAgents": "أداء الوكلاء"`, `"agents": {"title": "أداء الوكلاء", "description": "أفضل الوكلاء للفترة والمقياس المحددين.", "filters": {"metric": "الترتيب حسب"}, "metrics": {"handled": "التذاكر المعالجة", "resolution": "متوسط وقت الحل", "csat": "معدل الرضا"}, "fields": {"agent": "الوكيل", "value": "القيمة"}}`. Verify the final key set matches `en.json` exactly (`## Verification Steps` step 9) — do not hand-copy without diffing.

### 8 — The report screen

**Create file: `frontend/src/features/reports/components/AgentReportsPage.tsx`**

Copy `TicketReportsPage.tsx`'s date-range filter block (lines 118-140) verbatim. Replace the dimension `Select` (lines 204-217) with a metric `Select`:

```tsx
const [from, setFrom] = useState('')
const [to, setTo] = useState('')
const [metric, setMetric] = useState<AgentMetric>('handled')

const params = { ...(from ? { from } : {}), ...(to ? { to } : {}), metric }
const query = useAgentPerformance(params)

async function handleExport() {
  try {
    await exportReport('/reports/agents/performance/', `agent-performance-${metric}`, params)
  } catch {
    toast({ tone: 'error', message: t('actions.exportFailed') })
  }
}
```

```tsx
<Select value={metric} onValueChange={(value) => setMetric(value as AgentMetric)}>
  <SelectTrigger aria-label={t('agents.filters.metric')} size="sm">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {AGENT_METRICS.map((value) => (
      <SelectItem key={value} value={value}>
        {t(`agents.metrics.${value}`)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

```tsx
<ChartFrame
  title={t('agents.title')}
  description={t('agents.description')}
  query={query}
  isEmpty={(rows) => rows.length === 0}
  action={
    <Button variant="outline" size="sm" onClick={() => void handleExport()}>
      <DownloadIcon />
      {t('actions.exportCsv')}
    </Button>
  }
  table={(rows) => (
    <ChartDataTable
      caption={t('chart.dataTableCaption', { ns: 'common', title: t('agents.title') })}
      columns={[t('agents.fields.agent'), t('agents.fields.value')]}
      rows={rows.map((row) => [row.label, formatMetricValue(metric, row.value)])}
    />
  )}
>
  {(rows) => <BarChart orientation="horizontal" categories={rows} formatValue={(v) => formatMetricValue(metric, v)} />}
</ChartFrame>
```

`categories={rows}` — passed directly, **no mapping step**, unlike `TicketReportsPage.tsx`'s breakdown chart (`rows.map((row) => ({ key, label: labelForDimensionValue(...), value }))`, lines 247-251): this endpoint's rows already are `ChartCategory`. `isEmpty` is a plain `rows.length === 0` check (no `every(value === 0)` variant needed — a `handled` count of 0 for an agent would never appear as a row at all, per task 2's "omitted, not zero" rule).

One local helper:

```tsx
function formatMetricValue(metric: AgentMetric, value: number): string {
  if (metric === 'csat') return number(value, { style: 'percent', maximumFractionDigits: 1 })
  if (metric === 'resolution') return `${number(value, { maximumFractionDigits: 1 })} ${t('trend.minutes').toLowerCase()}`
  return String(value)
}
```

`number` from `useFormatters()`, the same `{ style: 'percent' }` call `SlaReportsPage.tsx` already makes. Reusing `t('trend.minutes')` (the `SLA` block's existing "Minutes" string) rather than adding a duplicate — both blocks live in the same `reports` namespace, so this is a same-namespace reference, not a cross-feature import.

### 9 — Route

**File: `frontend/src/app/router.tsx`** — inside the **same** `element: <RequirePermission permission="reports.view" />` block Story 56/57 already extended, add a third sibling route after `reports/sla`:

```tsx
{
  path: 'reports/agents',
  lazy: async () => {
    const { AgentReportsPage } = await import('@/features/reports/components/AgentReportsPage')
    return { element: <AgentReportsPage /> }
  },
},
```

### 10 — Sidebar link

**File: `frontend/src/app/Sidebar.tsx`** — inside the **same** `<Can permission="reports.view">` block, add a third `SidebarLink` immediately after the `/reports/sla` one:

```tsx
<SidebarLink
  to="/reports/agents"
  icon={ChartNoAxesColumnIcon}
  label={t('reports:sidebarAgents')}
  collapsed={collapsed}
/>
```

Same icon as the other two report links, for the same reason Story 57 already gave (no dedicated icon exists, and inventing a semantically-strained one is worse than reusing this one).

---

## Edge Cases & Failure Modes

- **No `assigned_agent` set on any ticket in the range** → `_annotated_tickets` returns no rows (the `assigned_agent_id__isnull=False` filter excludes them at the SQL level), `agent_performance` returns `[]` for every metric. Not an error — `ChartFrame`'s `isEmpty` renders `Empty` instead of a blank chart. **Verified live** (this project's own database today: only 3 of 11 default-range tickets have an agent).
- **An agent with handled tickets but none resolved yet** → present in `handled`'s ranking, absent from `resolution`'s (never enters `resolution_count`). Switching the `?metric=` picker between `handled` and `resolution` can therefore change which agents even appear, not just their order — expected, not a bug; the two are genuinely different populations.
- **An agent with feedback but the underlying ticket was reassigned to someone else since** → `feedback_rating` is a `Subquery` on `Feedback.objects.filter(ticket=OuterRef("pk"))`, read against the ticket's **current** `assigned_agent_id` at report time, not whoever was assigned when the rating was submitted. This is a live-join, not a point-in-time snapshot — consistent with every other `RPT-*` bulk computation (`with_origin_channel`, `sla.py`'s two subqueries), none of which snapshot at write time either. Worth knowing, not worth engineering around for this story.
- **Two agents tied on the same metric value** → Python's `sorted()` is stable, so tied agents keep their `dict.items()` iteration order (insertion order, i.e., whichever agent's first qualifying ticket was processed first) — deterministic given the same underlying data, but not a meaningful secondary sort key. Not addressed further: the intake names no tie-breaking rule, and inventing one (e.g. alphabetical by name) is unrequested scope.
- **More than 15 agents qualify for a metric** → `[:MAX_AGENTS]` truncates AFTER sorting, so the top 15 by value are always kept, never an arbitrary 15. Matches `grouped_counts`'s own "`limit` applied after ordering" rule (`aggregation.py:204-206`) even though this story does not call `grouped_counts` directly.
- **`?metric=` omitted or invalid** (e.g. `?metric=speed`) → `400` naming the three valid values, from `parse_metric`. Not a silent default to `handled`.
- **`?bucket=quarter` on this endpoint** → still `400`, inherited — the same "parsed but unused, still validated" consistency `SlaBreachRateReportView`/`TicketBreakdownReportView` already establish.
- **`?export=csv`** → `csv_filename` varies by metric (`agent-performance-handled.csv`, etc.) via the documented `self.csv_filename` override in `get_report`; `csv_columns` stays fixed (`key`/`label`/`value`) — the exported `value` column is the raw number (an integer count, a float average, or a 0-1 fraction) in every case, **not** pre-formatted as "3 tickets" or "42%" — the same "backend never pre-formats a percentage" rule `RPT-2`'s breach-rate export already established (verified there; re-verify here in `## Verification Steps` step 4).
- **An agent whose `first_name`/`last_name` are both blank** → `get_full_name()` falls back to `email` (`accounts/models.py:129-130`), verified live against three real seed users in this project's database, all of which have blank names and correctly show their email as the label.
- **An `agent`-role user hitting this endpoint directly** → `403`, `reports.view` not held — no new permission check to get wrong, reuses Story 56's existing grant.

---

## Test Plan

Per standing project policy this project authors no automated tests (`CONVENTIONS.md` § 16). This story adds none.

Its checks are: `manage.py check`/`ruff`; `manage.py shell` reproduction of the recorded dry-run numbers across all three metrics, including the CSAT empty-result case; real HTTP against the endpoint across all three metrics, all permission states, and CSV export; the frontend's `lint`/`format:check`/`check:rtl`/`build`; an `en`/`ar` key-set diff; and a bilingual walkthrough. All below.

---

## Verification Steps

1. **Backend gates:** from `backend/` — `python manage.py check`; `python manage.py makemigrations --check --dry-run` reports **no changes**; `ruff check apps/ && ruff format --check apps/`.
2. **Bulk computation reproduces the recorded dry run.** In `manage.py shell`:
   ```python
   from apps.reports.aggregation import parse_date_range
   from apps.reports.agents import agent_performance
   start, end = parse_date_range({})
   print(agent_performance(start, end, "handled"))
   print(agent_performance(start, end, "resolution"))
   print(agent_performance(start, end, "csat"))
   ```
   Confirm the `handled`/`resolution` rows match `## Product rules`' recorded dry run (or, if the underlying data has changed since planning, that `resolution`'s agent set is a subset of `handled`'s, and every `value` is descending within each list). Confirm `csat` returns `[]` if no `Feedback` row is yet linked to an assigned ticket in this database, or a correctly-ranked non-empty list otherwise.
3. **`?metric=` validation.** In `manage.py shell` or via HTTP, confirm `parse_metric({})` and `parse_metric({"metric": "speed"})` both raise `ValidationError` naming `handled, resolution, csat`.
4. **Real HTTP, all three metrics, with a `manager` token:** `GET /api/reports/agents/performance/?metric=handled` → `200`, array of `{key, label, value}`, descending by `value`. Repeat for `resolution` and `csat`. `GET .../performance/?metric=handled&export=csv` → correct `Content-Type`/`Content-Disposition` (`agent-performance-handled.csv`), UTF-8 BOM present, `value` column a raw number. `GET .../performance/` (no `metric`) → `400`. `GET .../performance/?metric=handled&bucket=quarter` → still `400` (inherited, unused-but-validated).
5. **Permission states:** `admin`/superuser → `200`; `agent` → **`403`** (confirms no new grant was needed, and Story 56's existing one still covers this); no token → `401`.
6. **Frontend gates:** `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` — all clean.
7. **Locale key parity:** diff `features/reports/locales/en.json` against `ar.json` — identical key set, including the new `agents` block and the top-level `sidebarAgents` key.
8. **Bilingual walkthrough.** `npm run dev`, signed in as `admin`/`manager`. Open `/reports/agents` from the new sidebar link (third distinct label, after "Ticket Reports" and "SLA Performance"): the bar chart renders horizontally, ranked descending. Switch **Rank by** through all three metrics and confirm the bars re-rank and re-format (`handled` as a plain count, `resolution` with a "minutes" suffix, `csat` as a percentage). Toggle "Show data table" and confirm the fallback table's numbers match. Export the CSV for each metric and confirm the filename varies (`agent-performance-handled.csv`, `agent-performance-resolution.csv`, `agent-performance-csat.csv`). Adjust the date range and confirm the chart updates. Switch to Arabic and repeat once, confirming the horizontal bars lay out RTL (reusing `BarChart`'s already-shipped, already-verified RTL handling — this story is a new *consumer*, not new *geometry*, so no fresh algebraic check is required here unlike `RPT-2`'s `GaugeChart`).
9. **Permission boundary:** an `agent`-role user sees no "Agent Performance" sidebar entry (same shared `<Can>` block as the other two report links), and `/reports/agents` redirects to `/` when navigated to directly.

---

## Done Criteria

- [ ] `apps/reports/agents.py` — `METRICS`, `MAX_AGENTS = 15`, `parse_metric`, `_annotated_tickets`, `agent_performance`. Zero N+1: 4 queries total regardless of ticket/agent count, verified.
- [ ] `AgentPerformanceReportView` in `apps/reports/views.py`, `permission_map = {"get": Permissions.REPORTS_VIEW}` — the **existing** permission, no new constant; `csv_filename` varies per metric via a documented `self.csv_filename` override inside `get_report`.
- [ ] `apps/reports/urls.py` gains `reports/agents/performance/`. **No** `config/api_urls.py` change. **No** new migration.
- [ ] `features/reports/types/agent.ts`, `api/getAgentPerformance.ts`/`useAgentPerformance.ts` (reusing the existing `reportKeys.ts`/`exportReport.ts`), `components/AgentReportsPage.tsx` — reuses `BarChart`(`orientation="horizontal"`)/`ChartDataTable` unchanged, no new chart component.
- [ ] Rows passed to `BarChart` with **no client-side label mapping** (`categories={rows}` directly) — the backend already resolves agent names.
- [ ] Route `reports/agents` and sidebar link added inside Story 56/57's **existing** `reports.view` blocks, not new permission-gated blocks; sidebar label distinct from the other two (`sidebarAgents`).
- [ ] `agents` locale block and `sidebarAgents` key added to both `en.json`/`ar.json` with an identical key set.
- [ ] Verified by shell: the bulk pipeline reproduces the recorded dry-run numbers across all three metrics, including the CSAT empty-result case (step 2), and `?metric=` validation (step 3).
- [ ] Verified by real HTTP: all three metrics, three permission states, CSV export with a per-metric filename and a raw (non-formatted) `value` column (steps 4-5).
- [ ] Verified in the browser: the full bilingual walkthrough across all three metrics and their exports (step 8), and the agent-role permission boundary (step 9).
- [ ] Overview `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 59 (`RPT-4`, Customer Satisfaction).**
