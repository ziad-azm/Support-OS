# Story 62 — (DSN-7) Cross-Feature Consistency Remediation (Story: SUPPORTOS-98)

## Prerequisites

- **`DSN-6` (Story 61) is complete.** `design-system/supportos/UX-AUDIT.md` exists with 65 findings; this story consumes exactly the 12 rows whose **Category** column is `consistency` (the register's own category→owning-story mapping assigns all `consistency` rows to `DSN-7`): `UX-003, UX-013, UX-020, UX-022, UX-030, UX-033, UX-036, UX-038, UX-044, UX-047, UX-054, UX-061`. Do not touch any other category's rows — those belong to `DSN-8`–`DSN-12`, unplanned.
- **The `DSN-6`–`DSN-13` thread guardrail is binding** (`SupportOs backlog.MD:556`): "frontend visual/UX only... No data-flow, API, or route-logic changes; no new component library; permission gates and i18n keys preserved exactly." Two of the 12 findings' *literal* recommended fixes, as written in the register, would violate this — verified during planning, not assumed:
  - **`UX-030`** (FAQs have no draft/publish `status` field, unlike Articles) requires a new backend model field + migration. **Out of scope for this story** — flag as deferred in the register with a note that it needs a dedicated non-DSN story or an explicit guardrail exception, since `DSN-7` cannot add a Django model field.
  - **`UX-038`** (Role/Category/Task list pages lack `UserListPage`'s debounced search) — verified via `grep -n "search_fields" backend/apps/accounts/views.py backend/apps/tickets/views.py backend/apps/agents/views.py`: `RoleViewSet` (`backend/apps/accounts/views.py:167`, `search_fields = ("name", "slug")`) and `CategoryViewSet` (`backend/apps/tickets/views.py:44`, `search_fields = ("name",)`) **already** support `?search=` server-side — adding the frontend search UI for Roles and Categories is a pure frontend change. `TaskViewSet` (`backend/apps/agents/views.py:18-34`) declares **no** `search_fields` at all — wiring a search box there would silently no-op (DRF's `SearchFilter` with an empty `search_fields` filters nothing) unless the backend gains a `search_fields = ("title",)` line, which is a backend change this story cannot make. **Task's list is deferred; Role and Category proceed.**
- **`UX-036`'s recommended fix is corrected during planning, not implemented as literally written.** The register recommends falling back to "a truncated `body_en`/`body_ar`" for empty-headline article search results — but `ArticleSearchResult` (`frontend/src/features/knowledge-base/types/searchResult.ts:12-21`) has no `body_en`/`body_ar` fields at all; the search API never returns them (confirmed by reading the type in full — only `title_en`/`title_ar`/`headline_en`/`headline_ar`/`status`/`rank`). Adding them would be an API response-shape change, forbidden by the guardrail. This story implements a frontend-only fallback instead (a placeholder string), not the register's literal text — see task 7.
- **`UX-044`'s recommended fix is corrected during planning.** The register frames `TaskFormPage`'s `max-w-lg` as the odd one out vs. "others'" `max-w-2xl`. Verified via `grep -rn "max-w-2xl\|max-w-lg" frontend/src/features`: **6** form pages use `max-w-lg` (`CustomerFormPage.tsx:119`, `PortalTicketFormPage.tsx:55`, `PortalFeedbackFormPage.tsx:69`, `FaqFormPage.tsx:91`, `TicketFormPage.tsx:153`, `TaskFormPage.tsx:140`) and only **4** use `max-w-2xl` (`UserFormPage.tsx:118,216`, `RoleFormPage.tsx:153`, `ArticleFormPage.tsx:141`, `CategoryFormPage.tsx:96`) — `max-w-lg` is the majority pattern, and `TaskFormPage` already matches it. `RoleFormPage`'s width is justified by its permission-checklist grid (`RoleFormPage.tsx:176-208`) and `ArticleFormPage`'s by its two side-by-side English/Arabic content `Card`s (`ArticleFormPage.tsx:150-183`) — both genuinely need more horizontal room. `CategoryFormPage` (one `name` field) and `UserFormPage` (email/name/role fields) have no such content justifying the extra width. This story narrows `CategoryFormPage`/`UserFormPage` to `max-w-lg` (converging on the majority), not `TaskFormPage` to `max-w-2xl` — see task 9.
- **`UX-020`'s three sites are re-verified individually, not treated as one uniform fix.** `TicketAssigneeControl.tsx:54` and `TicketListPage.tsx:154`'s `SelectTrigger`s both bind to persisted filter/assignment state (`assignedAgent`, `categoryFilter`) that stays selected and visible — a real truncation risk. `TicketConversation.tsx:145`'s quick-reply `SelectTrigger` does **not**: `selectedQuickReplyId` is reset to `''` immediately after every pick (`TicketConversation.tsx:117-123`, `setSelectedQuickReplyId('')` inside `handleQuickReplySelect`), so the trigger only ever displays its placeholder, never a persisted selected value — there is nothing to truncate. This is a verified false positive for that one site; task 5 fixes the other two only.
- **Intake Task 1's "align date/number display on the `I18N` formatters" needs no fix.** Verified via `grep -rn "toLocaleDateString\|toLocaleString\|toLocaleTimeString" frontend/src/features` — zero matches. Every date/number display already goes through the shared `useFormatters()` hook (`date`/`dateTime`/`number`), confirmed already in use across every list page read for this plan (`CategoryListPage.tsx:20`, `TaskListPage.tsx:34`, `TicketListPage.tsx:43`, `AgentReportsPage.tsx:27`, etc.). Nothing in the register flags a formatter bypass. No task in this plan touches date/number formatting.

---

## Story Goal

Resolve the 12 `consistency`-category rows of `design-system/supportos/UX-AUDIT.md`, landing every fix at the shared-component or single-source-file level per the thread guardrail — no new visual variant is introduced anywhere; every fix reuses an existing primitive, pattern, or translation key already present in the codebase.

**Disposition of all 12 findings:**

| ID | Disposition |
|---|---|
| `UX-003` | Fixed — distinct icon per Reports sidebar link, translation-key rename |
| `UX-013` | Fixed — `HealthPage` adopts `PageHeader`/`Card`/shared `Button` |
| `UX-020` | Fixed for 2 of 3 sites (`TicketAssigneeControl`, `TicketListPage`); 3rd site (`TicketConversation` quick-reply) is a verified false positive, no change |
| `UX-022` | Fixed — `MyTicketsPage` empty state branches on active filters |
| `UX-030` | **Deferred** — requires a backend model field, outside this story's frontend-only guardrail |
| `UX-033` | Fixed — `ArticleBrowsePage` gains the same cross-nav links `FaqBrowsePage` already has |
| `UX-036` | Fixed with a corrected approach — frontend-only placeholder fallback, not the register's literal `body_en`/`body_ar` suggestion (that field doesn't exist in the API response) |
| `UX-038` | Fixed for Role + Category (backend already supports `?search=`); **Task deferred** — its backend has no `search_fields` |
| `UX-044` | Fixed with a corrected approach — `CategoryFormPage`/`UserFormPage` narrow to `max-w-lg` (the actual majority); `TaskFormPage` needs no change |
| `UX-047` | Fixed — `AgentReportsPage`'s bar chart caps at 15 agents with a note pointing at the existing "show table" toggle |
| `UX-054` | Fixed — `NotFoundPage` adopts the icon-circle + `<h1>` + `Card` pattern `LoginPage` already uses |
| `UX-061` | Fixed — `PortalTicketListPage`'s status filter gets a `title` attribute |

