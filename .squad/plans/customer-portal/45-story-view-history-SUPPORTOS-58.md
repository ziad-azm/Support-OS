# Story 45 — View History (Story: SUPPORTOS-58)

## Prerequisites

- **PORTAL-2 complete:** [44-story-track-requests-SUPPORTOS-57.md](44-story-track-requests-SUPPORTOS-57.md). Verified landed on disk today: `PortalTicketViewSet` routes `list`/`retrieve`/`create`, `get_queryset` already validates and applies an optional `?status=` filter against `Ticket.Status.values` (`apps/portal/views.py`, mirroring `TicketViewSet.get_queryset`'s own status branch), and the frontend has `usePortalTickets`/`PortalTicketListPage` built on `DataTable`/`useServerTable`. Verified today by direct query that this filter already accepts `status=closed` and returns exactly the caller's own closed tickets — **the endpoint this story needs already exists and needs no change.**
- **`SupportOs backlog.MD` line 578–582** — `### STORY (PORTAL-3) — View History`, dependency `PORTAL-2` only (line 580). One task: *"Historical tickets view — Extend scoped list with closed tickets. Outcome: past-request history."* (line 582).
- **The scope-defining finding, read before task 1:** PORTAL-2's `PortalTicketListPage` **already shows every one of the customer's tickets regardless of status** (verified: no default status filter is applied; the status `Select` defaults to the `"all"` sentinel) — this was a deliberate, already-verified design decision recorded in `.squad/plans/customer-portal/00-overview.md`'s story-44 findings, not an oversight this story corrects. A customer can already see their closed tickets today by picking "Closed" from that list's status filter. This story therefore does **not** restrict `PortalTicketListPage` to "active only" and does **not** touch its default behavior — it adds a second, complementary, purpose-built archive view. See `## Story Goal` for why "extend... with", not "split into active/history", is the reading this plan follows.
- Verified frontend baseline: `frontend/src/features/portal/components/` has no `PortalTicketHistoryPage.tsx`; `frontend/src/app/router.tsx`'s portal tree (257–315, post-PORTAL-2) has no `tickets/history` route; `PortalLayout.tsx` (60 lines, post-PORTAL-2) has no "History" nav link.
- Verified: `apps/tickets/models.py`'s `Ticket.Status` has exactly four values (`open`, `in_progress`, `resolved`, `closed`); `TICKET_STATUS_TRANSITIONS` (mirrored on the frontend, `features/tickets/types/ticket.ts:15-20`) shows `closed: []` — no transition leaves `closed`, the one truly terminal state. This is why "past-request history" is scoped to `status=closed` exactly, not `resolved` too (a `resolved` ticket can still be reopened to `in_progress` or moved to `closed` — it is not yet history).
- Verified: `Ticket` has no dedicated "closed at" timestamp field — only `created_at`/`updated_at` (from `TimeStampedModel`) and `escalated_at`. `updated_at` bumps on **any** save (e.g. a later `escalate` toggle on an already-closed ticket, verified via `apps/tickets/views.py`'s `escalate` action, which saves the `Ticket` independently of `status`), so it is a general "last modified" timestamp, not a precise "closed on" one. See `## Story Goal` for how this shapes the column label.

---

## Story Goal

Give a customer a dedicated, purpose-built view of their finished tickets — reusing PORTAL-2's already-built, already-verified scoped API and status filter, with **no backend change**.

1. **A new `PortalTicketHistoryPage`** at `/portal/tickets/history`, built from the exact same `DataTable`/`useServerTable`/`usePortalTickets` PORTAL-2 already built, fixed to `status: 'closed'` — no status picker, because the whole page *is* the closed-only view.
2. **Nav and cross-links, not a restructure.** `PortalLayout` gains a "History" link; `PortalTicketListPage` gains a link to it and vice versa. PORTAL-2's list, its default sort, its status filter, and its columns are all **unchanged**.
3. **An honest column label.** The extra column this page needs beyond `PortalTicketListPage`'s own set is `updated_at`, labelled "Last updated" (`tickets.fields.updatedAt`) — not "Closed on". `Ticket` has no dedicated closed-at field, and `updated_at` can move for reasons unrelated to closing (see the verified `escalate`-after-close case above); claiming precision the data does not have is not this story's job to invent.

### Why this story needs zero backend changes

PORTAL-2's `PortalTicketViewSet.get_queryset` (task 1 of that story) already validates `request.query_params.get("status")` against `Ticket.Status.values` and filters on it — `closed` is one of those four values, already accepted today. **Verified directly**, not assumed: a live request to `GET /api/portal/tickets/?status=closed` against the running dev server returns only the caller's own closed tickets, correctly scoped by the same `CustomerScopedModelViewSet.get_queryset()` PORTAL-0 built. This story's entire backend "task" is confirming that fact (`## Backend Verification` below) — there is no backend `## Backend Tasks` section, because there is nothing to change.

### Explicitly out of scope

- **Restricting `PortalTicketListPage` to active-only tickets by default.** Not asked for by the intake's own "extend... with" phrasing, and would silently change already-verified PORTAL-2 behavior with no story asking for it. See `## Prerequisites`.
- **Including `resolved` tickets in the history view.** `resolved` is not terminal (`TICKET_STATUS_TRANSITIONS.resolved` allows a move back to `in_progress` or on to `closed`) — a resolved-but-not-yet-closed ticket is still live, not history.
- **A dedicated `closed_at` model field.** `Ticket` has no such column; adding one is a real schema decision with its own migration and backfill question (what value would every already-closed ticket in the database get?) that no story has asked for. `updated_at`, honestly labelled, is what this story uses instead.
- **Search or additional filters on the history page.** Same reasoning `PortalTicketListPage` (PORTAL-2) already used to defer search — a customer's own closed-ticket history is a small, personal list.
- **Automated tests.** Standing policy, `CONVENTIONS.md` §16. See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/customer-portal/SUPPORTOS-58/intake.md` — one task block (*"Historical tickets view — Extend scoped list with closed tickets"*), **no attachments, no acceptance criteria**. Done Criteria derive from the one **Outcome** line: *"past-request history."*
2. `SupportOs backlog.MD` lines 572–582 — `PORTAL-2` and `PORTAL-3` back to back — confirms `PORTAL-2`'s list is the "live status tracking" view this story does not modify, and `PORTAL-3` is the separate "historical" one.
3. `backend/apps/portal/views.py` — `PortalTicketViewSet.get_queryset`'s `status` branch (the exact validation this story's frontend request relies on, unchanged) and `ordering_fields = ("subject", "status", "priority", "created_at")` — **no `updated_at`**, which is why task 2's new column is deliberately not marked `sortable`.
4. `backend/apps/tickets/models.py` — `Ticket.Status` (34–38) and the `TimeStampedModel` base (`apps/core/models.py`) — confirms `updated_at`'s `auto_now` semantics (bumps on every save, not just a status change).
5. `frontend/src/features/portal/components/PortalTicketListPage.tsx` (from PORTAL-2, ~115 lines) — the component task 1's `PortalTicketHistoryPage` copies the shape of: `useServerTable`, `usePortalTickets`, the `ColumnDef` array, `DataTable` wiring. Task 3 also adds one link from this file to the new history page.
6. `frontend/src/features/portal/api/{usePortalTickets.ts,getPortalTickets.ts}` (from PORTAL-2) — reused **unchanged**; task 1 calls `usePortalTickets({ ...params, status: 'closed' })`, no new API file.
7. `frontend/src/features/portal/types/portalTicket.ts` (from PORTAL-2) — `PortalTicket`/`PORTAL_TICKET_STATUSES` reused unchanged; no new type needed.
8. `frontend/src/app/router.tsx` — the `path: 'portal'` tree (257–315, post-PORTAL-2). Task 4 adds one sibling route, **declared before `tickets/:id`** (301–308) — the same static-before-dynamic ordering rule already followed for `tickets/new` (290–300, itself commented with this exact reasoning).
9. `frontend/src/features/portal/components/PortalLayout.tsx` (60 lines, post-PORTAL-2) — task 5 adds one nav link, between the existing "My tickets" and "New ticket" links (34–38).
10. `frontend/src/features/portal/locales/en.json` (56 lines, post-PORTAL-2) — task 6 adds `nav.history`, `tickets.fields.updatedAt`, `tickets.history.*`, and one cross-link key each on the list and history pages.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Extend the scoped list with closed tickets.** | Intake | `PortalTicketHistoryPage` calls the exact same `usePortalTickets`/`getPortalTickets`/`PortalTicketViewSet` PORTAL-2 built, with `status: 'closed'` fixed rather than user-selectable — no new endpoint, no new permission. |
| **Past-request history.** | Intake | A dedicated route/page/nav entry distinct from PORTAL-2's general list, so "what did I already resolve with support" is a one-click destination, not a manual filter selection every visit. |
| **Reuse shared table/states.** | Established by PORTAL-2, continued here | `DataTable`/`useServerTable`/`Empty` again — no bespoke table for the history view. |
| **A feature must not import from another feature.** | `frontend/.oxlintrc.json` §15 | `PortalTicketHistoryPage` imports only from `features/portal/` and `shared/` — same boundary every prior portal story already works within. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable, no new dependency, and (per `## Story Goal`) no backend change at all. |

---

## Backend Verification (no backend tasks — confirm, do not change)

**Run this before writing any frontend code**, to re-confirm the finding `## Prerequisites` already verified once, against the database state at implementation time:

```powershell
cd backend
python manage.py shell -c "
from apps.tickets.models import Ticket
print(list(Ticket.objects.filter(status='closed').values_list('id', 'customer__name')))
"
```

If no closed ticket exists yet in the dev database, create one so the frontend has something to render:

```powershell
python manage.py shell -c "
from apps.tickets.models import Ticket
t = Ticket.objects.filter(customer__name='Customer One').first()
t.status = Ticket.Status.CLOSED
t.save(update_fields=['status', 'updated_at'])
print(t.id, t.status)
"
```

Then, with the dev server running and a customer token for that same customer:

```powershell
$t = (curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/ -H "Content-Type: application/json" -d '{\"email\":\"cust1@example.com\",\"password\":\"Sup3rSecret!\"}' | ConvertFrom-Json).data.access
curl.exe -s "http://127.0.0.1:8000/api/portal/tickets/?status=closed" -H "Authorization: Bearer $t"
```

Expect `200` with exactly the closed ticket(s) belonging to that customer — confirming, live, that no `apps/portal/` change is needed before task 1 begins.

---

## Frontend Tasks

### 1 — `PortalTicketHistoryPage`

**Create file: `frontend/src/features/portal/components/PortalTicketHistoryPage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'

import { usePortalTickets } from '../api/usePortalTickets'
import type { PortalTicket } from '../types/portalTicket'

/**
 * The customer's own closed-ticket archive — PORTAL-3. Reuses PORTAL-2's
 * `usePortalTickets`/`DataTable` unchanged; the only difference from
 * `PortalTicketListPage` is a fixed `status: 'closed'` (no picker — the
 * whole page IS the closed-only view) and one extra column.
 *
 * `updated_at` is labelled "Last updated", not "Closed on" — `Ticket` has
 * no dedicated closed-at field, and `updated_at` can move for reasons
 * unrelated to closing (e.g. a later escalation toggle). Not sortable:
 * `updated_at` is absent from `PortalTicketViewSet.ordering_fields`
 * (apps/portal/views.py) — OrderingFilter silently drops a field it does
 * not recognise (CONVENTIONS.md §23), so marking this sortable would be a
 * header that toggles and changes nothing.
 */
export function PortalTicketHistoryPage() {
  const { t } = useTranslation('portal')
  const { date } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  const query = usePortalTickets({ ...params, status: 'closed' })

  const columns: readonly ColumnDef<PortalTicket>[] = [
    {
      id: 'subject',
      header: t('tickets.fields.subject'),
      sortable: true,
      cell: (row) => <Link to={`/portal/tickets/${row.id}`}>{row.subject}</Link>,
    },
    {
      id: 'category_name',
      header: t('tickets.fields.category'),
      cell: (row) => row.category_name ?? t('tickets.fields.noCategory'),
    },
    {
      id: 'assigned_agent_name',
      header: t('tickets.fields.assignedAgent'),
      cell: (row) => row.assigned_agent_name ?? t('tickets.fields.unassigned'),
    },
    {
      id: 'priority',
      header: t('tickets.fields.priority'),
      sortable: true,
      cell: (row) => <Badge variant="secondary">{t(`tickets.priorities.${row.priority}`)}</Badge>,
    },
    {
      id: 'created_at',
      header: t('tickets.fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
    {
      id: 'updated_at',
      header: t('tickets.fields.updatedAt'),
      cell: (row) => date(row.updated_at),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('tickets.history.title')}</h1>
        <Link to="/portal/tickets" className="text-sm text-muted-foreground hover:underline">
          {t('tickets.history.viewActive')}
        </Link>
      </div>
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('tickets.history.title')}
        empty={
          <Empty
            title={t('tickets.history.empty')}
            description={t('tickets.history.emptyDescription')}
          />
        }
      />
    </div>
  )
}
```

No `status` column — every row is closed by construction; showing a column whose value never varies is the same reasoning `PortalTicketListPage` already applies to `customer_name` (PORTAL-2).

---

### 2 — Cross-link from the general list

**File: `frontend/src/features/portal/components/PortalTicketListPage.tsx`** — add one link, directly after the existing title/"new ticket" row:

```tsx
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('tickets.list.title')}</h1>
        <Button asChild>
          <Link to="/portal/tickets/new">{t('tickets.new')}</Link>
        </Button>
      </div>
      <Link to="/portal/tickets/history" className="text-sm text-muted-foreground hover:underline">
        {t('tickets.list.viewHistory')}
      </Link>
```

Placed above the existing status `Select`, so it reads as page-level navigation, not a filter control.

---

### 3 — Wire `/portal/tickets/history`

**File: `frontend/src/app/router.tsx`** — add one sibling entry, **before** the existing `tickets/:id` entry (301–308) — placed here, directly after the existing `tickets` (list) entry and before `tickets/new`, though its exact position relative to `tickets`/`tickets/new` does not matter, only that it precedes `tickets/:id`:

```tsx
              {
                path: 'tickets',
                lazy: async () => {
                  const { PortalTicketListPage } =
                    await import('@/features/portal/components/PortalTicketListPage')
                  return { element: <PortalTicketListPage /> }
                },
              },
              {
                // Must stay before `tickets/:id`, same reason `tickets/new`
                // already does — a literal "history"/"new" segment would
                // otherwise match the `:id` param first.
                path: 'tickets/history',
                lazy: async () => {
                  const { PortalTicketHistoryPage } =
                    await import('@/features/portal/components/PortalTicketHistoryPage')
                  return { element: <PortalTicketHistoryPage /> }
                },
              },
              {
                path: 'tickets/new',
                lazy: async () => {
                  const { PortalTicketFormPage } =
                    await import('@/features/portal/components/PortalTicketFormPage')
                  return { element: <PortalTicketFormPage /> }
                },
              },
              {
                path: 'tickets/:id',
                lazy: async () => {
                  const { PortalTicketDetailPage } =
                    await import('@/features/portal/components/PortalTicketDetailPage')
                  return { element: <PortalTicketDetailPage /> }
                },
              },
```

Full path: `/portal/tickets/history`.

---

### 4 — Nav link

**File: `frontend/src/features/portal/components/PortalLayout.tsx`** — add one nav link, between the existing "My tickets" and "New ticket" links (34–38):

```tsx
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/tickets">{t('nav.myTickets')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/tickets/history">{t('nav.history')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/tickets/new">{t('nav.newTicket')}</Link>
            </Button>
```

---

### 5 — Locale keys

**File: `frontend/src/features/portal/locales/en.json`** — add `nav.history`, `tickets.fields.updatedAt`, one new key on `tickets.list`, and a new `tickets.history` block:

```json
{
  "shell": {
    "title": "Customer Portal"
  },
  "home": {
    "title": "Welcome",
    "intro": "Need help? Submit a new ticket and our team will get back to you."
  },
  "nav": {
    "home": "Home",
    "myTickets": "My tickets",
    "history": "History",
    "newTicket": "New ticket"
  },
  "tickets": {
    "new": "Submit a ticket",
    "fields": {
      "subject": "Subject",
      "description": "Description",
      "category": "Category",
      "noCategory": "Uncategorized",
      "assignedAgent": "Assigned to",
      "unassigned": "Unassigned",
      "status": "Status",
      "priority": "Priority",
      "createdAt": "Submitted",
      "updatedAt": "Last updated"
    },
    "actions": {
      "submit": "Submit"
    },
    "created": "Your ticket has been submitted.",
    "statuses": {
      "open": "Open",
      "in_progress": "In progress",
      "resolved": "Resolved",
      "closed": "Closed"
    },
    "priorities": {
      "low": "Low",
      "medium": "Medium",
      "high": "High",
      "urgent": "Urgent"
    },
    "list": {
      "title": "My tickets",
      "empty": "No tickets yet",
      "emptyDescription": "Submit your first ticket and it will show up here.",
      "viewHistory": "View closed-ticket history"
    },
    "filters": {
      "status": "Status",
      "allStatuses": "All statuses"
    },
    "detail": {
      "backToList": "Back to my tickets"
    },
    "history": {
      "title": "Ticket history",
      "viewActive": "View my tickets",
      "empty": "No closed tickets yet",
      "emptyDescription": "Tickets you have resolved with our team will appear here."
    }
  }
}
```

**File: `frontend/src/features/portal/locales/ar.json`** — the same key structure, translated. Every key present in `en` must exist in `ar` (`CONVENTIONS.md` §18) — a missing key falls back silently to English.

---

## Edge Cases & Failure Modes

- **`updated_at` sorting is intentionally absent.** `PortalTicketViewSet.ordering_fields` (`apps/portal/views.py`, unchanged by this story) has no `updated_at` entry — `OrderingFilter` silently drops a field it does not recognise (`CONVENTIONS.md` §23), so the "Last updated" column has no `sortable: true`. Do not add it without also adding `"updated_at"` to `ordering_fields` in the same change.
- **A ticket's `updated_at` can postdate its actual closing.** Verified: `apply_escalation`/`escalate` (`apps/tickets/views.py`) saves the `Ticket` independently of `status`, so a closed ticket that is later escalated or de-escalated bumps `updated_at` with no status change at all. The column is labelled "Last updated" specifically so this is never a misrepresentation — it never claims to be "the date this closed."
- **A customer with zero closed tickets sees `Empty`, not an empty-looking table.** Same `DataTable` `query.isSuccess && query.data.items.length === 0` branch (`DataTable.tsx:144-150`) PORTAL-2's list already relies on — `PortalTicketHistoryPage` passes its own `empty` prop with history-specific copy.
- **A ticket that is later reopened (`closed` → some other status via staff action) disappears from this page on next load, not retroactively from an already-rendered page.** Correct — this view reflects live server state on every fetch, the same behaviour PORTAL-2's own status filter already has; there is no cached "once closed, always shown here" snapshot.
- **The history page and the general list can show overlapping or even identical rows if a customer has only closed tickets.** Expected — `PortalTicketListPage` shows everything regardless of status (an unchanged PORTAL-2 decision), and this page is a subset of that same data, not a partition. Both being correct simultaneously is not a bug.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `npm run build` — typechecks `PortalTicketHistoryPage` and the new router entry.
2. `npm run lint`, `npm run format:check`, `npm run check:rtl` — unchanged gates over the new files; lint is also what proves `features/portal/` still imports nothing from `features/tickets/`.
3. Real HTTP check confirming the reused `status=closed` filter still behaves correctly at implementation time — `## Backend Verification`. This is not a new claim, just a live re-check of an already-established fact before frontend work begins.
4. Backend regression — `python manage.py check`/`test`, `ruff format --check .`, `ruff check .` — all unaffected, since no backend file changes. Run anyway to confirm this story truly touched nothing there.

---

## Migration / Rollback

**No schema, no data migration, no backend code change at all.** This story is frontend-only: one new component, two small edits (`PortalTicketListPage.tsx`, `PortalLayout.tsx`), one router addition, and locale key additions.

**Rollback:** revert the commits. No `npm install` needed — no new dependency.

**Half-applied states to avoid:**

- **Task 3's router entry before task 1's `PortalTicketHistoryPage.tsx` exists** → `npm run build` fails on the missing lazy import. Ship task 1 first.
- **`tickets/history` declared after `tickets/:id`** → a literal navigation to `/portal/tickets/history` would be captured by the `:id` route instead (the same failure mode `tickets/new`'s own comment already warns about). Verification Step 5 (browser) is what catches this if it slips through.

---

## Verification Steps

1. **Backend confirms no change is needed, and closed-ticket data exists to render:** run `## Backend Verification`'s two shell commands and the curl check — `200` with the expected closed ticket(s), scoped correctly.
2. **Backend regression, run to confirm zero backend impact:** from `backend/` — `python manage.py check`, `python manage.py test` (same passing count as before), `ruff format --check .`, `ruff check .` — all clean.
3. **Frontend builds and lints clean:** from `frontend/` — `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` — all exit 0.
4. **`/portal/tickets/history` shows only closed tickets, correctly scoped.** With the backend running, log in as the customer from Step 1: visit `/portal/tickets/history` directly and via the new "History" nav link. Every row's status is closed (not shown as a column, but confirm via the detail page or the general list that none of the rows are open/in_progress/resolved). Sorting by subject/priority/created_at works; there is no status filter control on this page.
5. **`tickets/history` does not get swallowed by `tickets/:id`.** Confirm the URL bar shows `/portal/tickets/history` (not a 404 or the detail page misinterpreting "history" as an id) and the page renders the history table, not `PortalTicketDetailPage`'s "ticket not found" state.
6. **Cross-links work both ways, in both languages.** From `/portal/tickets`, click "View closed-ticket history" → lands on `/portal/tickets/history`; from there, click "View my tickets" → back to `/portal/tickets`. Switch to Arabic and repeat: both pages' titles, links, and the "Last updated" column header render in Arabic.

---

## Done Criteria

- [ ] **No backend file changed** — `git status` shows only frontend files and this plan/overview under `backend/` untouched (aside from the read-only verification queries run against the dev database).
- [ ] `frontend/src/features/portal/components/PortalTicketHistoryPage.tsx` exists, calls `usePortalTickets({ ...params, status: 'closed' })` unchanged from PORTAL-2's own hook, and has no status filter control.
- [ ] The "Last updated" (`updated_at`) column exists and is **not** marked `sortable` (absent from `PortalTicketViewSet.ordering_fields`).
- [ ] `frontend/src/app/router.tsx` routes `/portal/tickets/history`, declared before `tickets/:id`.
- [ ] `PortalLayout` nav includes "History", between "My tickets" and "New ticket".
- [ ] `PortalTicketListPage` links to `/portal/tickets/history`; `PortalTicketHistoryPage` links back to `/portal/tickets`.
- [ ] `features/portal/locales/{en,ar}.json` both have `nav.history`, `tickets.fields.updatedAt`, `tickets.list.viewHistory`, and the new `tickets.history.*` block, with identical key sets.
- [ ] Verified by real HTTP and in-browser (Steps 1, 4–6): the history view shows only the caller's own closed tickets; the route is not shadowed by `tickets/:id`; both cross-links work in both languages.
- [ ] `python manage.py check`/`test`, `ruff format --check .`, `ruff check .`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` all exit 0.
- [ ] `.squad/plans/customer-portal/00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to PORTAL-4 (Access FAQs), which surfaces knowledge-base content inside the portal shell.**
