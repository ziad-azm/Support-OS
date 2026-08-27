# Story 25 — Assigned Tickets Workspace (Story: SUPPORTOS-45)

## Prerequisites

- **Story 22 (TKT-3) completed** — the intake names it (`Dependencies: TKT-3`). `Ticket.assigned_agent`, `POST /tickets/<id>/assign/`, `assignable_agents()`, and the `?assigned_to_me=true` filter on `GET /api/tickets/` (`backend/apps/tickets/views.py` lines 97-106) all exist. This story's "focused queue" is that same filter, reused, plus one new sibling filter (`status`) the ticket list has never had.
- **The backlog verified against the real file, not memory.** `SupportOs backlog.MD` lines 406-416 (`EPIC 6 — Agent Workspace`, `STORY (AGENT-1) — Assigned Tickets Workspace`) is the authoritative text read for this plan. An earlier plan (Story 22) referred to a *"`AGENT-4` (Auto-Assignment Rules, lines 471-474)"* — that citation was wrong even at the time: lines 469-474 are `SLA-2` (*"Automatic Assignment"*, `EPIC 7`), and the real `AGENT-4` (line 432) is *"Quick Replies"*, unrelated. This plan does not repeat that error; every backlog citation below was re-verified against the file as it stands today.
- **"Reusing ticket API" (intake, task 1) is read literally: no new endpoint.** The queue is `GET /api/tickets/` with `assigned_to_me=true` plus `status`/`priority` — the exact same list endpoint `TicketListPage` already calls, just with a fixed and a new filter combination. `TicketViewSet` gains one new optional equality filter (`status`); no new `@action`, no new app, no new permission constant.
- **"Status/priority/SLA" (intake, task 1) — the SLA third of that list does not exist yet, and this story does not invent it.** No `SLAPolicy` model, no breach computation, no SLA field on `Ticket` exists anywhere in this codebase — `EPIC 7` (`SLA-1`, lines 462-467) is unbuilt and itself depends on `SLA-0`'s Celery foundation (line 460), also unbuilt. A "filter by SLA" control would have nothing to filter on. This story ships the two filters that have real data (`status`, `priority`) and documents the third as blocked on `EPIC 7`, not silently dropped — see `## Story Goal`, "What this story does... not".
- **The frontend code for this story lives in `frontend/src/features/tickets/`, not a new `frontend/src/features/agent-workspace/` folder — a deliberate placement decision, not an oversight.** The `.squad/plans/agent-workspace/` folder is this plan's own organizational home (squad-kit's per-epic grouping); it does not dictate where the *application* code lives. The queue **is** ticket data, filtered — every type (`Ticket`, `TicketStatus`, `TicketPriority`), every reusable piece (`DataTable`, `useTickets`, `TICKET_STATUSES`) it needs already lives in `features/tickets`. A separate feature folder would force one of two bad outcomes: duplicating all of that (`CONVENTIONS.md` §23's own "two features may independently call the same backend endpoint" exception is for a *narrow, feature-specific shape*, like `tickets`' own minimal `CustomerOption` — not a wholesale re-declaration of `Ticket`), or a deep cross-feature import `no-restricted-imports` forbids outright (§15, `frontend/.oxlintrc.json`). Same-feature placement is the only option that avoids both.
- **No "shared table" component is extracted.** The intake's "using shared table pattern" (task 2) already refers to something that exists: `shared/ui/data-table/DataTable`, the generic primitive `TicketListPage`/`CustomerListPage` both already use. The new queue page defines its own small `columns` array locally, the same way every other list screen in this project does — two ~30-line arrays with light overlap do not meet this project's own bar for extracting an abstraction (`CLAUDE.md`: *"Three similar lines is better than a premature abstraction"*).
- **`TicketListPage` itself is unchanged.** The new `status` filter is added to the backend generically (any caller can use it), but this story wires it into the new queue page only — the general admin list's existing category/priority/"Only my tickets" toggle UI is not touched. Scope stays literal: the intake's two tasks describe a new queue, not an enhancement to the existing list.
- **A `tickets.view`-only user's queue is always empty, by construction — not a bug.** `assignable_agents()` (Story 22, `apps/tickets/assignment.py`) only offers users who hold `tickets.manage`; a `tickets.view`-only account can never be `assigned_agent` on any ticket. The queue route itself stays gated on `tickets.view` (matching `/tickets`), because *reading* your own queue is a viewing concern even though nothing can ever populate it for that role — see `## Edge Cases & Failure Modes`.
- **No new permission constant, no new dependency.** `backend/apps/core/permissions.py` lines 26-32 confirm `TICKETS_VIEW`/`TICKETS_MANAGE` already exist and cover everything this story touches.

