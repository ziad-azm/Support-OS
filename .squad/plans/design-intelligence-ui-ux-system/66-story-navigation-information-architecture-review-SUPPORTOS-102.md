# Story 66 — (DSN-11) Navigation & Information Architecture Review (Story: SUPPORTOS-102)

## Prerequisites

- **`DSN-6` (Story 61) is complete.** `design-system/supportos/UX-AUDIT.md` has 69 rows; this story consumes the 12 rows whose **Category** column is `IA` (fixed mapping: `IA`→`DSN-11`): `UX-001, UX-002, UX-019, UX-029, UX-034, UX-037, UX-041, UX-050, UX-057, UX-058, UX-059, UX-063`.
- **Two findings need a real backend change and are deferred, verified against current code, not assumed:**
  - **`UX-019`** (SLA column on `TicketListPage`/`MyTicketsPage`) — `frontend/src/features/tickets/types/ticket.ts` has no SLA field on `Ticket`, `backend/apps/tickets/serializers.py`'s `TicketSerializer` has no SLA field either, and `frontend/src/features/tickets/api/useTicketSla.ts` only exposes a single-ticket SLA query (`getTicketSla(ticketId)`), not a bulk field usable in a list column. Adding an SLA column needs a new bulk-SLA data source on the list endpoint — an API change forbidden by the `DSN-6`–`DSN-13` guardrail (`SupportOs backlog.MD:556`).
  - **`UX-057`** (conversation thread on `PortalTicketDetailPage`) — `backend/apps/portal/urls.py` (full file) exposes exactly 3 routes: ticket list/create, ticket retrieve, feedback create — no message/conversation route. `backend/apps/portal/views.py` (full file) has no message-related method on `PortalTicketViewSet`/`PortalFeedbackViewSet`. The staff `MessageViewSet` (`backend/apps/communications/views.py`) gates `list`/`retrieve` behind `Permissions.TICKETS_VIEW`, a staff-only permission no portal customer role holds. Showing the thread needs a new portal-scoped, read-only message endpoint — an API change forbidden by the guardrail. Same category of deferral as `UX-007` (Story 63).
- **`UX-034` is a verified false positive — no code change.** `backend/apps/knowledge_base/views.py:84-91`, `ArticleViewSet.get_queryset()`:
  ```python
  def get_queryset(self):
      queryset = super().get_queryset()
      if Permissions.KNOWLEDGE_BASE_MANAGE in permissions_for(self.request.user):
          return queryset
      return queryset.filter(status=Article.Status.PUBLISHED)
  ```
  already filters every non-manage caller to `status=Article.Status.PUBLISHED` on **both** `list` and `retrieve` — the code's own comment confirms this was a deliberate choice ("a draft's direct id returns 404, not 403, so its existence is not confirmed to a caller who cannot manage it"). A `knowledge_base.view`-only user genuinely cannot reach a draft article's title or body through either `ArticleBrowsePage` or `ArticleReaderPage`. The register's premise (drafts "may be reachable by any view-only user") does not hold; the finding is closed as verified, not fixed.
- **`UX-037`'s literal recommended fix is corrected during planning.** The register suggests a category filter reusing `useCategories` — but `ArticleViewSet` (`backend/apps/knowledge_base/views.py:63-91`) declares no `filterset_fields`, so there is no server-side `?category=` filter to call; adding one would be a backend/API change, forbidden by the guardrail. `ArticleBrowsePage.tsx` already fetches all articles in one page (`page_size: 100`, confirmed at line 22) — every article is already in the client. Implemented as a **client-side** filter over the already-fetched list instead: no backend touched, no new query.
- **`UX-050`'s literal recommended fix is corrected during planning.** `GaugeChart.tsx`'s own doc comment (lines 33-40) states it is reused **unchanged** by `RPT-5`/other report pages ("CONVENTIONS.md § 25 row 7... reuses this component UNCHANGED, not a new chart type") and renders pure SVG with no anchor elements. Rather than inject dashboard-specific `<a>`/`Link` behavior into that shared primitive, drill-down links are added as a small row of plain links in `ManagementDashboardPage.tsx` itself, below the chart — `GaugeChart.tsx` is not touched. The register's fix also suggests "carrying over the current `from`/`to` filter" — none of the 5 report pages sync their date range via a URL search param (each keeps `from`/`to` in local `useState`, confirmed by reading all 5), so carrying the filter over would require adding URL-param sync to all 4 destination pages, well beyond a drill-down-link fix. Implemented as plain route links with no filter carry-over; noted here as a scope correction, not attempted.
- **No new register row this story.** Every file touched by the 9 in-scope fixes below was read in full before planning; nothing adjacent surfaced an uncatalogued defect worth a new `UX-0NN` id.

---

## Story Goal

Resolve 9 of the 12 `IA`-category register rows (two with a corrected approach), close 1 as a verified false positive, and defer 2 that genuinely need a backend change. Every in-scope fix lands frontend-only per the `DSN-6`–`DSN-13` guardrail — no route logic changes, no permission-gate changes, no `Can`/route-path edits.

