# Story 69 — (DSN-14) Post-Sign-off UX Findings (Story: SUPPORTOS-105)

## Prerequisites

- **`DSN-13` (Story 68) is complete.** The `DSN-6`–`DSN-13` audit→fix→verify thread is closed and signed off (`design-system/supportos/UX-AUDIT.md`'s `## Sign-off` section, 69 findings, `UX-001`–`UX-069`). `DSN-14` is explicitly **not** part of that register — `SupportOs backlog.MD:628-631` describes it as "reported by users once the app was in real use, after `DSN-6`–`DSN-13`'s audit→fix→verify thread had already closed — not part of the original `DSN-6` register" and "accumulates rather than closing after one pass." **This story does not add rows to `UX-AUDIT.md`** — that file's own scope closed at 69 rows in Story 68's sign-off. Each task below is tracked only in this plan and in `00-overview.md`'s narrative, the same way the story itself will accumulate future tasks outside the register.
- **The `DSN-6`–`DSN-13` thread guardrail does not apply here.** `SupportOs backlog.MD:556` scopes that guardrail explicitly to "`DSN-6` through `DSN-13` below" — `DSN-14` is a new, separate story after it (`SupportOs backlog.MD:628`), not inside that range. This story still defaults to minimal, frontend-only, targeted fixes wherever possible (matching the spirit of the closed thread), but is not bound by its "no new component library" rule.
- **One task has an already-made product decision, not re-litigated by this plan:** task 3 (charts) adopts `recharts` as a new dependency for `LineChart`/`BarChart` only. `GaugeChart`/`WaffleChart` stay hand-built inline SVG — verified this session that neither has a native recharts equivalent (a qualitative-zone gauge bar, a waffle/square grid). This is the **only** new dependency this story adds; no other task proposes one.
- **Every claim below was verified against the actual current code this session** (not carried over from the intake's own prose, which the intake itself flags as partly preliminary — task 6 explicitly names a file, `ArticleListPage.tsx`, that "wasn't caught by the grep but should be checked too"). Three corrections to the intake surfaced during this verification pass, recorded in `## Story Goal`'s disposition table and their own task sections: task 2's file count (5 files, not "~10"/"and others"), task 1's root cause (now diagnosed, was previously "not yet diagnosed"), and task 5 (one genuine inconsistency found, not zero).

---

## Story Goal

Resolve all 6 currently-open `DSN-14` tasks from real user-reported screenshots, each independently scoped and independently shippable — this story does not need to land as one atomic change, but is planned as one unit since all 6 were reported in the same session. Every fix stays frontend-only; none touches a Django view, serializer, URL, or model.

**Disposition table:**

| # | Task (as reported) | Disposition |
|---|---|---|
| 1 | Sidebar scroll visibility on long pages | **Fixed, root cause diagnosed this session** — `RootLayout.tsx`'s outer flex container is `min-h-dvh` (unbounded growth) and `<main>` has no `overflow-y-auto`; the whole document scrolls as one unit, carrying the non-sticky `<aside>` out of view. Fix: pin the container to `h-dvh`/`overflow-hidden`, move scrolling onto `<main>` alone. Zero change to `Sidebar.tsx` needed — its own `<aside>` was already correctly built (`h-dvh` + internal `overflow-y-auto`). Reproduces on **every** route under `RootLayout`, not just `/tickets/:id` — confirmed structural, not page-specific. |
| 2 | Action-button affordance app-wide | **Fixed, scope corrected** — a new shared `DeleteRowButton` component (ghost + `text-destructive` tone + `Trash2Icon`) applied at exactly **5** `DataTable` delete-action call sites, not "~10"/"and others" as the intake's own broadened description suggested: `RoleListPage.tsx`, `CategoryListPage.tsx`, `TaskListPage.tsx`, `FaqListPage.tsx`, `ArticleListPage.tsx`. Verified this session: `UserListPage.tsx` and `CustomerListPage.tsx` have no delete action at all (`UserListPage.tsx`'s own comment says so explicitly); `TicketListPage.tsx`/`MyTicketsPage.tsx` have no delete column either. `useConfirm()` gating untouched at every site. |
| 3 | Reports/charts — adopt a real charting library | **Fixed as decided** — `LineChart.tsx`/`BarChart.tsx` rebuilt on `recharts` (`npm install recharts`, resolves `^3.10.1`, peer-deps confirmed compatible with this app's React 19.2.8). `GaugeChart.tsx`/`WaffleChart.tsx`/`ChartFrame.tsx`/`ChartDataTable.tsx`/`types.ts` untouched. Every consumer's existing prop contract preserved exactly — zero changes needed in `TicketReportsPage.tsx`, `CsatReportsPage.tsx`, `SlaReportsPage.tsx`, `AgentReportsPage.tsx`. RTL handled via recharts's own `XAxis`/`YAxis` `reversed` prop, not a manual `xFor()`-style flip function. |
| 4 | Shrink sidebar footer, move theme/language to a real settings surface | **Fixed** — `Sidebar.tsx`'s footer drops to 2 rows (bell+email, logout), matching the intake's own stated outcome exactly. A new ungated route `/preferences` (`app/PreferencesPage.tsx`) hosts `LanguageSwitcher`/`ThemeToggle` unchanged, reachable via a new always-visible `SidebarLink` in the main nav (no `<Can>` gate) — the precedent for an authenticated-but-permission-ungated route already exists in this router (`index: true`/`HealthPage`, `path: 'tasks'`/`TaskListPage`, both directly under `RequireAuth` with no `RequirePermission` sibling). `/settings` (org-admin, `settings.manage`-gated) is untouched. |
| 5 | Badge/tag color audit app-wide | **Audited, one genuine inconsistency found and fixed** — not "confirmed correct, no change" and not a large defect list. Every `<Badge variant="...">` call site app-wide (41 call sites across 24 files) was read and checked against `badge.tsx`'s 9 variants. 40 are semantically correct and internally consistent. One is not: `ContactDetailsSection.tsx:127`'s contact-channel badge uses `variant="secondary"`, while the app's other 3 "channel" badges (`TicketConversation.tsx:96`, `TicketHistorySection.tsx:109`, `InteractionTimelineSection.tsx:86`) all use `variant="outline"` for the identical semantic concept. Fixed to `outline` to match. No new badge variant added. |
| 6 | Style primary-column table links so they read as links | **Fixed, scope corrected** — a new shared `TableLink` component (`text-primary underline-offset-4 hover:underline`, matching `buttonVariants`'s existing `link` variant styling) applied at **11** call sites across **10** files (one file, `TaskListPage.tsx`, has 2 unstyled links, not 1). The intake's 9-file grep list is confirmed still accurate at today's line numbers (some shifted since DSN-11/DSN-12 touched these files); `ArticleListPage.tsx`'s multi-line variant, which the intake flagged as needing a manual check, is confirmed present at lines 50-52 and included. |

**Not in scope:** any backend/API/model change; any change to `GaugeChart.tsx`, `WaffleChart.tsx`, `ChartFrame.tsx`, `ChartDataTable.tsx`; the existing `/settings` org-admin page; adding rows to `UX-AUDIT.md` (see `## Prerequisites`); any new dependency beyond `recharts`.

---

## Context — Read These Files First

**Task 1 (sidebar scroll):**
1. `frontend/src/app/RootLayout.tsx` (full, 16 lines) — the actual edit site. Current: `<div className="flex min-h-dvh bg-background">` wrapping `<Sidebar />` and `<main className="flex-1 overflow-x-hidden px-4 py-6">` — no `overflow-y-auto` on `<main>`, no fixed height on the container.
2. `frontend/src/app/Sidebar.tsx` lines 140-157 — `<aside className="flex h-dvh flex-col ...">` with its own internal `<nav className="... overflow-y-auto ...">` — already correct, confirmed unchanged by this task.

**Task 2 (action-button affordance):**
3. `frontend/src/shared/ui/data-table/types.ts` (full, 29 lines) — confirms `ColumnDef.cell: (row: T) => ReactNode` has no shared "action cell" hook; every list page hand-rolls its own `cell`, so the shared fix must be a reusable component applied at each call site, not a single `DataTable`-level change.
4. `frontend/src/shared/ui/primitives/button.tsx` lines 12-15 — confirms a `destructive` `buttonVariants` entry already exists (`bg-destructive text-white ...`), used elsewhere (`CustomerProfilePage.tsx:86`, `TicketDetailPage.tsx:184`) for a full-weight destructive button — not the right tone for a per-row table action (too visually loud repeated down a column).
5. `frontend/src/shared/ui/primitives/dropdown-menu.tsx` lines 52-68 — `DropdownMenuItem`'s existing `variant="destructive"` styling convention (`text-destructive`, `focus:bg-destructive/10 focus:text-destructive`, `dark:focus:bg-destructive/20`) — the exact destructive-ghost-tone convention this task's new component reuses.
6. `frontend/src/features/accounts/components/RoleListPage.tsx` (full, 119 lines) — delete cell at line 71, `handleDelete` (lines 33-41) using `useConfirm()`. Reference for every other site's shape.
7. `frontend/src/features/tickets/components/CategoryListPage.tsx` (full, 105 lines) — delete cell at line 60.
8. `frontend/src/features/tasks/components/TaskListPage.tsx` lines 70-129 — delete cell at line 122.
9. `frontend/src/features/knowledge-base/components/FaqListPage.tsx` lines 40-63 — delete cell at line 58.
10. `frontend/src/features/knowledge-base/components/ArticleListPage.tsx` (full, 131 lines) — delete cell at line 80.
11. `frontend/src/features/accounts/components/UserListPage.tsx` lines 19-20 — the file's own comment confirming no delete action exists there; not a task-2 site.

**Task 3 (charts):**
12. `frontend/src/shared/ui/chart/LineChart.tsx` (full, 152 lines) — the edit site.
13. `frontend/src/shared/ui/chart/BarChart.tsx` (full, 128 lines) — the edit site.
14. `frontend/src/shared/ui/chart/GaugeChart.tsx` (full, 124 lines) — untouched; its `xFor()` (lines 54-57) is the manual RTL-flip pattern recharts's own `reversed` axis prop replaces natively for `LineChart`/`BarChart`.
15. `frontend/src/shared/ui/chart/ChartFrame.tsx` (full, 102 lines) — untouched; its `table` prop (lines 26, required, not optional per its own doc comment) is the accessible fallback every chart still gets regardless of this task.
16. `frontend/src/shared/ui/chart/types.ts` (full, 25 lines) and `frontend/src/shared/ui/chart/index.ts` (full, 9 lines) — untouched; `ChartSeries`/`ChartCategory`/`ChartPoint` stay exactly as-is.
17. `frontend/src/features/reports/components/TicketReportsPage.tsx` lines 195-267 — `LineChart` call at line 211 (`series`, `formatBucket`, no `formatValue`), `BarChart` call at lines 255-263 (`orientation="vertical"`, `categories`, no `formatValue`).
18. `frontend/src/features/reports/components/CsatReportsPage.tsx` lines 135-158 — `LineChart` call at lines 153-157.
19. `frontend/src/features/reports/components/SlaReportsPage.tsx` lines 145-162 — `LineChart` call at lines 157-161.
20. `frontend/src/features/reports/components/AgentReportsPage.tsx` lines 100-123 — `BarChart` call at line 121 (`orientation="horizontal"`, `categories`, `formatValue`).
21. `frontend/package.json` (full, 50 lines) — confirms no charting library dependency exists today; `npm install recharts` (from `frontend/`, not the repo root — see Story 67's own caution about this) adds it.
22. `frontend/src/index.css` lines 25, 41, 48, 85, 100, 103, 130, 143 — confirms `--muted-foreground`, `--border`, `--chart-1`..`--chart-5` are real CSS custom properties in both `:root` and `.dark`, usable as raw `var(...)` values in recharts's SVG-attribute props (`stroke`, `fill`).
23. `frontend/src/shared/i18n/useDirection.ts` (full, 30 lines) — the `useDirection()` hook both chart components already import and keep using.

**Task 4 (sidebar footer / settings surface):**
24. `frontend/src/app/Sidebar.tsx` lines 1-34 (imports), 111-284 (main `<nav>`, ends at the `/settings` `<Can>` block, lines 276-283), 285-311 (the 3-row footer) — the edit site for both the nav addition and the footer shrink.
25. `frontend/src/app/router.tsx` lines 50-56 (the `index: true` `HealthPage` route) and lines 397-419 (the `tasks`/`tasks/new`/`tasks/:id/edit` routes) — both sit directly under `RequireAuth` with **no** `RequirePermission` sibling, the exact "authenticated but ungated" precedent this task's new `/preferences` route follows. Also lines 42-45 (the `RootLayout` tree's `path: '/'` + `errorElement`) for the insertion context.
26. `frontend/src/shared/ui/ThemeToggle.tsx` (full, 51 lines) — confirmed self-contained: reads/writes only via `useTheme()`; zero props.
27. `frontend/src/shared/ui/LanguageSwitcher.tsx` (full, 44 lines) — confirmed self-contained: reads/writes only via `i18n.changeLanguage`; zero props. Both components relocate with **zero behavior change**.
28. `frontend/src/features/organization/components/SettingsPage.tsx` (full, 210 lines) and `frontend/src/app/router.tsx` lines 384-396 (the `settings.manage`-gated route) — confirms the existing `/settings` is the org-admin form, untouched by this task, and confirms why it can't host a personal preference (gated behind `settings.manage`, most staff can't reach it).
29. `frontend/src/app/NotFoundPage.tsx` — the existing precedent for a shell-level page component living directly in `app/`, not inside a `features/` folder (no API calls, pure UI composition) — the precedent `PreferencesPage.tsx` follows.
30. `frontend/src/shared/i18n/locales/en/common.json` (full, 61 lines) and `frontend/src/shared/i18n/locales/ar/common.json` (full, 65 lines) — already contain `language.label`/`theme.label` (used unchanged by the relocated components); this task adds one new top-level `preferences.title` key to each, no new i18next namespace/`resources.ts` entry needed.

**Task 5 (badge audit):**
31. `frontend/src/shared/ui/primitives/badge.tsx` (full, 50 lines) — the 9-variant reference (`default`, `secondary`, `destructive`, `success`, `warning`, `info`, `outline`, `ghost`, `link`).
32. Every `<Badge` call site found via `grep -rn "<Badge" frontend/src` (41 matches across 24 files, all read this session) — the full list, grouped by semantic concept:
    - **Ticket/portal-ticket status** (`info`/`warning`/`success`/`outline` via `ticketStatusVariant`): `frontend/src/features/tickets/lib/statusBadge.ts` lines 9-22, `frontend/src/features/portal/lib/statusBadge.ts` lines 8-21 — identical mapping in both, correct.
    - **Ticket/portal-ticket priority** (`outline`/`secondary`/`warning`/`destructive` via `ticketPriorityVariant`, an escalating-attention ramp): same two files, lines 26-39 and 23-36 — identical, correct.
    - **SLA dimension status** (`success`/`secondary`/`destructive`): `frontend/src/features/tickets/components/TicketSlaSection.tsx` lines 11-15, 44, 55 — correct.
    - **Escalation** (`destructive`/`success`): `frontend/src/features/tickets/components/TicketDetailPage.tsx` lines 141, 143 — correct.
    - **Message/entry direction** (`default` outbound / `secondary` inbound): `TicketConversation.tsx:93`, `CustomerContextPanel.tsx:116`, `TicketHistorySection.tsx:106`, `InteractionTimelineSection.tsx:83` — all 4 identical, correct.
    - **Message/entry channel** (`outline`): `TicketConversation.tsx:96`, `TicketHistorySection.tsx:109`, `InteractionTimelineSection.tsx:86` — 3 identical sites, **the majority pattern this task's fix matches**.
    - **Contact-method channel** (currently `secondary`, the outlier): `frontend/src/features/customers/components/ContactDetailsSection.tsx:127` — **the one finding**, see task 5 below.
    - **Article status** (`default`/`secondary` in the manage table; `outline`-for-draft-only elsewhere): `ArticleListPage.tsx:65`, `ArticleReaderPage.tsx:41`, `ArticleBrowsePage.tsx:116,119`, `SearchPage.tsx:75` — verified deliberate, not a defect: `00-overview.md`'s own Story 50 paragraph states article status was explicitly **excluded** from the `success`/`warning`/`info` semantic rollout ("applied to ticket status/priority, task state, one SLA dimension, and ticket escalation — **not article status**").
    - **Role "System" tag**: `RoleListPage.tsx:68` (`outline`) — a static classifier, not a status; correct.
    - **User active/inactive**: `UserListPage.tsx:65-67` (`success`/`destructive`) — correct.
    - **Task completion**: `TaskListPage.tsx:103` (`warning` open / `success` completed) — correct.
    - **FAQ/Article search-result kind**: `SearchPage.tsx:58,73` (`secondary`) — correct, a neutral kind tag, not a status.
    - **Mentioned-user tags**: `InternalNotesSection.tsx:157` (`outline`) — correct, neutral tag.
    - **Unread-notification count**: `NotificationBell.tsx:94` (`destructive`) — correct, draws attention to an unread count.
    - **Settings string-list chip removal**: `SettingsPage.tsx:85` (`secondary`) — correct, a neutral removable chip, not a status.

**Task 6 (table-cell links):**
33. `frontend/src/shared/ui/data-table/types.ts` (full, 29 lines) — same file as task 2's context; confirms `ColumnDef` has no existing link-styling hook, so the fix is a small reusable component, not a `DataTable`/`ColumnDef` change.
34. `frontend/src/shared/ui/primitives/button.tsx` line 21 — `buttonVariants`'s `link` variant (`text-primary underline-offset-4 hover:underline`), the exact class string this task's new `TableLink` reuses verbatim, so a table-cell link and a `<Button variant="link">` look identical.
35. Every primary-column cell `<Link to=...>` site, confirmed this session via `grep -n "<Link to=" frontend/src/features` and individual file reads:
    - `frontend/src/features/tickets/components/TicketListPage.tsx:81`
    - `frontend/src/features/accounts/components/RoleListPage.tsx:48`
    - `frontend/src/features/tasks/components/TaskListPage.tsx:78` (title, primary) **and** `:84` (ticket-reference, secondary — also unstyled, also fixed; the intake's grep found only the primary one)
    - `frontend/src/features/knowledge-base/components/FaqListPage.tsx:45`
    - `frontend/src/features/customers/components/CustomerListPage.tsx:57`
    - `frontend/src/features/accounts/components/UserListPage.tsx:40`
    - `frontend/src/features/knowledge-base/components/ArticleListPage.tsx:50-52` (multi-line — confirmed present, the site the intake flagged as needing a manual check)
    - `frontend/src/features/tickets/components/CategoryListPage.tsx:48`
    - `frontend/src/features/portal/components/PortalTicketListPage.tsx:64`
    - `frontend/src/features/portal/components/PortalTicketHistoryPage.tsx:44`
    - `frontend/src/features/tickets/components/MyTicketsPage.tsx:65`
    - **Confirmed out of scope, checked and excluded deliberately:** `frontend/src/features/portal/components/PortalArticleListPage.tsx:47` renders inside a `Card`/`CardTitle`, not a `DataTable` cell — a different, already-larger/semibold visual treatment, not the bare-text problem this task targets. Left unchanged.

---

## Frontend Tasks

### 1 — Fix sidebar scroll visibility on long pages

**Root cause, diagnosed this session (the intake left this open):** `RootLayout.tsx`'s outer container is `flex min-h-dvh` — a **minimum**, not a fixed height, so the container grows to fit its tallest child. `<main>` has no `overflow-y-auto` and no height cap, so on a long page (e.g. `/tickets/:id`) it grows to its full content height, and the flex container grows past `100dvh` to match. `<aside>` (`Sidebar.tsx`) has an explicit `h-dvh`, which pins its own height, but it is a normal in-flow block — not `position: sticky` or `fixed` — so when the document itself becomes taller than the viewport and scrolls, the whole flex row (including the aside) scrolls together, carrying the sidebar out of view exactly as reported. This is **not** page-specific: every route rendered inside `RootLayout` shares this same container, so it reproduces on any staff page whose content exceeds one viewport, not only `/tickets/:id`.

**File: `frontend/src/app/RootLayout.tsx`** (full file, currently 16 lines):

```diff
  export function RootLayout() {
    return (
-     <div className="flex min-h-dvh bg-background">
+     <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar />
-       <main className="flex-1 overflow-x-hidden px-4 py-6">
+       <main className="flex-1 overflow-x-hidden overflow-y-auto px-4 py-6">
          <Outlet />
        </main>
      </div>
    )
  }
```

`h-dvh` (fixed, not minimum) plus `overflow-hidden` means the container can never grow taller than the viewport, so `<aside>` (`Sidebar.tsx`, unchanged) never scrolls out of view. `overflow-y-auto` on `<main>` gives the page's own content its own independent scrollbar, isolated from the sidebar. No change to `Sidebar.tsx`, `PublicLayout.tsx`, or `PortalLayout.tsx` — this fix is scoped to the one shared container `RootLayout.tsx` owns.

---

### 2 — Strengthen action-button affordance app-wide (icon + color)

**Create file: `frontend/src/shared/ui/data-table/DeleteRowButton.tsx`**

```tsx
import type { ComponentProps } from 'react'
import { Trash2Icon } from 'lucide-react'

import { Button } from '@/shared/ui/primitives/button'

type DeleteRowButtonProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size'>

/**
 * The one destructive row-action button for every `DataTable` "Delete"
 * column — ghost-sized but destructive-toned, with a `Trash2Icon`, so it
 * reads as a real destructive action instead of plain text
 * (SUPPORTOS-105 task 2). The destructive-tone classes mirror
 * `dropdown-menu.tsx`'s existing `variant="destructive"` `DropdownMenuItem`
 * convention (`text-destructive`, `hover:bg-destructive/10`), not
 * `buttonVariants`'s full-weight `destructive` variant, which is too heavy
 * repeated down a table column. Every caller keeps its own `useConfirm()`
 * gating and mutation — this component only supplies the affordance.
 */
export function DeleteRowButton({ className, children, ...props }: DeleteRowButtonProps) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className={`text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 ${className ?? ''}`.trim()}
      {...props}
    >
      <Trash2Icon />
      {children}
    </Button>
  )
}
```

(Use the existing `cn` helper — `import { cn } from '@/shared/lib/cn'` — instead of the template-literal concat above; the literal is shown here to make the exact class list explicit. Final implementation: `className={cn('text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20', className)}`.)

Apply at all 5 call sites — each is a 2-line change: add the import, swap `<Button size="sm" variant="ghost" onClick={...}>{label}</Button>` for `<DeleteRowButton onClick={...}>{label}</DeleteRowButton>`. `Button` stays imported in every file below (still used for each page's own "New X" action).

**File: `frontend/src/features/accounts/components/RoleListPage.tsx`** line 71:
```diff
- import { Button } from '@/shared/ui/primitives/button'
+ import { Button } from '@/shared/ui/primitives/button'
+ import { DeleteRowButton } from '@/shared/ui/data-table/DeleteRowButton'
```
```diff
-           <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
-             {t('roles.actions.delete')}
-           </Button>
+           <DeleteRowButton onClick={() => void handleDelete(row)}>
+             {t('roles.actions.delete')}
+           </DeleteRowButton>
```

**File: `frontend/src/features/tickets/components/CategoryListPage.tsx`** line 60 — same shape, `t('categories.actions.delete')`.

**File: `frontend/src/features/tasks/components/TaskListPage.tsx`** line 122 — same shape, `t('actions.delete')` (this file's own reopen button on line 118 stays `variant="outline"`, unchanged).

**File: `frontend/src/features/knowledge-base/components/FaqListPage.tsx`** line 58 — same shape, `t('manage.actions.delete')`.

**File: `frontend/src/features/knowledge-base/components/ArticleListPage.tsx`** line 80 — same shape, `t('articles.manage.actions.delete')`.

No other `DataTable` list page has a delete action — `UserListPage.tsx` and `CustomerListPage.tsx` have none (confirmed, see `## Context` #11), `TicketListPage.tsx`/`MyTicketsPage.tsx` have no delete column either.

---

### 3 — Re-evaluate reports/charts on a real charting library (`recharts`)

**Step 1 — install the dependency.** From `frontend/` (not the repo root — Story 67's own note about `remark-gfm` applies here too): `npm install recharts`. Resolves to `^3.10.1` (confirmed current latest this session), whose `peerDependencies` (`"react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"`) are compatible with this app's installed `react@^19.2.8` — no `--legacy-peer-deps` needed. Recorded in `frontend/package.json`/`package-lock.json`.

**Step 2 — rebuild `LineChart.tsx`.**

**File: `frontend/src/shared/ui/chart/LineChart.tsx`** (replaces the full 152-line file):

```tsx
import {
  CartesianGrid,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useDirection } from '@/shared/i18n/useDirection'

import type { ChartSeries } from './types'

// Distinct dash pattern per series, applied alongside `--chart-N` — never
// hue alone (CONVENTIONS.md § 25 line 1629). `undefined` means a solid
// line, so the first series (the common case: one line) stays plain.
const SERIES_DASH: (string | undefined)[] = [undefined, '6 3', '2 3', '8 3 2 3', '1 3']

function colorFor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`
}

function bucketDomain(series: readonly ChartSeries[]): readonly string[] {
  const buckets = new Set<string>()
  for (const s of series) {
    for (const point of s.points) buckets.add(point.bucket)
  }
  return [...buckets].sort()
}

type RechartsRow = { bucket: string } & Record<string, number | string>

function toRows(series: readonly ChartSeries[]): RechartsRow[] {
  return bucketDomain(series).map((bucket) => {
    const row: RechartsRow = { bucket }
    for (const s of series) {
      const point = s.points.find((p) => p.bucket === bucket)
      if (point) row[s.key] = point.value
    }
    return row
  })
}

type LineChartProps = {
  series: readonly ChartSeries[]
  formatValue?: (n: number) => string
  formatBucket?: (b: string) => string
}

/**
 * `recharts`-based line chart — CONVENTIONS.md § 25 rows 1/3/6 (RPT-1/RPT-2/
 * RPT-4 trends). Replaces the hand-built SVG version (SUPPORTOS-105 task 3,
 * a product decision to adopt a real charting library, not re-litigated
 * here). `GaugeChart`/`WaffleChart` stay hand-built — recharts has no
 * native gauge-zone-bar or waffle-grid primitive.
 *
 * RTL: `XAxis`'s own `reversed` prop mirrors the bucket axis — the same
 * effect `GaugeChart.tsx`'s manual `xFor()` (lines 54-57) achieves by hand,
 * but native to the library, so no per-point coordinate math is needed here.
 */
export function LineChart({
  series,
  formatValue = String,
  formatBucket = (b) => b,
}: LineChartProps) {
  const direction = useDirection()
  const rows = toRows(series)

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={256}>
        <RechartsLineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="bucket"
            reversed={direction === 'rtl'}
            tickFormatter={formatBucket}
            tick={{ fontSize: 12 }}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            tickFormatter={(value) => formatValue(Number(value))}
            tick={{ fontSize: 12 }}
            stroke="var(--muted-foreground)"
          />
          <Tooltip
            formatter={(value) => formatValue(Number(value))}
            labelFormatter={(label) => formatBucket(String(label))}
          />
          {series.map((s, seriesIndex) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={colorFor(seriesIndex)}
              strokeWidth={2}
              strokeDasharray={SERIES_DASH[seriesIndex % SERIES_DASH.length]}
              dot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-4">
          {series.map((s, seriesIndex) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <svg width={20} height={8} aria-hidden="true">
                <line
                  x1={0}
                  y1={4}
                  x2={20}
                  y2={4}
                  stroke={colorFor(seriesIndex)}
                  strokeWidth={2}
                  strokeDasharray={SERIES_DASH[seriesIndex % SERIES_DASH.length]}
                />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
```

The hand-rolled per-series `<ul>` legend below the chart is kept unchanged (not replaced by recharts's own `<Legend>`) — it already satisfies CONVENTIONS.md § 25's "dash + color, never hue alone" rule and is proven accessible; swapping it for recharts's built-in legend would need a fresh accessibility check this task doesn't need to take on. `isAnimationActive={false}` matches this app's existing `prefers-reduced-motion` posture from `DSN-2` (Story 37) rather than introducing new chart-entrance motion this app didn't have before.

**Step 3 — rebuild `BarChart.tsx`.**

**File: `frontend/src/shared/ui/chart/BarChart.tsx`** (replaces the full 128-line file):

```tsx
import { Bar, BarChart as RechartsBarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { useDirection } from '@/shared/i18n/useDirection'

import type { ChartCategory } from './types'

function colorFor(index: number): string {
  return `var(--chart-${(index % 5) + 1})`
}

type BarChartProps = {
  categories: readonly ChartCategory[]
  orientation?: 'vertical' | 'horizontal'
  formatValue?: (n: number) => string
}

/**
 * `recharts`-based bar chart — CONVENTIONS.md § 25 rows 2/5 (RPT-1 by
 * status/category/channel; RPT-3 ranked agents, `orientation="horizontal"`).
 * Never re-sorts: `grouped_counts` already orders descending server-side,
 * relied on by the CSV export of the same query — `categories` is passed
 * to recharts in the exact order given. Replaces the hand-built SVG version
 * (SUPPORTOS-105 task 3).
 *
 * This component's own `orientation` prop ('vertical' = bars grow upward,
 * the common case; 'horizontal' = bars grow sideways, ranked-agent charts)
 * is unchanged from before this task — every caller (`TicketReportsPage`,
 * `AgentReportsPage`) needs no edit. Internally it maps to recharts's own,
 * oppositely-named `layout` prop ('horizontal' layout = upward bars,
 * 'vertical' layout = sideways bars).
 *
 * RTL: the relevant axis's `reversed` prop mirrors it — the category axis
 * for vertical bars (categories read right-to-left), the value axis for
 * horizontal bars (bars grow from the RTL start edge) — matching the two
 * different manual techniques the old hand-built version used (reversing
 * the category array vs. flipping the bar's anchor x), but through one
 * consistent native mechanism instead of two bespoke ones.
 */
export function BarChart({
  categories,
  orientation = 'vertical',
  formatValue = String,
}: BarChartProps) {
  const direction = useDirection()
  const isHorizontal = orientation === 'horizontal'
  const data = [...categories]

  return (
    <ResponsiveContainer width="100%" height={256}>
      <RechartsBarChart
        data={data}
        layout={isHorizontal ? 'vertical' : 'horizontal'}
        margin={{ top: 8, right: 16, left: isHorizontal ? 8 : 0, bottom: 8 }}
      >
        {isHorizontal ? (
          <>
            <XAxis
              type="number"
              tickFormatter={(value) => formatValue(Number(value))}
              tick={{ fontSize: 12 }}
              stroke="var(--muted-foreground)"
              reversed={direction === 'rtl'}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12 }}
              width={120}
              stroke="var(--muted-foreground)"
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12 }}
              stroke="var(--muted-foreground)"
              reversed={direction === 'rtl'}
            />
            <YAxis
              tickFormatter={(value) => formatValue(Number(value))}
              tick={{ fontSize: 12 }}
              stroke="var(--muted-foreground)"
            />
          </>
        )}
        <Tooltip formatter={(value) => formatValue(Number(value))} />
        <Bar dataKey="value" isAnimationActive={false}>
          <LabelList
            dataKey="value"
            position={isHorizontal ? 'right' : 'top'}
            formatter={(value: number) => formatValue(value)}
            className="fill-foreground text-xs"
          />
          {data.map((category, index) => (
            <Cell key={category.key} fill={colorFor(index)} />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  )
}
```

The always-visible per-bar value label (`<LabelList>`) preserves the original hand-built version's behavior of showing every bar's value as permanent text, not only on hover — the original always rendered a `<text>` next to/above each bar.

**Step 4 — no other file changes.** `ChartFrame.tsx`, `GaugeChart.tsx`, `WaffleChart.tsx`, `ChartDataTable.tsx`, `types.ts`, `index.ts` are untouched — `index.ts`'s existing `export { LineChart } from './LineChart'` / `export { BarChart } from './BarChart'` lines need no change since both components keep their exported name and prop shape. `TicketReportsPage.tsx`, `CsatReportsPage.tsx`, `SlaReportsPage.tsx`, `AgentReportsPage.tsx` need no edits — every call site's existing props (`series`, `categories`, `orientation`, `formatValue`, `formatBucket`) are still valid.

---

### 4 — Shrink the sidebar footer and add a real settings surface

**Create file: `frontend/src/app/PreferencesPage.tsx`** (new, follows `NotFoundPage.tsx`'s precedent of a shell-level page living in `app/`, not `features/`, since it has no API calls and composes only existing shared primitives):

```tsx
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/shared/ui/primitives/card'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { PageHeader } from '@/shared/ui/PageHeader'

/**
 * A personal-preferences page open to every authenticated user (unlike
 * `/settings`, `features/organization/components/SettingsPage.tsx`, which
 * is an org-admin form gated behind `settings.manage`). Hosts the
 * `LanguageSwitcher`/`ThemeToggle` moved out of `Sidebar.tsx`'s footer
 * (SUPPORTOS-105 task 4) — both components are unchanged, still own their
 * state via `i18n.changeLanguage`/`useTheme()`, zero props either way.
 */
export function PreferencesPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('preferences.title')} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('language.label')}</span>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('theme.label')}</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

**File: `frontend/src/app/router.tsx`** — add a new ungated route inside the same `RequireAuth` children array `tasks`/`tasks/new`/`tasks/:id/edit` (lines 397-419) already sit in, right after the `tasks/:id/edit` block (line 419) and before the closing of that array (line 420):

```diff
          {
            path: 'tasks/:id/edit',
            lazy: async () => {
              const { TaskFormPage } = await import('@/features/tasks/components/TaskFormPage')
              return { element: <TaskFormPage /> }
            },
          },
+         {
+           path: 'preferences',
+           lazy: async () => {
+             const { PreferencesPage } = await import('./PreferencesPage')
+             return { element: <PreferencesPage /> }
+           },
+         },
        ],
      },
```

No `RequirePermission` wrapper — matches the `index: true`/`HealthPage` and `tasks`/`TaskListPage` precedent (both directly under `RequireAuth` with no permission gate), confirmed at `router.tsx` lines 50-56 and 397-419.

**File: `frontend/src/app/Sidebar.tsx`** — three edits:

1. Icon import (line 17, alphabetically between `SearchIcon` and `SettingsIcon`):
```diff
    SearchIcon,
+   Settings2Icon,
    SettingsIcon,
```

2. Drop the now-unused imports (lines 32-33):
```diff
- import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
- import { ThemeToggle } from '@/shared/ui/ThemeToggle'
```

3. New ungated nav link, inserted after the `/settings` `<Can>` block (line 283) and before `</nav>` (line 284) — placed in the main nav, not the footer, matching `/tasks`'s own existing ungated `SidebarLink` (lines 189-194) as the in-file precedent for an item with no `<Can>` wrapper:
```diff
        </Can>
+       <SidebarLink
+         to="/preferences"
+         icon={Settings2Icon}
+         label={t('preferences.title')}
+         collapsed={collapsed}
+       />
      </nav>
```

4. Footer shrink (lines 285-311) — drop the middle `LanguageSwitcher`/`ThemeToggle` row entirely, tighten `gap-3`/`p-3` to `gap-2`/`p-2` on the wrapper:
```diff
-     <div className="mt-auto flex flex-col gap-3 border-t p-3">
+     <div className="mt-auto flex flex-col gap-2 border-t p-2">
        {user ? (
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col')}>
            <NotificationBell />
            {collapsed ? null : (
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                {user.email}
              </span>
            )}
          </div>
        ) : null}
-       <div className={cn('flex items-center gap-2', collapsed ? 'flex-col' : 'justify-between')}>
-         <LanguageSwitcher />
-         <ThemeToggle />
-       </div>
        {user ? (
          <Button
            variant="ghost"
            size="sm"
            className={cn('justify-start gap-2', collapsed && 'justify-center px-0')}
            onClick={() => void logout()}
          >
            <LogOutIcon />
            {collapsed ? null : t('actions.logout')}
          </Button>
        ) : null}
      </div>
```

Result: exactly the intake's own stated outcome — "bell, email, logout only."

**File: `frontend/src/shared/i18n/locales/en/common.json`** — add a new top-level key after `"sidebar"` (line 45):
```diff
    "sidebar": {
      "collapse": "Collapse sidebar",
      "expand": "Expand sidebar"
    },
+   "preferences": {
+     "title": "Preferences"
+   },
```

**File: `frontend/src/shared/i18n/locales/ar/common.json`** — same position, after `"sidebar"` (line 49):
```diff
    "sidebar": {
      "collapse": "طي الشريط الجانبي",
      "expand": "توسيع الشريط الجانبي"
    },
+   "preferences": {
+     "title": "التفضيلات"
+   },
```

No `resources.ts` change — `common` is already a registered namespace; this only adds a key inside it. No new i18next namespace needed for one page with two rows of already-existing controls.

---

### 5 — Fix the one Badge inconsistency found in the app-wide audit

The audit (`## Context` #32) walked all 41 `<Badge` call sites app-wide. 40 are correct and internally consistent (see the grouped list in `## Context`). One is not:

**File: `frontend/src/features/customers/components/ContactDetailsSection.tsx`** line 127 — a customer's stored contact-method badge (e.g. "Email", "Phone") uses `variant="secondary"`, while the app's other 3 "channel" badges — `TicketConversation.tsx:96`, `TicketHistorySection.tsx:109`, `InteractionTimelineSection.tsx:86` — all use `variant="outline"` for the identical semantic concept (a small classifying tag naming which channel something came through). `secondary` (a filled gray pill) and `outline` (a bordered transparent pill) are visually different weights for what should read as the same kind of tag:

```diff
- <Badge variant="secondary">{t(`contacts.channels.${contact.channel}`)}</Badge>
+ <Badge variant="outline">{t(`contacts.channels.${contact.channel}`)}</Badge>
```

No other Badge call site needs a change. In particular, `ArticleListPage.tsx`'s `default`/`secondary` split for published/draft status is a **deliberate, already-documented** choice from Story 50 (`DSN-4`) — its own summary explicitly excludes article status from the `success`/`warning`/`info` rollout given to ticket/task/SLA/escalation states — not an oversight this task should "fix" back into that rollout.

---

### 6 — Style primary-column table links so they read as links

**Create file: `frontend/src/shared/ui/data-table/TableLink.tsx`**

```tsx
import type { ComponentProps } from 'react'
import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'

/**
 * A `DataTable` primary-column link — `text-primary` + `hover:underline`,
 * the exact class string `buttonVariants`'s own `link` variant already
 * uses (`shared/ui/primitives/button.tsx` line 21), so a table-cell link
 * reads identically to every other link-styled control in this app.
 * Preflight strips the browser's default link underline/color, so a bare
 * `<Link>` with no className is otherwise indistinguishable from plain
 * text (SUPPORTOS-105 task 6). Every `to` target passes straight through
 * unchanged — this component only adds styling.
 */
export function TableLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn('text-primary underline-offset-4 hover:underline', className)} {...props} />
}
```

Apply at all 11 sites — each is a 2-line change: add `import { TableLink } from '@/shared/ui/data-table/TableLink'`, swap the cell's `<Link to={...}>...</Link>` for `<TableLink to={...}>...</TableLink>`. The existing `Link` import (from `react-router`) stays in every one of these files — each still uses plain `Link` elsewhere (a "New X" button, a back-link) that is not part of this fix.

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`** line 81:
```diff
- cell: (row) => <Link to={`/tickets/${row.id}`}>{row.subject}</Link>,
+ cell: (row) => <TableLink to={`/tickets/${row.id}`}>{row.subject}</TableLink>,
```

**File: `frontend/src/features/accounts/components/RoleListPage.tsx`** line 48:
```diff
- cell: (row) => <Link to={`/roles/${row.id}/edit`}>{row.name}</Link>,
+ cell: (row) => <TableLink to={`/roles/${row.id}/edit`}>{row.name}</TableLink>,
```

**File: `frontend/src/features/tasks/components/TaskListPage.tsx`** lines 78 and 84 (both, not just the primary one the intake's grep caught):
```diff
- cell: (row) => <Link to={`/tasks/${row.id}/edit`}>{row.title}</Link>,
+ cell: (row) => <TableLink to={`/tasks/${row.id}/edit`}>{row.title}</TableLink>,
```
```diff
  cell: (row) =>
-   row.ticket === null ? '—' : <Link to={`/tickets/${row.ticket}`}>{row.ticket_subject}</Link>,
+   row.ticket === null ? '—' : <TableLink to={`/tickets/${row.ticket}`}>{row.ticket_subject}</TableLink>,
```

**File: `frontend/src/features/knowledge-base/components/FaqListPage.tsx`** line 45:
```diff
- cell: (row) => <Link to={`/knowledge-base/manage/${row.id}/edit`}>{row.question}</Link>,
+ cell: (row) => <TableLink to={`/knowledge-base/manage/${row.id}/edit`}>{row.question}</TableLink>,
```

**File: `frontend/src/features/customers/components/CustomerListPage.tsx`** line 57:
```diff
- cell: (row) => <Link to={`/customers/${row.id}`}>{row.name}</Link>,
+ cell: (row) => <TableLink to={`/customers/${row.id}`}>{row.name}</TableLink>,
```

**File: `frontend/src/features/accounts/components/UserListPage.tsx`** line 40:
```diff
- cell: (row) => <Link to={`/users/${row.id}/edit`}>{row.email}</Link>,
+ cell: (row) => <TableLink to={`/users/${row.id}/edit`}>{row.email}</TableLink>,
```

**File: `frontend/src/features/knowledge-base/components/ArticleListPage.tsx`** lines 50-52 (the multi-line variant, confirmed present):
```diff
  cell: (row) => (
-   <Link to={`/knowledge-base/articles/manage/${row.id}/edit`}>
+   <TableLink to={`/knowledge-base/articles/manage/${row.id}/edit`}>
      {isArabic ? row.title_ar : row.title_en}
-   </Link>
+   </TableLink>
  ),
```

**File: `frontend/src/features/tickets/components/CategoryListPage.tsx`** line 48:
```diff
- cell: (row) => <Link to={`/categories/${row.id}/edit`}>{row.name}</Link>,
+ cell: (row) => <TableLink to={`/categories/${row.id}/edit`}>{row.name}</TableLink>,
```

**File: `frontend/src/features/portal/components/PortalTicketListPage.tsx`** line 64:
```diff
- cell: (row) => <Link to={`/portal/tickets/${row.id}`}>{row.subject}</Link>,
+ cell: (row) => <TableLink to={`/portal/tickets/${row.id}`}>{row.subject}</TableLink>,
```

**File: `frontend/src/features/portal/components/PortalTicketHistoryPage.tsx`** line 44:
```diff
- cell: (row) => <Link to={`/portal/tickets/${row.id}`}>{row.subject}</Link>,
+ cell: (row) => <TableLink to={`/portal/tickets/${row.id}`}>{row.subject}</TableLink>,
```

**File: `frontend/src/features/tickets/components/MyTicketsPage.tsx`** line 65 (the `id: 'subject'` column, lines 61-66):
```diff
- cell: (row) => <Link to={`/tickets/${row.id}`}>{row.subject}</Link>,
+ cell: (row) => <TableLink to={`/tickets/${row.id}`}>{row.subject}</TableLink>,
```

`PortalArticleListPage.tsx:47` is confirmed out of scope (Card-based, not `DataTable` — see `## Context` #35) and is not touched.

---

## Edge Cases & Failure Modes

- **Task 1 — `<main>`'s new `overflow-y-auto` and browser auto-scroll-into-view on focus.** When a form field inside `<main>` receives focus (e.g. `FormErrorSummary`'s "focus first error" behavior from `DSN-2`), the browser scrolls the nearest scrollable ancestor into view — that is now `<main>` instead of the document. This is standard browser behavior requiring no code change, but should be re-confirmed visually (`## Verification Steps` below) since it was previously implicit document-level scroll.
- **Task 1 — `DataTable`'s own horizontal scroll (`table.tsx` line 10, `overflow-x-auto`) is on a different axis** than `<main>`'s new vertical scroll — no nesting conflict, confirmed by reading `table.tsx`.
- **Task 1 — toasts and dialogs render via portal to `document.body`**, unaffected by `<main>`'s new `overflow-y-auto` (they are outside the `<main>` subtree).
- **Task 2 — `DeleteRowButton`'s `className` prop merge order.** `cn(baseClasses, className)` means a caller-supplied `className` can override the destructive-tone classes if it conflicts — none of the 5 current call sites pass a `className`, so this is inert today but should stay last-wins if a future caller needs a one-off override.
- **Task 3 — accessibility trade-off, stated honestly, not glossed over.** The original hand-built `LineChart`/`BarChart` gave every data point/bar a `tabIndex={0}`, `role="img"`, `aria-label`, and `<title>` — individually keyboard-focusable and screen-reader-describable. Recharts's `Line`/`Bar` do not expose an equivalent per-point/per-bar `tabIndex`/`aria-label` without a custom `shape`/`dot` render prop, which this task does not add (scope: adopt recharts for the two chart types, not re-invent per-point accessibility recharts doesn't natively give). Mitigated by two things that are unchanged and already mandatory: `ChartFrame.tsx`'s `table` prop (required, not optional, per its own doc comment) gives every chart an always-available accessible data table toggle; `BarChart`'s new always-visible `<LabelList>` value text is real DOM text, readable by a screen reader without any interaction. This is a real, deliberate trade-off of the already-made "adopt recharts" product decision, not an oversight.
- **Task 3 — `recharts`'s `ResponsiveContainer` needs a sized parent.** `ChartFrame.tsx`'s `<div role="img" aria-label={title}>` wrapper (line 82) has no explicit height, but its content (the `ResponsiveContainer`'s own `height={256}` prop) is itself the source of height, not the parent — no layout-thrashing risk, confirmed by reading `ChartFrame.tsx`'s existing DOM structure.
- **Task 3 — the "~28 zero-value points before a spike" visual concern the intake's own prose raised** (a `/reports/tickets` 30-day default plotting mostly-zero data) is a **data-shape** observation, not a rendering-library defect — recharts renders it accurately (a mostly-flat line with a real spike, with gridlines and an interactive tooltip giving more context than the old static SVG did), which is a genuine improvement, but this task does not add a special "mostly empty" treatment beyond what recharts's own axis/gridlines/tooltip already provide. Not silently dropped — explicitly out of this task's scope, since the already-made product decision was "adopt a real charting library," not "also add a low-signal-data affordance."
- **Task 4 — `/preferences` has no permission gate, by design, matching `/` (`HealthPage`) and `/tasks`.** A future reviewer should not treat this as a missed `<Can>` wrapper — every authenticated user, regardless of role, should reach their own display preferences.
- **Task 4 — collapsed-sidebar rendering of the new `SidebarLink`.** `SidebarLink` already handles `collapsed` (icon-only, `aria-label`/`title` fallback) for every other entry — the new Preferences link needs no special-casing, it is styled identically to `/tasks`'s existing ungated entry.
- **Task 5 — `ContactDetailsSection.tsx`'s fix is presentation-only.** `contact.channel`'s underlying value/type is untouched; only the badge's visual variant changes.
- **Task 6 — `TableLink`'s `className` merge follows the same `cn(base, className)` pattern as `DeleteRowButton`** — no current call site passes an override, but a future one could layer on top (e.g. `text-end` for a numeric-looking column) without losing the link styling.

---

## Test Plan

**This project does not write automated tests** (`CONVENTIONS.md` § 16). No test file is added, modified, or proposed for any of the 6 tasks above. Verification is manual, per `## Verification Steps` below, plus the static suite (`lint`/`format:check`/`check:rtl`/`build`, backend's `python manage.py test`) as a regression check — none of the 6 tasks touches a backend file, so the backend suite is expected to be unaffected, not exercised by new coverage.

---

## Migration / Rollback

Only task 3 introduces a non-trivial change (a new dependency). If `recharts` needs to be rolled back after this story lands: `git revert` the commit(s) touching `LineChart.tsx`/`BarChart.tsx` (restores the hand-built SVG versions from before this story) and run `npm uninstall recharts` from `frontend/` (removes it from `package.json`/`package-lock.json`). No data migration, no backend change, no schema — a pure frontend dependency addition with two files as its only blast radius (`index.ts`'s re-exports and every consumer's props are unchanged either way, so a rollback needs no consumer-file changes).

---

## Verification Steps

1. **Frontend builds and lints clean:** from `frontend/` — `npm install` (picks up `recharts`), `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **Backend unaffected:** from `backend/` — `python manage.py test` still passes (54/54 expected, no backend file touched by this story).
3. **Task 1 — sidebar scroll:** open `/tickets/:id` on a ticket with enough content to exceed one viewport (dark theme, matching the original report); scroll the page — the sidebar (`Sidebar.tsx`) stays pinned, only the ticket detail content scrolls. Repeat on at least one other long staff page (e.g. `/customers/:id` with several sections, or `/knowledge-base/articles/:id/edit`) to confirm the fix is structural, not ticket-detail-specific.
4. **Task 2 — delete button affordance:** on `/roles`, `/categories`, `/tasks`, `/knowledge-base/manage`, `/knowledge-base/articles/manage` — each row's delete action now shows a trash icon and a red/destructive text tone, distinguishable at a glance from a plain label; clicking it still opens the existing `useConfirm()` dialog before deleting.
5. **Task 3 — charts:** on `/reports/tickets`, `/reports/sla`, `/reports/csat`, `/reports/agents` — every `LineChart`/`BarChart` renders via recharts (gridlines, hover tooltips, axis ticks now present, which the old SVG version didn't have); switch to `ar`/RTL — the trend/category axis visually mirrors; `GaugeChart` (`/reports/sla`'s breach-rate gauges) and `WaffleChart` (`/reports/csat`'s breakdown) are visually unchanged from before this story.
6. **Task 4 — sidebar footer and preferences page:** the sidebar footer now shows only the bell+email row and the Log out button (no language/theme row); a new "Preferences" link appears in the main nav for every signed-in user regardless of role; clicking it opens `/preferences`, showing the language selector and theme toggle, both fully functional (switching either takes effect immediately, matching their old in-footer behavior); confirm a non-admin user (no `settings.manage` permission) can still reach `/preferences` (unlike `/settings`, which correctly still 403s/hides for them).
7. **Task 5 — badge fix:** on a customer profile page with at least one contact method, the contact's channel badge now renders as an outlined (bordered, transparent) pill instead of a filled gray one, matching the channel badge style seen elsewhere (e.g. a ticket's message channel badge in `TicketConversation`).
8. **Task 6 — table links:** on `/tickets`, `/roles`, `/tasks`, `/knowledge-base/manage`, `/knowledge-base/articles/manage`, `/categories`, `/customers`, `/users`, `/portal/tickets`, `/portal/tickets/history`, `/tickets/my-tickets` — every primary-column cell value now renders as a colored, underline-on-hover link; every link's destination is unchanged from before this story (spot-check at least 3 by clicking through).
9. **Full `en`/LTR and `ar`/RTL pass** across all touched routes, light and dark mode, matching the same discipline Stories 66-68 each called out as outstanding when browser tooling wasn't available — if browser-automation tooling is available this session, perform it directly; if not, record it as outstanding the same way Stories 66/67/68 did, not silently skipped.

---

## Done Criteria

- [ ] `RootLayout.tsx` — container is `h-dvh overflow-hidden`, `<main>` has `overflow-y-auto`; `Sidebar.tsx` unchanged for this task.
- [ ] `DeleteRowButton.tsx` created; applied at all 5 sites (`RoleListPage.tsx`, `CategoryListPage.tsx`, `TaskListPage.tsx`, `FaqListPage.tsx`, `ArticleListPage.tsx`); `useConfirm()` gating unchanged at every site.
- [ ] `recharts` installed (`frontend/package.json`/`package-lock.json`); `LineChart.tsx`/`BarChart.tsx` rebuilt on it; `GaugeChart.tsx`/`WaffleChart.tsx`/`ChartFrame.tsx`/`ChartDataTable.tsx`/`types.ts` unchanged; zero edits needed in any of the 4 report page consumers.
- [ ] `PreferencesPage.tsx` created; `/preferences` route added to `router.tsx` inside `RequireAuth`, no `RequirePermission`; `Sidebar.tsx` footer shrunk to 2 rows; new ungated nav link added; `preferences.title` key added to both `common.json` locale files.
- [ ] `ContactDetailsSection.tsx:127` badge variant changed from `secondary` to `outline`; no other Badge call site changed.
- [ ] `TableLink.tsx` created; applied at all 11 sites across 10 files listed in task 6; every `to` target unchanged.
- [ ] No backend file changed — `git diff --stat` confirms `frontend/` only.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) all exit 0; `python manage.py test` (backend) unaffected.
- [ ] Verified live per `## Verification Steps` 3-8, in both `en`/LTR and `ar`/RTL, light and dark mode (or explicitly recorded as outstanding if no browser tooling is available this session, per Stories 66-68's own precedent).
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row and narrative paragraph.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-14` is an accumulating story — future user-reported findings become new tasks appended to a future re-plan of this same story (or a follow-on story), not a new `DSN-1N` number, per `SupportOs backlog.MD:631`'s own "accumulates rather than closing after one pass" framing.