---

## Story Goal

1. **Agent queue API**: `TicketViewSet.get_queryset` gains an optional `status` equality filter (validated against `Ticket.Status.values`, `400` on a malformed value, absent means no filter) — the same shape `category`/`priority` already have. Combined with the existing `assigned_to_me`/`priority` filters, `GET /api/tickets/?assigned_to_me=true&status=...&priority=...` is the queue's entire data source.
2. **Agent queue UI**: a new `MyTicketsPage` (route `/tickets/my-tickets`) showing every ticket assigned to the caller via `DataTable`, with status and priority `Select` filters — a focused work list, distinct from and additive to the general `/tickets` admin list.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `status` filter on `TicketViewSet.get_queryset` | "status/priority/SLA" (intake) — the status third, added generically to the reused ticket API. |
| `MyTicketsPage`, `assigned_to_me` fixed `true` | "Agent queue API... reusing ticket API" (intake) — the queue's defining filter, already built (Story 22). |
| Status + priority `Select` filters on the queue | "status/priority/SLA" (intake) — the two thirds with real data. |
| Nav link + route, gated `tickets.view` | "agent work list" (intake) — a real destination, not just an API. |

**Not here, and why:**

- **No SLA filter.** See `## Prerequisites` — `SLAPolicy`/breach data does not exist (`EPIC 7`, unbuilt). Adding this filter is a follow-up once `SLA-1` ships an `SLAPolicy` model with a queryable breach/at-risk state.
- **No changes to `TicketListPage`, `TicketFormPage`, or any existing ticket screen.** This story adds a new page; it does not modify the general list's filters, columns, or the "Only my tickets" toggle Story 22 already shipped there.
- **No new `apps/agent_workspace` Django app, no new `features/agent-workspace/` frontend folder.** See `## Prerequisites` — the API is a filter on the existing `TicketViewSet`; the UI is a new page inside `features/tickets`.
- **No shared/extracted `TicketTable` component.** See `## Prerequisites` — two small, only-lightly-overlapping column arrays do not justify one.
- **No SLA/queue-specific sorting, grouping, or "at risk" visual treatment.** Everything downstream of SLA data is `EPIC 7`'s.
- **No auto-refresh/live updates.** The queue is a `useQuery`-backed list like every other list screen in this project; no story anywhere has added polling or a WebSocket feed for a list view (`TicketChatConsumer`, Story 16, is scoped to one conversation, not a list).

---

## Context — Read These Files First