**Disposition table:**

| ID | Severity | Disposition |
|---|---|---|
| `UX-001` | major | Fixed — `Sidebar.tsx`'s `SidebarLink` and `PortalLayout.tsx`'s nav both switch from `Link` to `NavLink`, gaining a distinct active style and automatic `aria-current="page"` |
| `UX-002` | minor | Fixed — `Sidebar.tsx` gets a labeled section wrapper around the Knowledge Base and Reports link groups |
| `UX-019` | major | Deferred — needs a bulk SLA data source on the ticket list endpoint; no such field exists today, only a per-ticket detail query |
| `UX-029` | minor | Fixed — `FaqListPage.tsx`/`ArticleListPage.tsx` both get a debounced search `Input`, reusing the existing `useDebouncedSearch` hook (`DSN-7`); backend `search_fields` already exist on both viewsets |
| `UX-034` | critical | Resolved — verified false positive, no code change; `ArticleViewSet.get_queryset` already excludes drafts from every non-manage caller |
| `UX-037` | minor | Fixed with a corrected approach — client-side category filter over the already-fully-fetched article list (no backend `filterset_fields` added) |
| `UX-041` | minor | Fixed — `RoleFormPage.tsx`'s permission-group heading changes from `<h3>` to `<h2>`, restoring the heading hierarchy |
| `UX-050` | major | Fixed with a corrected approach — a row of plain drill-down links below the chart in `ManagementDashboardPage.tsx`; `GaugeChart.tsx` itself stays unchanged; filter values are not carried over |
| `UX-057` | critical | Deferred — needs a new portal-scoped, read-only message endpoint; today's portal API exposes no message/conversation route at all |
| `UX-058` | major | Fixed — `PortalFeedbackFormPage.tsx` gets a back link to the ticket detail page, matching the other two deep portal pages |
| `UX-059` | minor | Fixed — `PortalTicketDetailPage.tsx`'s Description `dt`/`dd` pair moves inside the existing `<dl>` |
| `UX-063` | minor | Fixed — `PortalHomePage.tsx`'s quick-link row gains Articles and History links |

**Not in scope:** anything outside these 12 items; any backend/API/route-logic change (`UX-019`, `UX-057` stay deferred); carrying report date-range filters into `UX-050`'s drill-down links; adding a server-side category filter for `UX-037`.

---

## Context — Read These Files First