**Register bookkeeping (per the intake's "update register entries to resolved"):** `design-system/supportos/UX-AUDIT.md` gains a new **Status** column (8th column, after "Owning story") — task 12 adds it to all 65 rows (default `Open` for the 53 rows this story doesn't touch) and sets it to `Resolved` / `Resolved (partial)` / `Deferred` for the 12 rows above, each with a one-line note where the disposition table above diverges from the register's original recommended fix.

**Not in scope:** anything outside the 12 `consistency` rows; any backend/model/API change (`UX-030`, Task's portion of `UX-038`); introducing any new shared component not already justified by an existing register recommendation ("reuse-first, no new variants unless the register proves a real gap," per the intake).

---

## Context — Read These Files First

1. `design-system/supportos/UX-AUDIT.md` — the 12 `consistency` rows this story implements (`UX-003, UX-013, UX-020, UX-022, UX-030, UX-033, UX-036, UX-038, UX-044, UX-047, UX-054, UX-061`); task 12 adds the Status column to every one of its 65 rows.
2. `SupportOs backlog.MD` lines 556, 566-570 (`DSN-6`–`DSN-13` guardrail and the `DSN-7` story text) — the frontend-only constraint governing every task below.
3. `frontend/src/app/Sidebar.tsx` lines 1-19 (icon imports), 195-226 (the 5 Reports links) — task 1's edit site.
4. `frontend/src/features/reports/locales/en.json` lines 1-6 and `frontend/src/features/reports/locales/ar.json` (same keys) — `title`/`sidebarSla`/`sidebarAgents`/`sidebarCsat`/`sidebarDashboard`, the exact keys task 1 renames one of.
5. `frontend/src/features/health/components/HealthPage.tsx` (full file, 36 lines) — task 2's rewrite target; `frontend/src/shared/ui/PageHeader.tsx` and `frontend/src/shared/ui/primitives/card.tsx` for the primitives it adopts.
6. `frontend/src/features/tickets/components/TicketAssigneeControl.tsx` (full file, 67 lines) and `frontend/src/features/tickets/components/TicketListPage.tsx` lines 55, 152-165 — task 5's two edit sites.
7. `frontend/src/features/tickets/components/MyTicketsPage.tsx` lines 103-105 and `frontend/src/features/tickets/components/TicketListPage.tsx` lines 199-205 — the empty-state branch task 6 mirrors.
8. `frontend/src/features/knowledge-base/components/ArticleBrowsePage.tsx` lines 24-32 and `frontend/src/features/knowledge-base/components/FaqBrowsePage.tsx` lines 24-41 — task 8's source pattern; `frontend/src/features/knowledge-base/locales/en.json` lines 2, 32-34 for the exact `title`/`articles.manage.title` keys to reuse (no new strings).
9. `frontend/src/features/knowledge-base/components/SearchPage.tsx` lines 79-84 and `frontend/src/features/knowledge-base/types/searchResult.ts` (full file, 28 lines) — task 9's edit site and the type confirming no `body_en`/`body_ar` field exists.
10. `frontend/src/features/accounts/components/UserListPage.tsx` (full file, 126 lines) — the debounced-search pattern task 10 extracts; `frontend/src/features/accounts/components/RoleListPage.tsx` (full file, 102 lines) and `frontend/src/features/tickets/components/CategoryListPage.tsx` (full file, 90 lines) — the two edit sites.
11. `frontend/src/features/accounts/components/UserFormPage.tsx` lines 118, 216; `frontend/src/features/tickets/components/CategoryFormPage.tsx` line 96 — task 11's two edit sites (width narrowing).
12. `frontend/src/features/reports/components/AgentReportsPage.tsx` (full file, 118 lines) and `frontend/src/shared/ui/chart/ChartFrame.tsx` (full file, 101 lines, specifically lines 39-49 for its `children`/`table` render-prop contract and line 82's `role="img"` wrapper) — task 13's edit site and the contract it must not break.
13. `frontend/src/app/NotFoundPage.tsx` (full file, 12 lines) and `frontend/src/features/auth/components/LoginPage.tsx` lines 48-55 (the icon-circle + `<h1>` pattern to mirror) and `frontend/src/shared/i18n/locales/en/common.json` lines 7, 21 (`actions.goHome`, `states.notFound` — the existing keys, no new strings) — task 14's edit site.
14. `frontend/src/features/portal/components/PortalTicketListPage.tsx` lines 43-52, 115-127 — task 15's edit site.

---

## Frontend Tasks

### 1 — Sidebar Reports links: distinct icons + naming-convention fix (`UX-003`)

**File: `frontend/src/app/Sidebar.tsx`**

Add 4 new icon imports to the existing `lucide-react` import block (line 2-19), alongside the existing `ChartNoAxesColumnIcon`:

```tsx
import {
  BarChart3Icon,
  BookOpenIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ContactIcon,
  FileTextIcon,
  GaugeIcon,
  HistoryIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListTodoIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SmileIcon,
  TagIcon,
  TicketIcon,
  UserCogIcon,
  UsersIcon,
} from 'lucide-react'
```

(`ChartNoAxesColumnIcon` is removed — no longer used once every Reports link gets its own icon.)

Replace the 5 Reports `SidebarLink`s (lines 195-226) with distinct icons per destination and a renamed first key:

```tsx
<Can permission="reports.view">
  <SidebarLink
    to="/reports/tickets"
    icon={BarChart3Icon}
    label={t('reports:sidebarTickets')}
    collapsed={collapsed}
  />
  <SidebarLink
    to="/reports/sla"
    icon={GaugeIcon}
    label={t('reports:sidebarSla')}
    collapsed={collapsed}
  />
  <SidebarLink
    to="/reports/agents"
    icon={UsersIcon}
    label={t('reports:sidebarAgents')}
    collapsed={collapsed}
  />
  <SidebarLink
    to="/reports/csat"
    icon={SmileIcon}
    label={t('reports:sidebarCsat')}
    collapsed={collapsed}
  />
  <SidebarLink
    to="/reports/dashboard"
    icon={LayoutDashboardIcon}
    label={t('reports:sidebarDashboard')}
    collapsed={collapsed}
  />
</Can>
```

**File: `frontend/src/features/reports/locales/en.json`** line 2 and **`frontend/src/features/reports/locales/ar.json`** (same line) — rename the `title` key to `sidebarTickets`, keeping its existing value (`"Ticket Reports"` / the Arabic equivalent) so the link's visible label is unchanged, only the key name changes to match its 4 siblings' `sidebarX` convention:

```diff
- "title": "Ticket Reports",
+ "sidebarTickets": "Ticket Reports",
```

Every other reference to `reports:title` (e.g. `TicketReportsPage.tsx`'s own `PageHeader title={t('title')}`, which resolves within the `reports` namespace, not `reports:title` — confirm via `grep -rn "t('title')" frontend/src/features/reports` that this is the *only* file using the bare `title` key from outside the namespace before renaming) must be checked; if `TicketReportsPage.tsx` also relies on this key, add `sidebarTickets` as a new key instead of renaming, and update only `Sidebar.tsx` to reference it — do not break `TicketReportsPage`'s own page title.

---

### 2 — `HealthPage` adopts `PageHeader`/`Card`/shared `Button` (`UX-013`)

**File: `frontend/src/features/health/components/HealthPage.tsx`** — full rewrite of the return block, keeping every existing `t(...)` key and the `QueryBoundary`/`useHealth`/`useToast` logic unchanged:

```tsx
import { useTranslation } from 'react-i18next'

import { useHealth } from '../api/useHealth'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Button } from '@/shared/ui/primitives/button'
import { PageHeader } from '@/shared/ui/PageHeader'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

export function HealthPage() {
  const query = useHealth()
  const { toast } = useToast()
  const { t } = useTranslation('health')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <QueryBoundary query={query}>
            {(health) => (
              <ul className="flex flex-col gap-1 text-sm">
                <li>
                  {t('status')}: {t(`value.${health.status}`)}
                </li>
                <li>
                  {t('database')}: {t(`value.${health.database}`)}
                </li>
              </ul>
            )}
          </QueryBoundary>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => toast({ tone: 'info', message: t('toastFired') })}
          >
            {t('testToast')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

No new translation keys — `title`/`status`/`database`/`value.*`/`toastFired`/`testToast` all already exist in the `health` namespace.

---

### 3 — `TicketAssigneeControl` gains a `title` attribute (`UX-020`, site 1 of 2)

**File: `frontend/src/features/tickets/components/TicketAssigneeControl.tsx`** — compute the selected agent's display name and pass it as `title` on `SelectTrigger`:

```tsx
export function TicketAssigneeControl({
  ticketId,
  assignedAgent,
}: {
  ticketId: number
  assignedAgent: number | null
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const agentsQuery = useAssignableAgents()
  const mutation = useAssignTicket(ticketId)

  const selectedAgentLabel =
    assignedAgent === null
      ? t('fields.unassigned')
      : ((agentsQuery.data ?? []).find((agent) => agent.id === assignedAgent)?.name ?? undefined)

  function onValueChange(next: string) {
    mutation.mutate(next === UNASSIGNED ? null : Number(next), {
      onSuccess: () => toast({ tone: 'success', message: t('assign.updated') }),
    })
  }

  return (
    <Select
      value={assignedAgent === null ? UNASSIGNED : String(assignedAgent)}
      onValueChange={onValueChange}
      disabled={mutation.isPending || agentsQuery.isPending}
    >
      <SelectTrigger aria-label={t('assign.label')} title={selectedAgentLabel} size="sm">
        <SelectValue />
      </SelectTrigger>
      {/* ...unchanged... */}
```

---

### 4 — `TicketListPage` category filter gains a `title` attribute (`UX-020`, site 2 of 2)

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`** — compute the selected category's label above the `columns` array (near the existing `categoriesQuery` at line 55) and pass it as `title` on the category filter's `SelectTrigger` (lines 153-156):

```tsx
const selectedCategoryLabel =
  categoryFilter === 'all'
    ? t('filters.allCategories')
    : (categoriesQuery.data?.items ?? []).find((category) => String(category.id) === categoryFilter)
        ?.name

// ...
<SelectTrigger aria-label={t('filters.category')} title={selectedCategoryLabel} size="sm">
```

`TicketConversation.tsx`'s quick-reply `SelectTrigger` (line 145) is **not** touched — verified false positive, see `## Prerequisites`.

---

### 5 — `MyTicketsPage` empty state branches on active filters (`UX-022`)

**File: `frontend/src/features/tickets/components/MyTicketsPage.tsx`** line 142 — mirror `TicketListPage.tsx`'s branch (lines 199-205), replacing the single always-shown empty state:

```tsx
empty={
  statusFilter !== 'all' || priorityFilter !== 'all' ? (
    <Empty title={t('noSearchResults')} />
  ) : (
    <Empty title={t('myQueue.empty')} description={t('myQueue.emptyDescription')} />
  )
}
```

`noSearchResults` already exists in the `tickets` namespace (used identically by `TicketListPage.tsx:201`) — reused verbatim, no new key. If its copy reads oddly for a filter-narrowed personal queue (vs. a text search), add a `myQueue.noFilterResults` key with the same value as a starting point and use that instead; do not invent new copy without a translated key backing it in both `en`/`ar`.

---

### 6 — `ArticleBrowsePage` gains the same cross-nav `FaqBrowsePage` already has (`UX-033`)

**File: `frontend/src/features/knowledge-base/components/ArticleBrowsePage.tsx`** — replace the `PageHeader`'s `action` (lines 27-31), adding the two links `FaqBrowsePage.tsx:27-38` already has, reusing its exact `Can`/`Button` structure and existing translation keys (`title` = "Knowledge base", `articles.manage.title` = "Manage articles" — both already in `frontend/src/features/knowledge-base/locales/en.json`):

```tsx
import { Can } from '@/shared/auth'
// ...

<PageHeader
  title={t('articles.title')}
  action={
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link to="/knowledge-base">{t('title')}</Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link to="/knowledge-base/search">{t('search.title')}</Link>
      </Button>
      <Can permission="knowledge_base.manage">
        <Button asChild variant="outline" size="sm">
          <Link to="/knowledge-base/articles/manage">{t('articles.manage.title')}</Link>
        </Button>
      </Can>
    </div>
  }
/>
```

---

### 7 — `SearchPage` article results get a fallback when `headline` is empty (`UX-036`, corrected)

**File: `frontend/src/features/knowledge-base/components/SearchPage.tsx`** lines 79-84 — since `body_en`/`body_ar` don't exist on `ArticleSearchResult` (see `## Prerequisites`), fall back to a translated placeholder instead of body text:

```tsx
<CardContent>
  <MarkdownPreview>
    {(isArabic ? result.headline_ar : result.headline_en) ||
      t('search.noPreview')}
  </MarkdownPreview>
</CardContent>
```

**File: `frontend/src/features/knowledge-base/locales/en.json`** — add one new key inside `"search"` (alongside `"empty"`/`"emptyDescription"` at lines 89-90): `"noPreview": "No preview available."`. **File: `frontend/src/features/knowledge-base/locales/ar.json`** — add the matching Arabic translation at the same path.

---

### 8 — Role and Category list pages gain debounced search (`UX-038`, 2 of 3 sites)

**Create file: `frontend/src/shared/hooks/useDebouncedSearch.ts`** — extracts `UserListPage.tsx`'s exact search-state pattern (lines 19, 33-45) into a reusable hook, since it is about to have 3 call sites (Users, Roles, Categories):

```tsx
import { useEffect, useState } from 'react'

const SEARCH_DEBOUNCE_MS = 300

/** Debounced search-input state, reset-to-page-1 side effect included.
 *  Extracted from `UserListPage` (Story 48) once Roles/Categories adopted
 *  the same pattern — see CONVENTIONS.md's DSN-7 entry. */
export function useDebouncedSearch(setPage: (page: number) => void) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [search, setPage])

  return { searchInput, setSearchInput, search }
}
```

**File: `frontend/src/features/accounts/components/UserListPage.tsx`** — replace lines 19, 33-39, 41-43 with `const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)`, removing the now-duplicated local `useEffect`s and the `SEARCH_DEBOUNCE_MS` constant. Behavior is unchanged — this is a pure extraction, verify with `git diff` that `UserListPage`'s rendered search box and query params are byte-identical before/after.

**File: `frontend/src/features/accounts/components/RoleListPage.tsx`** — add the same `Input` block `UserListPage.tsx:102-107` has (placed between `PageHeader` and `DataTable`), wired via `useDebouncedSearch`:

```tsx
import { Input } from '@/shared/ui/primitives/input'
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch'
// ...
const { sort, setSort, setPage, params } = useServerTable({ initialSort: { field: 'name', direction: 'asc' } })
const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)
const query = useRoles({ ...params, ...(search ? { search } : {}) })
// ...
<Input
  value={searchInput}
  onChange={(event) => setSearchInput(event.target.value)}
  placeholder={t('roles.searchPlaceholder')}
  aria-label={t('roles.search')}
/>
```

Add the `empty` branch mirroring `UserListPage.tsx:116-122` (search vs. no-results-yet), and add `search`/`searchPlaceholder` keys under `roles` in `frontend/src/features/accounts/locales/{en,ar}.json` (mirror the existing `users.search`/`users.searchPlaceholder` keys' exact copy pattern, e.g. `"Search roles…"`).

**File: `frontend/src/features/tickets/components/CategoryListPage.tsx`** — same pattern: `useDebouncedSearch`, an `Input` between `PageHeader` and `DataTable`, `search` param passed to `useCategoryList`, a branched `empty`, and new `categories.search`/`categories.searchPlaceholder` keys in `frontend/src/features/tickets/locales/{en,ar}.json`.

`useRoles`/`useCategoryList`'s query-param types must accept an optional `search?: string` — check `frontend/src/features/accounts/api/useRoles.ts` and `frontend/src/features/tickets/api/useCategoryList.ts`; if their param type doesn't already include `search` (unlike `useUsers`, which does, since `UserListPage` already sends it), widen the type to accept it — this is a frontend type change only, the backend endpoint already accepts the query param via `search_fields`.

**`TaskListPage.tsx` is explicitly not touched** — see `## Prerequisites`.

---

### 9 — Narrow `CategoryFormPage`/`UserFormPage` to `max-w-lg` (`UX-044`, corrected)

**File: `frontend/src/features/tickets/components/CategoryFormPage.tsx`** line 96 — `max-w-2xl` → `max-w-lg`.

**File: `frontend/src/features/accounts/components/UserFormPage.tsx`** lines 118 and 216 (both the create and edit form wrappers) — `max-w-2xl` → `max-w-lg` at both sites.

`RoleFormPage.tsx:153` and `ArticleFormPage.tsx:141` are **not** touched — their `max-w-2xl` is justified content-width, not drift. `TaskFormPage.tsx:140` needs no change — it already matches the (now 8-of-10) `max-w-lg` majority.

---

### 10 — `AgentReportsPage`'s bar chart caps at 15 agents (`UX-047`, corrected)

**File: `frontend/src/features/reports/components/AgentReportsPage.tsx`** — inside the `ChartFrame`'s `children` render prop (lines 112-114), cap the chart to the first 15 rows and add a note when truncated, without changing `ChartFrame`'s `role="img"` contract (`ChartFrame.tsx:82`) or its existing "show table" toggle (which already renders the full, untruncated `rows` via `ChartDataTable` — see `table` prop, lines 104-110, unchanged):

```tsx
const AGENT_CHART_LIMIT = 15

// ...inside the component, after `query`:
{(rows) => (
  <div className="flex flex-col gap-2">
    <BarChart
      orientation="horizontal"
      categories={rows.slice(0, AGENT_CHART_LIMIT)}
      formatValue={formatMetricValue}
    />
    {rows.length > AGENT_CHART_LIMIT ? (
      <p className="text-sm text-muted-foreground">
        {t('agents.truncated', { shown: AGENT_CHART_LIMIT, total: rows.length })}
      </p>
    ) : null}
  </div>
)}
```

Add `agents.truncated` to `frontend/src/features/reports/locales/en.json` (inside the `agents` object, alongside `title`/`description`/`filters`/`metrics`/`fields`) and `ar.json`: `"truncated": "Showing top {{shown}} of {{total}} — use \"Show table\" below for the full list."` (adapt Arabic wording to formal MSA, consistent with `CONVENTIONS.md`'s existing bilingual bar for this codebase).

---

### 11 — `NotFoundPage` adopts the icon-circle + `<h1>` + `Card` pattern (`UX-054`)

**File: `frontend/src/app/NotFoundPage.tsx`** — full rewrite, reusing `LoginPage.tsx:50-55`'s exact structure (adapted: no `max-w-sm` width constraint, since this page renders inside `RootLayout`'s full-width `<main>` alongside the `Sidebar`, not `PublicLayout`'s centered column):

```tsx
import { SearchXIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <SearchXIcon className="size-6 text-primary" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{t('states.notFound')}</h1>
      <Card className="w-full">
        <CardContent className="flex justify-center py-4">
          <Button asChild>
            <Link to="/">{t('actions.goHome')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

No new translation keys — `states.notFound`/`actions.goHome` already exist in `frontend/src/shared/i18n/locales/{en,ar}/common.json` (the default namespace `useTranslation()` with no argument reads). `SearchXIcon` is a real `lucide-react` export (verified present in `node_modules/lucide-react/dist/esm/icons/`).

---

### 12 — `PortalTicketListPage` status filter gains a `title` attribute (`UX-061`)

**File: `frontend/src/features/portal/components/PortalTicketListPage.tsx`** — compute the selected status label near the existing `statusFilter` state (line 43) and pass it as `title` on the `SelectTrigger` (line 116):

```tsx
const selectedStatusLabel =
  statusFilter === 'all'
    ? t('tickets.filters.allStatuses')
    : t(`tickets.statuses.${statusFilter}`)

// ...
<SelectTrigger aria-label={t('tickets.filters.status')} title={selectedStatusLabel} size="sm">
```

---

### 13 — Record the deferral for `UX-030` (no code change)

`UX-030` (FAQ status field) requires a backend model change this story's guardrail forbids. No frontend or backend file is touched for this finding — task 14 records its `Deferred` status and reasoning directly in the register.

---

### 14 — Add a Status column to `design-system/supportos/UX-AUDIT.md`

**File: `design-system/supportos/UX-AUDIT.md`** — add a new **Status** column as the 8th column (after "Owning story") to the header row, the separator row, and all 65 data rows:

```markdown
| ID | Screen | Category | Severity | Finding | Recommended fix | Owning story | Status |
|---|---|---|---|---|---|---|---|
```

Default every row not touched by this story to `Open`. Set the 12 `consistency` rows to:

- `UX-003`, `UX-013`, `UX-022`, `UX-033`, `UX-054`, `UX-061` → `Resolved (Story 62)`
- `UX-020` → `Resolved (Story 62) — 2 of 3 sites; TicketConversation quick-reply confirmed a false positive, no change needed`
- `UX-036` → `Resolved (Story 62) — placeholder fallback, not body text (API has no body_en/body_ar field; adding one is out of scope)`
- `UX-038` → `Resolved (Story 62) — Role, Category only; Task deferred, its backend has no search_fields (out of this story's frontend-only scope)`
- `UX-044` → `Resolved (Story 62) — corrected: CategoryFormPage/UserFormPage narrowed to max-w-lg (the actual majority); TaskFormPage needed no change`
- `UX-047` → `Resolved (Story 62) — chart caps at 15 with a note; full data stays reachable via the existing "show table" toggle`
- `UX-030` → `Deferred — requires a backend FAQ status field/migration; outside DSN-6–13's frontend-only guardrail. Needs a dedicated non-DSN story or an explicit exception.`

Also update the register's own header summary line (`**Totals: 65 findings**...`) — add a line beneath it: `**Story 62 (DSN-7): 10 resolved, 1 partially resolved, 1 deferred, of 12 consistency findings.**`

---

## Edge Cases & Failure Modes

- **`UX-020`'s `TicketAssigneeControl.tsx`**: `agentsQuery.data` is `undefined` while pending — `selectedAgentLabel` computes to `undefined` in that window (via the `?? undefined` on the `.find()` result), which is a valid `title` prop value (React omits the attribute), not a crash. Confirmed no runtime error either way.
- **`UX-038`'s extracted `useDebouncedSearch` hook**: `UserListPage`'s existing behavior (search resets to page 1, 300ms debounce) must be byte-identical after extraction — a regression here would affect the one screen (`UserListPage`) that already worked correctly before this story. Verify via manual test, not just visual diff (debounce timing isn't visible in a screenshot).
- **`UX-038`'s Role/Category search silently returning zero results** if `useRoles`/`useCategoryList`'s underlying query function doesn't already forward an arbitrary `search` param to the API client the way `useUsers` does — check `frontend/src/features/accounts/api/useUsers.ts`'s param-forwarding shape before assuming `useRoles.ts`/`useCategoryList.ts` follow it exactly; if either builds its query string manually rather than spreading params, the new `search` key must be added there too (still a frontend-only change).
- **`UX-047`'s `AGENT_CHART_LIMIT = 15` vs. the backend's own ordering** — the cap takes the *first* 15 rows returned by `useAgentPerformance`; if the API doesn't already sort by the selected `metric` descending, "top 15" is misleading. Confirm `backend`'s agent-performance endpoint orders by the requested metric (check `apps/reports/... agent_performance` view) before shipping; if it doesn't, the note's "top 15" wording should read "first 15" instead, or the frontend must sort `rows` by `value` descending before slicing — a one-line addition (`[...rows].sort((a, b) => b.value - a.value).slice(0, AGENT_CHART_LIMIT)`), still frontend-only.
- **`UX-054`'s `NotFoundPage`** now renders inside `RootLayout`'s `<main>` (with `Sidebar` visible) for a signed-in user hitting an unknown staff route, but the *same* component also renders for an unauthenticated visitor hitting an unknown path before `RequireAuth` redirects — check `router.tsx`'s `*` route placement (sibling of the `RequireAuth` block, both children of `path: '/'`) to confirm `NotFoundPage` doesn't require auth context that isn't available pre-login; the rewrite above uses no auth-dependent hook, so this is safe, but note it for the executor.
- **A future `shadcn add card`/`add button` regenerates `card.tsx`/`button.tsx`** — none of this story's tasks touch those primitives, only consumers of them, so this is a non-issue here (unlike Story 37/`DSN-2`'s `card.tsx` edit).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. No backend impact — every task above is frontend-only or a pure documentation edit (`UX-AUDIT.md`); `python manage.py test` (from `backend/`) is unaffected. Re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass — `check:rtl` matters here specifically since task 1 removes a nav icon import and tasks 3/4/12 add `title` attributes, both low-risk but worth the same automated check every prior `DSN` story ran.
3. Manual verification only beyond that, per `## Verification Steps` below.

---

## Verification Steps

1. **Frontend builds and lints clean:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **Sidebar Reports links:** open the app, expand the Reports group — 5 links, each with a visually distinct icon (`BarChart3Icon`/`GaugeIcon`/`UsersIcon`/`SmileIcon`/`LayoutDashboardIcon`), all still permission-gated behind `reports.view` and pointing at their original routes.
3. **`HealthPage` (`/`):** now renders inside a `PageHeader` + `Card`, the "Fire toast" button is the shared `Button` (hover shows a pointer cursor, matching every other button in the app) — functionally unchanged (still calls the same toast).
4. **Tooltips on 4 sites:** hover a ticket's assignee dropdown (`TicketAssigneeControl`), the ticket list's category filter, and the portal ticket list's status filter — each shows the full selected value as a native tooltip on hover when truncated. Confirm the ticket conversation's quick-reply picker is unchanged (always shows its placeholder).
5. **`MyTicketsPage` empty state:** filter to a status/priority combination with zero results — shows "no results for this filter" copy, not the generic "no assigned tickets" copy; clear the filter back to "all" — generic empty state returns (when the queue is actually empty) or the table repopulates.
6. **`ArticleBrowsePage` (`/knowledge-base/articles`):** header now shows 3 actions (Knowledge base, Search, and — only for a `knowledge_base.manage` account — Manage articles), matching `FaqBrowsePage`'s header shape.
7. **`SearchPage` (`/knowledge-base/search`):** search for a term that matches an article with no headline match — the result card shows "No preview available." instead of a blank body.
8. **Role/Category search:** on `/roles` and `/categories`, type a partial name into the new search box — the table narrows to matching rows after the 300ms debounce; clear the box — full list returns. `/tasks` is confirmed unchanged (no search box added).
9. **Form widths:** `/categories/new` and `/users/new` now render at the same (narrower) width as `/tickets/new`/`/tasks/new`; `/roles/new` and `/knowledge-base/articles/manage/new` are visually unchanged (still wider, for their grid/dual-language content).
10. **Agent report cap:** on `/reports/agents`, with more than 15 agents in the selected period (or verify the logic reads correctly against fewer), confirm the chart shows at most 15 bars plus a "Showing top N of M" note when truncated, and that the existing "Show table" toggle still reveals the complete, untruncated list.
11. **404 page:** navigate to an unknown path while signed in — the icon-circle + heading + Card "Go home" pattern renders inside the staff shell (`Sidebar` still visible), matches `LoginPage`'s visual language.
12. **`UX-AUDIT.md` register:** the Status column is present on all 65 rows; the 12 `consistency` rows show the dispositions listed in `## Story Goal`'s table; the summary line records the Story 62 tally.

---

## Done Criteria

- [ ] `Sidebar.tsx` — 5 distinct report icons; `reports:title` renamed to `reports:sidebarTickets` (or added alongside it, per task 1's `TicketReportsPage` caveat) in both `en`/`ar` locale files.
- [ ] `HealthPage.tsx` — rewritten with `PageHeader`/`Card`/shared `Button`, all existing `t(...)` keys preserved, no new keys.
- [ ] `TicketAssigneeControl.tsx` and `TicketListPage.tsx` — `title` attributes added to their standalone `SelectTrigger`s; `TicketConversation.tsx` confirmed unchanged.
- [ ] `MyTicketsPage.tsx` — empty state branches on `statusFilter`/`priorityFilter`, mirroring `TicketListPage.tsx`.
- [ ] `ArticleBrowsePage.tsx` — gains the FAQ-link + `Can`-gated manage-link header actions, reusing existing translation keys.
- [ ] `SearchPage.tsx` — article results with no headline show a new `search.noPreview` placeholder (`en`/`ar`), not body text.
- [ ] `useDebouncedSearch.ts` created; `UserListPage.tsx` refactored onto it with no behavior change; `RoleListPage.tsx`/`CategoryListPage.tsx` gain search boxes wired to the already-existing backend `search_fields`; `TaskListPage.tsx` confirmed untouched.
- [ ] `CategoryFormPage.tsx` and `UserFormPage.tsx` (both instances) narrowed to `max-w-lg`; `RoleFormPage.tsx`/`ArticleFormPage.tsx`/`TaskFormPage.tsx` confirmed unchanged.
- [ ] `AgentReportsPage.tsx` — bar chart capped at 15 with a conditional note; `agents.truncated` key added (`en`/`ar`); `ChartFrame`'s `table`/`role="img"` contract untouched.
- [ ] `NotFoundPage.tsx` — rewritten with the icon-circle + `<h1>` + `Card` pattern, no new translation keys.
- [ ] `PortalTicketListPage.tsx` — `title` attribute added to its status filter `SelectTrigger`.
- [ ] `design-system/supportos/UX-AUDIT.md` — Status column added to all 65 rows; the 12 `consistency` rows carry the dispositions from `## Story Goal`; summary line updated.
- [ ] No backend file changed — `git diff --stat` confirms `frontend/` and `design-system/supportos/UX-AUDIT.md` only (plus this plan's own `00-overview.md` update).
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) all exit 0; `python manage.py test` (backend) unaffected.
- [ ] Verified live in the browser per `## Verification Steps` 2-11.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-8` through `DSN-13` (`SupportOs backlog.MD:577-630`) remain unplanned — each consumes a different category of `UX-AUDIT.md` and needs its own intake. `UX-030` (deferred here) and Task's portion of `UX-038` (deferred here) both need a decision — either a dedicated non-`DSN` backend story, or an explicit exception to the `DSN-6`–`DSN-13` frontend-only guardrail — before they can be resolved.