1. `.squad/stories/agent-workspace/SUPPORTOS-45/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 406-416 (`EPIC 6`, `STORY (AGENT-1)`) — re-verified against the file for this plan; see `## Prerequisites` for the correction to an earlier plan's mis-citation.
3. `backend/apps/tickets/views.py` (245 lines, after Story 24) — `TicketViewSet.get_queryset`'s `category` (lines 83-89) and `priority` (lines 91-95) filters, the exact "absent → no filter, present-but-malformed → 400" pattern task 1's `status` filter copies; `assigned_to_me` (lines 97-106) immediately after, which the new filter is inserted before (grouping the three equality filters, `assigned_to_me`'s user-scoping filter last).
4. `backend/apps/tickets/models.py` — `Ticket.Status` (`TextChoices`, lines 34-38) — `Ticket.Status.values` is what the new filter validates against, the same call `priority`'s own validation already makes against `Ticket.Priority.values`.
5. `frontend/src/features/tickets/api/getTickets.ts` (16 lines, after Story 22) — `TicketListParams`, which task 3 extends with `status?: TicketStatus`.
6. `frontend/src/features/tickets/components/TicketListPage.tsx` (195 lines, after Story 23) — read in full: the `useServerTable`/`useTickets`/`DataTable`/`columns`/filter-`Select` shape task 4's `MyTicketsPage` copies almost verbatim, with `assigned_to_me` fixed instead of toggled and a `status` `Select` added where `TicketListPage` has none.
7. `frontend/src/features/tickets/types/ticket.ts` — `TICKET_STATUSES`/`TicketStatus` (lines 1-3) and `TICKET_PRIORITIES`/`TicketPriority` (lines 5-6), both reused directly (same feature, no duplication needed — contrast `features/customers/types/timelineEntry.ts`'s duplication of these same unions, forced there only because `customers` cannot import from `tickets`).
8. `frontend/src/shared/ui/data-table/DataTable.tsx`, `useServerTable.ts`, `types.ts` — the generic table primitive this story's "shared table pattern" (intake) refers to; no changes needed here.
9. `frontend/src/app/router.tsx` (132 lines) — the `tickets.view`-gated route group (lines 84-120), `tickets/new`'s comment (lines 95-96) explaining why it is declared before `tickets/:id` — task 5's `tickets/my-tickets` route follows the identical placement.
10. `frontend/src/app/RootLayout.tsx` (51 lines) — the nav `<Can permission="tickets.view">` block (lines 26-30) task 6 adds a second link inside, right after the existing `/tickets` link.
11. `frontend/src/features/tickets/locales/en.json`/`ar.json` (107 lines each, after Story 24) — the `filters` block (`category`, `priority`, `allCategories`, `allPriorities`, `onlyMine`) task 7 extends with `status`/`allStatuses`, and the new `myQueue` block it adds, reusing the existing `title` key's dual role (nav label *and* page heading) that `tickets:title`/`customers:title` already establish in `RootLayout`.
12. `CONVENTIONS.md` §15 (import conventions — `no-restricted-imports`, the reason this story places its UI inside `features/tickets`), §19 (design system/data tables — the equality-filter/`DataTable` pattern), §23 (feature module conventions).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Filtered "my tickets" by status/priority/SLA, reusing the ticket API.** | Intake, task 1 | New `status` filter on `TicketViewSet.get_queryset`; `assigned_to_me`/`priority` already exist. SLA excluded — see `## Prerequisites`. |
| **Queue UI using the shared table pattern, with filters.** | Intake, task 2 | `MyTicketsPage` — `DataTable` + status/priority `Select`s. |
| **An optional equality filter is validated when present, never required.** | §23 (Story 18's rule, reused) | `status` follows `category`/`priority`'s exact contract: absent → no filter, malformed → `400`. |
| **The queue is always scoped to the caller, never a client-supplied user.** | Story 22's own rule, reused unchanged | `assigned_to_me=true` is hardcoded by `MyTicketsPage`, not exposed as a toggle. |
| **A feature never imports another feature's internals.** | §15 | The queue's UI lives inside `features/tickets`, not a separate feature that would need to reach back into it. |
| Wire format is `snake_case` end to end; the UI translates, the API sends values. | §12 | `status`. |
| No new permission constant, no new dependency. | §17, §22 | Reuses `TICKETS_VIEW`. |

---

## Backend Tasks

### 1 — The `status` filter

**File: `backend/apps/tickets/views.py`** — extend `TicketViewSet.get_queryset`, inserting a new block directly after the existing `priority` filter (line 95) and before `assigned_to_me` (line 97):

```python
        status = self.request.query_params.get("status")
        if status:
            if status not in Ticket.Status.values:
                raise ValidationError({"status": [_("Must be a valid status.")]})
            queryset = queryset.filter(status=status)

```

No import changes needed — `ValidationError`, `_`, and `Ticket` are already imported (used by the `category`/`priority` blocks directly above).

**No `permission_map` change** — `status` is a query parameter on the existing `list` action, not a new `@action`; `list` is already gated `TICKETS_VIEW`.

**No migration** — no model or field change, only a queryset filter.

---

## Frontend Tasks

### 2 — No backend serializer/model changes

Confirm while implementing: `TicketSerializer`, `Ticket`, and `apps/tickets/urls.py` are all **unchanged** by this story. The new filter is entirely inside `get_queryset`.

---

### 3 — Extend `TicketListParams`

**File: `frontend/src/features/tickets/api/getTickets.ts`** — add `status`, and import `TicketStatus` alongside the existing `TicketPriority` import:

```ts
import type { Ticket, TicketPriority, TicketStatus } from '../types/ticket'

export type TicketListParams = ServerTableParams & {
  search?: string
  category?: string
  status?: TicketStatus
  priority?: TicketPriority
  assigned_to_me?: 'true'
}
```

---

### 4 — The queue page

**Create file: `frontend/src/features/tickets/components/MyTicketsPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'

import { useTickets } from '../api/useTickets'
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../types/ticket'
import type { Ticket, TicketPriority, TicketStatus } from '../types/ticket'

/**
 * AGENT-1 — the agent's personal queue: every ticket assigned to the
 * caller, filterable by status/priority. `assigned_to_me` is fixed `true`
 * here, not a toggle (contrast `TicketListPage`'s own toggle on the
 * general list). "SLA" from the intake is deliberately absent — no
 * `SLAPolicy`/breach data exists yet. See Story 25 `## Prerequisites`.
 *
 * Lives in `features/tickets`, not a new `features/agent-workspace/`
 * folder: the queue IS ticket data, just filtered, and a separate feature
 * would either duplicate `Ticket`/`TICKET_STATUSES`/`DataTable` or violate
 * `no-restricted-imports` (CONVENTIONS.md §15) reaching back for them.
 */
export function MyTicketsPage() {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  // "all" is the sentinel for "no filter" — same as `TicketListPage`'s
  // category/priority `Select`s (CONVENTIONS.md §19).
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  useEffect(() => {
    setPage(1)
  }, [statusFilter, priorityFilter, setPage])

  const query = useTickets({
    ...params,
    assigned_to_me: 'true',
    ...(statusFilter !== 'all' ? { status: statusFilter as TicketStatus } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter as TicketPriority } : {}),
  })

  const columns: readonly ColumnDef<Ticket>[] = [
    {
      id: 'subject',
      header: t('fields.subject'),
      sortable: true,
      cell: (row) => <Link to={`/tickets/${row.id}`}>{row.subject}</Link>,
    },
    {
      id: 'customer_name',
      header: t('fields.customer'),
      cell: (row) => row.customer_name,
    },
    {
      id: 'category_name',
      header: t('fields.category'),
      cell: (row) => row.category_name ?? t('fields.noCategory'),
    },
    {
      id: 'status',
      header: t('fields.status'),
      sortable: true,
      cell: (row) => <Badge variant="secondary">{t(`statuses.${row.status}`)}</Badge>,
    },
    {
      id: 'priority',
      header: t('fields.priority'),
      sortable: true,
      cell: (row) => <Badge variant="secondary">{t(`priorities.${row.priority}`)}</Badge>,
    },
    {
      id: 'created_at',
      header: t('fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('myQueue.title')}</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label={t('filters.status')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
            {TICKET_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`statuses.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger aria-label={t('filters.priority')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allPriorities')}</SelectItem>
            {TICKET_PRIORITIES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`priorities.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('myQueue.title')}
        empty={<Empty title={t('myQueue.empty')} description={t('myQueue.emptyDescription')} />}
      />
    </div>
  )
}
```

---

### 5 — Route

**File: `frontend/src/app/router.tsx`** — add a new lazy route inside the existing `tickets.view`-gated children array (line 85), directly after `tickets/new` (lines 95-102) and before `tickets/:id`:

```tsx
              {
                // Must stay before `tickets/:id`, same reason as `tickets/new`.
                path: 'tickets/my-tickets',
                lazy: async () => {
                  const { MyTicketsPage } =
                    await import('@/features/tickets/components/MyTicketsPage')
                  return { element: <MyTicketsPage /> }
                },
              },
```

---

### 6 — Nav link

**File: `frontend/src/app/RootLayout.tsx`** — add a second link inside the existing `<Can permission="tickets.view">` block (lines 26-30), directly after the `/tickets` link:

```tsx
            <Can permission="tickets.view">
              <Button asChild variant="ghost" size="sm">
                <Link to="/tickets">{t('tickets:title')}</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/tickets/my-tickets">{t('tickets:myQueue.title')}</Link>
              </Button>
            </Can>
```

---

### 7 — Locale keys

**File: `frontend/src/features/tickets/locales/en.json`** — two keys in the existing `filters` block, one new top-level `myQueue` block:

```json
  "filters": {
    "category": "Filter by category",
    "status": "Filter by status",
    "priority": "Filter by priority",
    "allCategories": "All categories",
    "allStatuses": "All statuses",
    "allPriorities": "All priorities",
    "onlyMine": "Only my tickets"
  },
```

```json
  "myQueue": {
    "title": "My Tickets",
    "empty": "No tickets assigned to you",
    "emptyDescription": "Tickets assigned to you will appear here."
  },
```

(Placed as a new top-level key, e.g. directly after the `assign` block — position among siblings does not matter for i18next, only that the key set matches `ar.json`.)

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
  "filters": {
    "category": "تصفية حسب الفئة",
    "status": "تصفية حسب الحالة",
    "priority": "تصفية حسب الأولوية",
    "allCategories": "كل الفئات",
    "allStatuses": "كل الحالات",
    "allPriorities": "كل الأولويات",
    "onlyMine": "تذاكري فقط"
  },
```

```json
  "myQueue": {
    "title": "تذاكري",
    "empty": "لا توجد تذاكر معيّنة لك",
    "emptyDescription": "ستظهر هنا التذاكر المعيّنة لك."
  },
```

No `resources.ts` change — `tickets` is already a registered namespace.

---

## Documentation Tasks

### 8 — Conventions

**File: `.squad/plans/agent-workspace/00-overview.md`** — this task's own row (task 9 below) already documents the reasoning; no `CONVENTIONS.md` change is needed for this story. It reuses three already-documented patterns (§18/19's equality-filter contract, §15's feature-boundary import rule, and the existing `DataTable`/`useServerTable` primitives) without adding a new one. If a future story needs a genuinely new convention (e.g. once `AGENT-2`'s side panel or `SLA-1`'s breach data arrives), record it there instead.

### 9 — Overview

**File: `.squad/plans/agent-workspace/00-overview.md`** — replace the placeholder `_add rows as stories are planned_` row and `_Describe sequencing..._` line with this story's entry and a dependency-notes paragraph summarizing the placement decision from `## Prerequisites` (frontend code lives in `features/tickets`, not a new feature folder; SLA filtering deferred to `EPIC 7`).

---

## Edge Cases & Failure Modes

- **`?status=` with an unrecognised value (e.g. `"archived"`) is a `400`** naming `status`, checked against `Ticket.Status.values` — the same contract `category`/`priority` already have.
- **`?status=` absent means no filter** — existing callers (`TicketListPage`, any other consumer of `getTickets`) are unaffected; this is purely additive.
- **`status`, `priority`, and `assigned_to_me` combine as AND, not OR** — e.g. `?assigned_to_me=true&status=open&priority=urgent` returns only tickets that are simultaneously the caller's, open, AND urgent. Each filter narrows the same queryset sequentially, the same composition `category`+`priority` already had.
- **A `tickets.view`-only user's queue is always empty**, not an error — see `## Prerequisites`. The page still renders the normal `myQueue.empty` state, not a permission error, because the route itself only requires `tickets.view` and the request legitimately succeeds with zero rows.
- **An agent with zero assigned tickets and no filters applied** sees `myQueue.empty`/`myQueue.emptyDescription` — distinct copy from `TicketListPage`'s own `empty`/`emptyDescription`, so the two screens' empty states never look identical or interchangeable.
- **Switching the status or priority filter resets to page 1** — the same "a filter narrows the result set the same way a search does" reasoning `TicketListPage`'s own page-reset effect documents (Story 18).
- **Reassigning a ticket away from the caller (via `TicketDetailPage`'s assignee control) removes it from the queue on next fetch**, and reassigning a ticket TO the caller adds it — no special wiring needed here: `useTickets`' query key includes `assigned_to_me: 'true'`, and `useAssignTicket`'s existing prefix-wide `ticketKeys.all` invalidation (Story 22) already refreshes every ticket list query, including this one.
- **Arabic status/priority labels round-trip correctly** — the queue reuses the exact same `statuses.<value>`/`priorities.<value>` i18n keys already verified bilingual since Story 12/18.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** (no model change in this story).
3. `ruff format --check .` / `ruff check .` over the changed Python.
4. Real HTTP: the `status` filter valid/malformed/absent, combined with `assigned_to_me`/`priority`, and confirmation that omitting `status` leaves existing list behaviour unchanged — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new page and route.
6. An `en`/`ar` key-set comparison for `features/tickets/locales/` (a throwaway script, not a checked-in test).

---

## Migration / Rollback

**No migration** — this story changes no model or field, only a queryset filter and frontend code.

**Rollback of the code:** revert the commits. No database state to unwind.

**Half-applied states to avoid:**

- **`status` filter validating against `Ticket.Priority.values` instead of `Ticket.Status.values`** (an easy copy-paste error, sitting directly between the two blocks) — would accept a priority string as a "valid" status or reject every real status.
- **`MyTicketsPage` exposing `assigned_to_me` as a togglable `Select`/`Switch` instead of a hardcoded `'true'`** — would turn the queue into a second, redundant copy of `TicketListPage` rather than the focused personal work list the intake asks for.
- **The new route placed AFTER `tickets/:id`** in `router.tsx` — matches the exact ordering hazard `tickets/new`'s own comment already warns about.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **No migration generated:** `python manage.py makemigrations tickets` reports **no changes**; project-wide `makemigrations --check --dry-run` exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **The `status` filter works standalone.** Create a customer and two tickets (default status `open`), transition one to `in_progress` (`POST .../status/`, reusing Story 23's action). With a `tickets.manage` token: `GET /api/tickets/?status=in_progress` → only the transitioned ticket. `GET /api/tickets/?status=open` → only the untransitioned one. `GET /api/tickets/?status=not_a_status` → `400` naming `status`. `GET /api/tickets/` (no `status`) → both, unaffected by this story.
5. **The three filters compose as AND.** Assign one of the two tickets to the caller and set its priority to `urgent`. `GET /api/tickets/?assigned_to_me=true&status=in_progress&priority=urgent` → exactly the one ticket matching all three. Drop any one filter → the result set widens accordingly (verify at least one case, e.g. dropping `priority` still requires `assigned_to_me`+`status` to both match).
6. **Existing behaviour is unaffected.** `GET /api/tickets/?category=<id>` and `GET /api/tickets/?priority=<value>` (Story 18) and `GET /api/tickets/?assigned_to_me=true` (Story 22) all still behave exactly as before — no regression from the new filter's insertion point.
7. **The full bilingual UI walkthrough.** `npm run dev` with the backend up:
   - Sign in as an agent with `tickets.manage`, with at least one ticket assigned. Click the new "My Tickets" nav link → lands on `/tickets/my-tickets`, showing only that agent's tickets.
   - Apply the status filter, then the priority filter, then both together — the list narrows correctly each time, and the page resets to 1.
   - Sign in as a user with `tickets.view` but **not** `tickets.manage` (reuse a throwaway role) — the "My Tickets" nav link is still visible (gated `tickets.view`), the page loads, and shows the empty state (this role can never be assigned a ticket — see `## Prerequisites`).
   - Switch to Arabic on both the nav link and the queue page — every label, filter, and the empty state translate, and the layout reads correctly in RTL.
   - Confirm `/tickets` (the general list) is unchanged — no status filter, no visual difference from before this story.
8. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
9. **Clean up** every ticket and customer created for steps 4-6, plus any throwaway role/user reused from a prior story's verification.

---

## Done Criteria

- [ ] `TicketViewSet.get_queryset` gains an optional `status` filter: absent → no filter, invalid → `400` naming `status`, valid → exact match. Inserted between the existing `priority` and `assigned_to_me` blocks.
- [ ] **No migration, no new permission constant, no new `@action`, no `apps/tickets/urls.py` change.**
- [ ] `TicketListParams` (`getTickets.ts`) gains `status?: TicketStatus`.
- [ ] `MyTicketsPage.tsx` — `assigned_to_me` hardcoded `'true'`; status + priority `Select` filters; reuses `DataTable`/`useServerTable`/`useTickets` exactly as `TicketListPage` does; own `myQueue.empty`/`emptyDescription` empty state.
- [ ] `router.tsx` — `tickets/my-tickets` route added inside the `tickets.view`-gated group, before `tickets/:id`.
- [ ] `RootLayout.tsx` — a second nav link to `/tickets/my-tickets`, inside the existing `<Can permission="tickets.view">` block.
- [ ] `en.json`/`ar.json` — `filters.status`/`filters.allStatuses`, and the new `myQueue` block; identical key sets in both languages; **no `resources.ts` change**.
- [ ] **`TicketListPage.tsx` is unmodified.**
- [ ] **No new `apps/agent_workspace` Django app; no new `frontend/src/features/agent-workspace/` folder** — all application code lives in the existing `apps/tickets`/`features/tickets`.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: the `status` filter standalone (Step 4); all three filters composing as AND (Step 5); no regression to `category`/`priority`/`assigned_to_me` (Step 6).
- [ ] Both languages walk through cleanly in the browser, including the `tickets.view`-only always-empty case (Step 7).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any reused throwaway role/user created during verification is cleaned up (Step 9).
- [ ] `.squad/plans/agent-workspace/00-overview.md` updated with this story's row and dependency notes (task 9).

**STOP HERE. Report to the user and wait for confirmation.** The remaining `agent-workspace` stories are **AGENT-2 (Customer Context Panel)**, **AGENT-3 (Tasks & Reminders, blocked on `SLA-4` notifications)**, **AGENT-4 (Quick Replies)**, and **AGENT-5 (Team Collaboration, depends on this feature's `TKT-5` history pattern and `SLA-4`)** — `SupportOs backlog.MD` lines 418-444.