1. `design-system/supportos/UX-AUDIT.md` — the 12 `IA` rows this story implements; task 10 updates their Status and the header totals.
2. `SupportOs backlog.MD` line 556 (guardrail) and the `DSN-11` story text (`lines 602-`, immediately after `DSN-10`'s block).
3. `frontend/src/app/Sidebar.tsx` (full file, 283 lines) — tasks 1 and 2's edit site. Already modified twice (`DSN-7` icon fixes, `DSN-9` `readCollapsed` default) — read fresh, don't assume an earlier session's snapshot.
4. `frontend/src/features/portal/components/PortalLayout.tsx` (full file, 69 lines) — task 1's second edit site.
5. `frontend/src/shared/ui/primitives/button.tsx` line 64 (`export { Button, buttonVariants }`) — the utility both nav redesigns use to style a `NavLink` without `Button asChild`'s `Slot`/function-`className` conflict.
6. `frontend/src/features/knowledge-base/components/FaqListPage.tsx` (full file, 90 lines), `ArticleListPage.tsx` (full file, 114 lines), `frontend/src/features/accounts/components/RoleListPage.tsx` lines 1-30, 94-99 (the exact search-input pattern to reuse) — task 3's edit sites and reference.
7. `frontend/src/shared/hooks/useDebouncedSearch.ts` (full file, 22 lines) — task 3's reused hook, unchanged.
8. `frontend/src/features/knowledge-base/components/ArticleBrowsePage.tsx` (full file, 80 lines) — task 4's edit site.
9. `frontend/src/features/accounts/components/RoleFormPage.tsx` line 198 — task 5's edit site.
10. `frontend/src/features/reports/components/ManagementDashboardPage.tsx` (full file, 115 lines), `frontend/src/features/reports/types/dashboard.ts` (full file, 14 lines), `frontend/src/shared/ui/chart/GaugeChart.tsx` lines 33-40 (the "reused unchanged" doc comment) — task 6's edit site and the reasoning for not touching `GaugeChart`.
11. `frontend/src/features/portal/components/PortalFeedbackFormPage.tsx` (full file, 102 lines), `frontend/src/features/portal/components/PortalTicketDetailPage.tsx` line 31 (the sibling back-link pattern to match) — task 7's edit site.
12. `frontend/src/features/portal/components/PortalTicketDetailPage.tsx` (full file, 110 lines) — task 8's edit site.
13. `frontend/src/features/portal/components/PortalHomePage.tsx` (full file, 26 lines) — task 9's edit site.
14. `frontend/src/app/router.tsx` lines 326-369, 437-524 — confirms every route path used below (`/reports/tickets|sla|agents|csat`, `/portal`, `/portal/articles`, `/portal/tickets`, `/portal/tickets/history`, `/knowledge-base`) actually exists.

---

## Frontend Tasks

### 1 — `Sidebar.tsx` and `PortalLayout.tsx` gain active-state highlighting (`UX-001`)

**File: `frontend/src/app/Sidebar.tsx`** — replace `SidebarLink`'s `Button asChild` + `Link` with a direct `NavLink` styled via `buttonVariants` (avoids `Slot`'s asChild merging a function `className` from `NavLink` with `Button`'s own):

```tsx
import { NavLink } from 'react-router'
...
import { Button, buttonVariants } from '@/shared/ui/primitives/button'
```

```tsx
function SidebarLink({
  to,
  end,
  icon: Icon,
  label,
  collapsed,
}: {
  to: string
  end?: boolean
  icon: typeof ContactIcon
  label: string
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'justify-start gap-2',
          collapsed && 'justify-center px-0',
          isActive && 'bg-accent text-accent-foreground',
        )
      }
    >
      <Icon />
      {collapsed ? null : label}
    </NavLink>
  )
}
```

`NavLink` sets `aria-current="page"` automatically when active — no manual attribute needed. `react-router`'s default active-matching is prefix-based (not exact), which double-highlights when one nav path is a prefix of a sibling nav path. Two such conflicts exist among the current links and need `end`:

- `to="/tickets"` — sibling `to="/tickets/my-tickets"` would otherwise also activate it. Add `end`.
- `to="/knowledge-base"` — siblings `to="/knowledge-base/articles"` and `to="/knowledge-base/search"` would otherwise also activate it. Add `end`.

Every other `<SidebarLink>` call site (`/customers`, `/categories`, `/tasks`, `/knowledge-base/articles`, `/knowledge-base/search`, `/users`, `/roles`, all 5 `/reports/*`, `/audit-log`, `/settings`) has no such sibling-prefix conflict — leave `end` unset (default `false`) so e.g. `/customers/123` still highlights the `/customers` link.

**File: `frontend/src/features/portal/components/PortalLayout.tsx`** — same technique, replacing every `Button asChild` + `Link` in the nav:

```tsx
import { Link, NavLink, Outlet } from 'react-router'
...
import { Button, buttonVariants } from '@/shared/ui/primitives/button'
```

```tsx
<nav className="flex items-center gap-1">
  <NavLink to="/portal" end className={({ isActive }) => cn(buttonVariants({ variant: 'ghost', size: 'sm' }), isActive && 'bg-accent text-accent-foreground')}>
    {t('nav.home')}
  </NavLink>
  <NavLink to="/portal/faqs" className={({ isActive }) => cn(buttonVariants({ variant: 'ghost', size: 'sm' }), isActive && 'bg-accent text-accent-foreground')}>
    {t('nav.faqs')}
  </NavLink>
  <NavLink to="/portal/articles" className={({ isActive }) => cn(buttonVariants({ variant: 'ghost', size: 'sm' }), isActive && 'bg-accent text-accent-foreground')}>
    {t('nav.articles')}
  </NavLink>
  <NavLink to="/portal/tickets" end className={({ isActive }) => cn(buttonVariants({ variant: 'ghost', size: 'sm' }), isActive && 'bg-accent text-accent-foreground')}>
    {t('nav.myTickets')}
  </NavLink>
  <NavLink to="/portal/tickets/history" className={({ isActive }) => cn(buttonVariants({ variant: 'ghost', size: 'sm' }), isActive && 'bg-accent text-accent-foreground')}>
    {t('nav.history')}
  </NavLink>
  <NavLink to="/portal/tickets/new" className={({ isActive }) => cn(buttonVariants({ variant: 'ghost', size: 'sm' }), isActive && 'bg-accent text-accent-foreground')}>
    {t('nav.newTicket')}
  </NavLink>
</nav>
```

`PortalLayout.tsx` has no existing `cn` import — add `import { cn } from '@/shared/lib/cn'`. `to="/portal"` and `to="/portal/tickets"` need `end` for the same sibling-prefix reason as Sidebar's `/tickets`/`/knowledge-base` (`/portal` prefixes every other portal path; `/portal/tickets` prefixes its own siblings `/portal/tickets/history` and `/portal/tickets/new`). `to="/portal/faqs"`, `/portal/articles`, `/portal/tickets/history`, `/portal/tickets/new` have no sibling-prefix conflict — `end` stays unset so e.g. `/portal/articles/5` still highlights the Articles link. The header's `Link` import is still used elsewhere in this file only if another `Link` remains after this change — since every nav item becomes a `NavLink`, drop `Link` from the import if nothing else in the file uses it (confirm via `npm run build`'s `noUnusedLocals`).

---

### 2 — `Sidebar.tsx` gains section labels for Knowledge Base and Reports (`UX-002`)

**File: `frontend/src/app/Sidebar.tsx`** — add a small wrapper above the `SidebarLink` list, then wrap the Knowledge Base and Reports `<Can>` blocks with it:

```tsx
function NavSection({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      {collapsed ? null : (
        <span className="px-2 text-xs font-medium text-muted-foreground">{label}</span>
      )}
      {children}
    </div>
  )
}
```

Add `import type { ReactNode } from 'react'` alongside the existing `import { useState } from 'react'`. Wrap the two multi-link groups:

```tsx
<Can permission="knowledge_base.view">
  <NavSection label={t('knowledgeBase:title')} collapsed={collapsed}>
    <SidebarLink to="/knowledge-base" end icon={BookOpenIcon} label={t('knowledgeBase:title')} collapsed={collapsed} />
    <SidebarLink to="/knowledge-base/articles" icon={FileTextIcon} label={t('knowledgeBase:articles.title')} collapsed={collapsed} />
    <SidebarLink to="/knowledge-base/search" icon={SearchIcon} label={t('knowledgeBase:search.title')} collapsed={collapsed} />
  </NavSection>
</Can>
```

```tsx
<Can permission="reports.view">
  <NavSection label={t('reports:navSection')} collapsed={collapsed}>
    <SidebarLink to="/reports/tickets" icon={BarChart3Icon} label={t('reports:sidebarTickets')} collapsed={collapsed} />
    <SidebarLink to="/reports/sla" icon={GaugeIcon} label={t('reports:sidebarSla')} collapsed={collapsed} />
    <SidebarLink to="/reports/agents" icon={UsersIcon} label={t('reports:sidebarAgents')} collapsed={collapsed} />
    <SidebarLink to="/reports/csat" icon={SmileIcon} label={t('reports:sidebarCsat')} collapsed={collapsed} />
    <SidebarLink to="/reports/dashboard" icon={LayoutDashboardIcon} label={t('reports:sidebarDashboard')} collapsed={collapsed} />
  </NavSection>
</Can>
```

`t('knowledgeBase:title')` already exists and reads "Knowledge base" — reused verbatim as the section label, no new key. Add a new key `navSection` to `frontend/src/features/reports/locales/en.json`/`ar.json` (top level, alongside the existing `title`/`sidebarTickets`/etc.): `"navSection": "Reports"` (en) / `"navSection": "التقارير"` (ar). No other groups (Customers, Tickets, Categories, Tasks, Users, Roles, Audit Log, Settings) get a section wrapper — the register names only these two groups (3 and 5 links respectively); single/double-link groups are left as-is.

---

### 3 — `FaqListPage.tsx`/`ArticleListPage.tsx` manage tables gain search (`UX-029`)

Both `getFaqs.ts`/`getArticles.ts` already type `search?: string` into their params (`FaqListParams`/`ArticleListParams`), and `backend/apps/knowledge_base/views.py` already declares `search_fields = ("question", "answer")` on `FaqViewSet` (line 37) and `search_fields = ("title_en", "title_ar", "body_en", "body_ar")` on `ArticleViewSet` (line 82) — the backend already supports it; only the list-page UI is missing, mirroring `RoleListPage.tsx`'s existing pattern exactly.

**File: `frontend/src/features/knowledge-base/components/FaqListPage.tsx`** — add imports, the debounced-search hook, and wire it into the query and empty state:

```tsx
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch'
import { Input } from '@/shared/ui/primitives/input'
```

```tsx
const { sort, setSort, setPage, params } = useServerTable({
  initialSort: { field: 'order', direction: 'asc' },
})
const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

const query = useFaqs({ ...params, ...(search ? { search } : {}) })
```

```tsx
<Input
  value={searchInput}
  onChange={(event) => setSearchInput(event.target.value)}
  placeholder={t('manage.searchPlaceholder')}
  aria-label={t('manage.search')}
/>
```

placed between the `<PageHeader>` and `<DataTable>`. Change `empty={<Empty title={t('manage.empty')} description={t('manage.emptyDescription')} />}` to:

```tsx
empty={
  search ? (
    <Empty title={t('manage.noSearchResults')} />
  ) : (
    <Empty title={t('manage.empty')} description={t('manage.emptyDescription')} />
  )
}
```

Add to `frontend/src/features/knowledge-base/locales/en.json`/`ar.json`, inside `manage` (alongside the existing `title`/`new`/`empty` keys): `"search": "Search FAQs"`, `"searchPlaceholder": "Question or answer"`, `"noSearchResults": "No FAQs match that search."` (en) / `"search": "البحث عن الأسئلة الشائعة"`, `"searchPlaceholder": "السؤال أو الإجابة"`, `"noSearchResults": "لا توجد أسئلة شائعة مطابقة لهذا البحث."` (ar).

**File: `frontend/src/features/knowledge-base/components/ArticleListPage.tsx`** — identical shape:

```tsx
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch'
import { Input } from '@/shared/ui/primitives/input'
```

```tsx
const { sort, setSort, setPage, params } = useServerTable({
  initialSort: { field: 'created_at', direction: 'desc' },
})
const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

const query = useArticles({ ...params, ...(search ? { search } : {}) })
```

```tsx
<Input
  value={searchInput}
  onChange={(event) => setSearchInput(event.target.value)}
  placeholder={t('articles.manage.searchPlaceholder')}
  aria-label={t('articles.manage.search')}
/>
```

placed between `<PageHeader>` and `<DataTable>`. Change the `empty` prop the same way, keyed under `articles.manage.noSearchResults`. Add to `frontend/src/features/knowledge-base/locales/en.json`/`ar.json`, inside `articles.manage` (alongside its existing `title`/`new`/`empty` keys): `"search": "Search articles"`, `"searchPlaceholder": "Title or body"`, `"noSearchResults": "No articles match that search."` (en) / `"search": "البحث عن المقالات"`, `"searchPlaceholder": "العنوان أو المحتوى"`, `"noSearchResults": "لا توجد مقالات مطابقة لهذا البحث."` (ar).

---

### 4 — `ArticleBrowsePage.tsx` gains a client-side category filter (`UX-037`, corrected)

**File: `frontend/src/features/knowledge-base/components/ArticleBrowsePage.tsx`** — the page already fetches all up to 100 articles in one request (line 22); filter the already-fetched array client-side, no new query:

```tsx
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/primitives/select'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useArticles } from '../api/useArticles'
import type { Article } from '../types/article'

export function ArticleBrowsePage() {
  const { t, i18n } = useTranslation('knowledgeBase')
  const isArabic = i18n.language.startsWith('ar')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const query = useArticles({ page: 1, page_size: 100, ordering: '-created_at' })

  const categories = useMemo(() => {
    const names = new Set<string>()
    for (const article of query.data?.items ?? []) {
      if (article.category_name) names.add(article.category_name)
    }
    return [...names].sort()
  }, [query.data])

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('articles.title')}
        action={/* unchanged — see current file */}
      />
      <QueryBoundary
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <Empty title={t('articles.browse.empty')} description={t('articles.browse.emptyDescription')} />
        }
      >
        {(data) => {
          const items =
            categoryFilter === 'all'
              ? data.items
              : data.items.filter((article: Article) => article.category_name === categoryFilter)
          return (
            <div className="flex flex-col gap-4">
              {categories.length > 0 ? (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger
                    aria-label={t('articles.browse.filterCategory')}
                    size="sm"
                    className="self-start"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('articles.browse.allCategories')}</SelectItem>
                    {categories.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('articles.browse.noCategoryResults')}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {items.map((article: Article) => (
                    <Card key={article.id}>
                      <CardHeader>
                        <CardTitle>
                          <Link to={`/knowledge-base/articles/${article.id}`}>
                            {isArabic ? article.title_ar : article.title_en}
                          </Link>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {article.category_name ? (
                            <Badge variant="secondary">{article.category_name}</Badge>
                          ) : null}
                          {article.status !== 'published' ? (
                            <Badge variant="outline">{t('articles.manage.statuses.draft')}</Badge>
                          ) : null}
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )
        }}
      </QueryBoundary>
    </div>
  )
}
```

(The `PageHeader`'s `action` block — the Search/Manage links — is unchanged from the current file; keep it as-is, only the `QueryBoundary` children function body changes.) Add to `frontend/src/features/knowledge-base/locales/en.json`/`ar.json`, inside `articles.browse` (alongside the existing `empty`/`emptyDescription`/`readMore` keys): `"filterCategory": "Filter by category"`, `"allCategories": "All categories"`, `"noCategoryResults": "No articles in this category."` (en) / `"filterCategory": "التصفية حسب الفئة"`, `"allCategories": "كل الفئات"`, `"noCategoryResults": "لا توجد مقالات في هذه الفئة."` (ar). No backend file is touched — `category` filtering happens entirely over the array already in memory from the existing `useArticles` call.

---

### 5 — `RoleFormPage.tsx`'s permission-group heading fixes the hierarchy (`UX-041`)

**File: `frontend/src/features/accounts/components/RoleFormPage.tsx`** line 198 — the page `<h1>` (line 154) is followed directly by this `<h3>`, skipping `<h2>`:

```diff
- <h3 className="text-sm font-medium">{areaLabel(area)}</h3>
+ <h2 className="text-sm font-medium">{areaLabel(area)}</h2>
```

Pure tag change — `text-sm font-medium` already overrides the browser's default heading styles, so this is visually identical, only the semantic level changes.

---

### 6 — `ManagementDashboardPage.tsx` gains drill-down links (`UX-050`, corrected)

**File: `frontend/src/features/reports/components/ManagementDashboardPage.tsx`** — add a `Link` import and a per-KPI route map, then render a row of links below the `ChartFrame`:

```tsx
import { useState } from 'react'
import { DownloadIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Label } from '@/shared/ui/primitives/label'
import { ChartDataTable, ChartFrame, GaugeChart } from '@/shared/ui/chart'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useToast } from '@/shared/ui/toast/useToast'

import { DateRangePresets } from './DateRangePresets'
import { exportReport } from '../api/exportReport'
import { useDashboardKpis } from '../api/useDashboardKpis'
import { DASHBOARD_KPIS } from '../types/dashboard'
import type { DashboardKpi } from '../types/dashboard'

const KPI_REPORT_ROUTES: Record<DashboardKpi, string> = {
  open_rate: '/reports/tickets',
  sla_health: '/reports/sla',
  csat_risk: '/reports/csat',
  agent_load: '/reports/agents',
}
```

After the closing `</ChartFrame>` (line 112), before the component's closing `</div>`:

```tsx
      <div className="flex flex-wrap gap-2">
        {DASHBOARD_KPIS.map((kpi) => (
          <Button key={kpi} asChild variant="ghost" size="sm">
            <Link to={KPI_REPORT_ROUTES[kpi]}>{t(`dashboard.kpis.${kpi}`)}</Link>
          </Button>
        ))}
      </div>
```

Each of the 4 KPIs (`open_rate`, `sla_health`, `csat_risk`, `agent_load`) maps 1:1 to its own report route, in the same order the intake and `DASHBOARD_KPIS` already use ("Open tickets, SLA health, CSAT, agent load"). `GaugeChart.tsx` is not modified. No filter carry-over — see `## Prerequisites`.

---

### 7 — `PortalFeedbackFormPage.tsx` gains a back link (`UX-058`)

**File: `frontend/src/features/portal/components/PortalFeedbackFormPage.tsx`** — add `Link` to the existing `react-router` import and a back link above the `<h1>`, matching `PortalTicketDetailPage.tsx:31`'s exact style:

```diff
- import { useNavigate, useParams } from 'react-router'
+ import { Link, useNavigate, useParams } from 'react-router'
```

```diff
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4">
+       <Link
+         to={`/portal/tickets/${ticketId}`}
+         className="text-sm text-muted-foreground hover:underline"
+       >
+         {t('tickets.feedback.backToTicket')}
+       </Link>
        <h1 className="text-lg font-semibold">{t('tickets.feedback.title')}</h1>
```

`ticketId` is already computed (`Number(idParam)`, line 41) — reused as-is, no new state. Add `backToTicket` to `frontend/src/features/portal/locales/en.json`/`ar.json`, inside `tickets.feedback` (alongside the existing `cta`/`thanks`/`title` keys): `"backToTicket": "Back to ticket"` (en) / `"backToTicket": "العودة إلى التذكرة"` (ar).

---

### 8 — `PortalTicketDetailPage.tsx`'s Description pair moves inside its `<dl>` (`UX-059`)

**File: `frontend/src/features/portal/components/PortalTicketDetailPage.tsx`** lines 45-90 — the Description `dt`/`dd` (lines 85-90) currently sits as a sibling `<div>` after the `</dl>` that closes at line 84. Move it inside, spanning both columns on `sm:`:

```diff
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.status')}
                      </dt>
                      <dd>
                        <Badge variant={ticketStatusVariant(ticket.status)}>
                          {t(`tickets.statuses.${ticket.status}`)}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.priority')}
                      </dt>
                      <dd>
                        <Badge variant={ticketPriorityVariant(ticket.priority)}>
                          {t(`tickets.priorities.${ticket.priority}`)}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.category')}
                      </dt>
                      <dd>{ticket.category_name ?? t('tickets.fields.noCategory')}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.assignedAgent')}
                      </dt>
                      <dd>{ticket.assigned_agent_name ?? t('tickets.fields.unassigned')}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t('tickets.fields.createdAt')}
                      </dt>
                      <dd>{date(ticket.created_at)}</dd>
                    </div>
-                  </dl>
-                  <div>
-                    <dt className="text-sm text-muted-foreground">
-                      {t('tickets.fields.description')}
-                    </dt>
-                    <dd className="whitespace-pre-wrap">{ticket.description}</dd>
-                  </div>
+                    <div className="sm:col-span-2">
+                      <dt className="text-sm text-muted-foreground">
+                        {t('tickets.fields.description')}
+                      </dt>
+                      <dd className="whitespace-pre-wrap">{ticket.description}</dd>
+                    </div>
+                  </dl>
```

Same structural fix `TicketDetailPage.tsx:89`/`TicketSlaSection.tsx:40` already use elsewhere (per `UX-021`, Story 64) — one `<dl>`, each field a `<div>` child, `sm:col-span-2` for the one full-width field.

---

### 9 — `PortalHomePage.tsx` quick links add Articles and History (`UX-063`)

**File: `frontend/src/features/portal/components/PortalHomePage.tsx`** lines 13-23:

```diff
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/portal/tickets/new">{t('tickets.new')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/portal/tickets">{t('nav.myTickets')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/portal/faqs">{t('nav.faqs')}</Link>
        </Button>
+       <Button asChild variant="outline">
+         <Link to="/portal/articles">{t('nav.articles')}</Link>
+       </Button>
+       <Button asChild variant="outline">
+         <Link to="/portal/tickets/history">{t('nav.history')}</Link>
+       </Button>
      </div>
```

`nav.articles`/`nav.history` already exist in `frontend/src/features/portal/locales/en.json`/`ar.json` (used by `PortalLayout.tsx`'s own nav) — reused verbatim, no new keys.

---

### 10 — Register bookkeeping

**File: `design-system/supportos/UX-AUDIT.md`** — update the Status column for all 12 `IA` rows:

- `UX-001`, `UX-002`, `UX-029`, `UX-041`, `UX-058`, `UX-059`, `UX-063` → `Resolved (Story 66)`
- `UX-034` → `Resolved (Story 66) — verified false positive, no code change needed` (append "**Verified during Story 66:** `ArticleViewSet.get_queryset` already filters non-manage callers to `status=published` on both list and retrieve; no draft is reachable by a view-only caller." to the Finding column, matching `UX-040`/`UX-047`'s existing precedent)
- `UX-037` → `Resolved (Story 66) — corrected, client-side filter only` (append "**Corrected during Story 66 implementation:** `ArticleViewSet` has no `filterset_fields`; adding server-side category filtering would be an API change forbidden by the guardrail. Since the page already fetches all ≤100 articles in one request, the category filter is applied client-side over the already-fetched list instead." to the Finding column)
- `UX-050` → `Resolved (Story 66) — corrected, plain links; no filter carry-over` (append "**Corrected during Story 66 implementation:** `GaugeChart.tsx` is explicitly documented as reused unchanged by other report pages (`RPT-5`); rather than add link behavior inside the shared SVG chart, a row of plain drill-down links was added below it in `ManagementDashboardPage.tsx` instead. The current `from`/`to` filter is not carried over — none of the 5 report pages sync their date range via a URL param, so doing so would require changes to all 4 destination pages, beyond this fix's scope." to the Finding column)
- `UX-019` → `Deferred — needs a bulk SLA data source on the ticket list endpoint (only a per-ticket detail query exists today, features/tickets/api/useTicketSla.ts); outside DSN-6–DSN-13's frontend-only guardrail`
- `UX-057` → `Deferred — portal exposes no message/conversation-read endpoint (apps/portal/urls.py, apps/portal/views.py); staff MessageViewSet gates list/retrieve behind tickets.view, a staff-only permission; outside DSN-6–DSN-13's frontend-only guardrail`

Add a new summary paragraph after the `Story 65 (DSN-10)` paragraph:

```markdown
**Story 66 (`DSN-11`), IA findings:** 9 resolved (two with a corrected
approach after verification — `UX-037`, `UX-050`), 1 closed as a verified
false positive requiring no code change (`UX-034`), 2 deferred (`UX-019`,
`UX-057`, both needing a new backend data source/endpoint) — of the 12
findings originally catalogued as `IA`. No new finding was discovered
during this story's implementation.
```

The header **Totals** line (`**Totals: 69 findings**...`) stays at 69 — no new row is added this story; only Status values change.

---

## Edge Cases & Failure Modes

- **`NavLink`'s prefix-matching double-highlight** — verified for every current nav link in both `Sidebar.tsx` and `PortalLayout.tsx` (see task 1); only `/tickets`, `/knowledge-base`, `/portal`, and `/portal/tickets` need `end`. Adding a new sibling route under an existing `end`-less link later (e.g. a future `/customers/new` link as its own nav item) would reintroduce this — not a risk today, since no such conflict exists among current routes.
- **`NavSection`'s label hides when `collapsed` is true** — matches every other label in `Sidebar.tsx` (`SidebarLink`'s own `label`, the `t('app.name')` header text), so a collapsed sidebar stays icon-only with no orphaned section text.
- **`ArticleBrowsePage`'s category filter resets to "all" on navigation away and back** — `categoryFilter` is local `useState`, not persisted; consistent with every other filter in this codebase (e.g. `TicketListPage`'s own category filter), not a regression.
- **`ArticleBrowsePage`'s `categories` list is derived only from the current page's ≤100 fetched articles** — if a category has zero articles in the first 100 (already this page's existing pagination ceiling, unrelated to this fix), it won't appear as a filter option; this is strictly no worse than the page's pre-existing 100-article cap.
- **`ManagementDashboardPage`'s drill-down links navigate away from the dashboard, losing the selected `from`/`to`** — an explicit, documented scope correction (see `## Prerequisites`), not an oversight.
- **`PortalTicketDetailPage`'s Description field now spans `sm:col-span-2` inside the same grid** — on narrow viewports (`grid-cols-1`) every field, including Description, already stacked full-width; the `sm:col-span-2` only takes effect at `sm:` and above, where it now visually matches its old full-width appearance instead of being squeezed into one of two columns.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. No backend file is changed by this story — `python manage.py test` (from `backend/`) is unaffected; re-run once to confirm no drift.
2. Frontend static checks: `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (from `frontend/`) must all pass — `npm run build` specifically catches any leftover unused `Link`/`Button` import from task 1's `Link`→`NavLink` swap (`noUnusedLocals: true`).
3. Manual verification only beyond that, per `## Verification Steps` below.

---

## Verification Steps

1. **Frontend builds and lints clean:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
2. **Sidebar active state:** navigate to `/tickets` — its sidebar link (not `/tickets/my-tickets`'s) shows the active style and `aria-current="page"`; navigate to `/tickets/my-tickets` — only that link is active, `/tickets`'s is not. Repeat for `/knowledge-base` vs. `/knowledge-base/articles`.
3. **Portal nav active state:** navigate to `/portal` — only Home is active; navigate to `/portal/tickets` — only My tickets is active (not Home, not History); navigate to `/portal/tickets/history` — only History is active.
4. **Sidebar section labels:** expand the sidebar — "Knowledge base" and "Reports" headings appear above their respective link groups; collapse the sidebar — the headings disappear, only icons remain.
5. **KB/Article manage search:** on `/knowledge-base/manage` and `/knowledge-base/articles/manage`, type a partial question/title into the new search box — the table filters after the debounce; clear it — the full list returns.
6. **Article category filter:** on `/knowledge-base/articles`, pick a category from the new filter — only matching articles show; pick "All categories" — the full list returns.
7. **Role form heading hierarchy:** on `/roles/new`, inspect the DOM — the page `<h1>` is followed by `<h2>` permission-group headings, no `<h3>` skip.
8. **Dashboard drill-down:** on `/reports/dashboard`, click each of the 4 KPI links — each navigates to its corresponding report page (`/reports/tickets`, `/reports/sla`, `/reports/csat`, `/reports/agents`).
9. **Portal feedback back link:** open a resolved/closed portal ticket, click "Rate this ticket," then click the new back link — returns to that same ticket's detail page.
10. **Portal ticket detail markup:** inspect the DOM on `/portal/tickets/:id` — the Description `dt`/`dd` is inside the same `<dl>` as the other fields, not a sibling `<div>` after it.
11. **Portal home quick links:** on `/portal`, confirm "Articles" and "History" links now appear alongside the existing 3, and both navigate correctly.
12. **`UX-AUDIT.md` register:** all 12 `IA` rows show an updated Status (9 `Resolved (Story 66)` variants, `UX-034` false-positive note, `UX-019`/`UX-057` `Deferred`); the new `Story 66 (DSN-11)` summary paragraph is present; the header **Totals** line still reads 69.
13. Repeat steps 2-11 in `ar`/RTL to confirm no layout regression (active-state styling, section labels, and the new links all still read correctly mirrored).

---

## Done Criteria

- [ ] `Sidebar.tsx` — `SidebarLink` uses `NavLink`/`buttonVariants` with active styling; `end` set on `/tickets` and `/knowledge-base`; Knowledge Base and Reports groups wrapped in `NavSection`; `reports:navSection` key added (`en`/`ar`).
- [ ] `PortalLayout.tsx` — every nav item uses `NavLink`/`buttonVariants` with active styling; `end` set on `/portal` and `/portal/tickets`.
- [ ] `FaqListPage.tsx`/`ArticleListPage.tsx` — debounced search `Input` added, wired into `useFaqs`/`useArticles` and the `empty` prop; new locale keys added (`en`/`ar`).
- [ ] `ArticleBrowsePage.tsx` — client-side category filter added; no backend file touched; new locale keys added (`en`/`ar`).
- [ ] `RoleFormPage.tsx` line 198 — `<h3>` changed to `<h2>`.
- [ ] `ManagementDashboardPage.tsx` — 4 drill-down links added below the chart; `GaugeChart.tsx` unchanged.
- [ ] `PortalFeedbackFormPage.tsx` — back link to the ticket detail page added; `tickets.feedback.backToTicket` key added (`en`/`ar`).
- [ ] `PortalTicketDetailPage.tsx` — Description `dt`/`dd` moved inside the `<dl>` with `sm:col-span-2`.
- [ ] `PortalHomePage.tsx` — Articles and History quick links added (no new locale keys — reused existing `nav.*` keys).
- [ ] `design-system/supportos/UX-AUDIT.md` — all 12 `IA` rows' Status updated; new `Story 66 (DSN-11)` summary paragraph added; header **Totals** line confirmed still 69.
- [ ] No backend file changed — `git diff --stat` confirms `frontend/` and `design-system/supportos/UX-AUDIT.md` only (plus this plan's own `00-overview.md` update).
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` (frontend) all exit 0; `python manage.py test` (backend) unaffected.
- [ ] Verified live in the browser per `## Verification Steps` 2-13, in both `en`/LTR and `ar`/RTL.
- [ ] `.squad/plans/design-intelligence-ui-ux-system/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** `DSN-12` and `DSN-13` (`SupportOs backlog.MD:614-630`) remain unplanned — `DSN-12` consumes the `content`/`bilingual` rows (largest remaining category, 24 findings across the two), `DSN-13` is the closing verification pass. `UX-019` and `UX-057` remain deferred pending a decision on whether to open a dedicated non-`DSN` backend story or grant an explicit guardrail exception for each.
