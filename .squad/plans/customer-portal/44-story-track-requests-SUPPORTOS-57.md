# Story 44 — Track Requests (Story: SUPPORTOS-57)

## Prerequisites

- **PORTAL-0 complete:** [42-story-portal-access-customer-auth-SUPPORTOS-55.md](42-story-portal-access-customer-auth-SUPPORTOS-55.md) — `CustomerScopedModelViewSet`, `Permissions.PORTAL_ACCESS`, the `customer` role, the sibling `path: 'portal'` route tree.
- **PORTAL-1 complete:** [43-story-submit-tickets-SUPPORTOS-56.md](43-story-submit-tickets-SUPPORTOS-56.md). Verified landed on disk today: `apps/portal/serializers.py`'s `PortalTicketCreateSerializer(TicketSerializer)` (customer/category/priority read-only), `apps/portal/views.py`'s `PortalTicketViewSet(CustomerScopedModelViewSet)` with `permission_map = {"create": Permissions.PORTAL_ACCESS}` and a `perform_create` that forces `customer=request.user.customer_profile`, `apps/portal/urls.py` routing exactly `POST /api/portal/tickets/` via a plain `path()` (no router, no `list`/`retrieve`), and the frontend's `frontend/src/features/portal/{types/portalTicket.ts,api/{createPortalTicket.ts,usePortalTicketMutations.ts},components/PortalTicketFormPage.tsx}`. `usePortalTicketMutations.ts`'s own comment (verified, lines 1-8) already names this exact story: *"unlike `useCreateTicket`... there is no portal ticket list cached anywhere yet (PORTAL-2 is what adds one)."* This story is what adds it.
- **`SupportOs backlog.MD` lines 572–576** — `### STORY (PORTAL-2) — Track Requests`, dependency `PORTAL-0` only (line 574) — **not** `PORTAL-1**, though this story in practice builds directly on PORTAL-1's `PortalTicketViewSet`/`PortalTicketCreateSerializer` rather than starting a second viewset. One task: *"Scoped ticket list/detail + UI — Reuse ticket API (scoped) + shared table/states. Outcome: live status tracking."* (line 576). `PORTAL-3` (line 578, "View History" — historical/closed tickets) is the very next story.
- Verified frontend baseline: `frontend/src/features/portal/` contains exactly `types/portalTicket.ts`, `api/{createPortalTicket.ts,usePortalTicketMutations.ts}`, `components/{PortalLayout.tsx,PortalHomePage.tsx,PortalTicketFormPage.tsx}`, `locales/{en,ar}.json`. No `getPortalTickets.ts`/`getPortalTicket.ts`/list or detail component exists yet.
- Verified backend baseline: `apps/portal/views.py`'s `PortalTicketViewSet.queryset = Ticket.objects.all()` — **no** `select_related`, unlike `TicketViewSet.queryset` (`apps/tickets/views.py:50`, `.select_related("customer", "category", "assigned_agent")`). A list endpoint returning `category_name`/`assigned_agent_name` per row without it is an N+1 query per row; task 1 fixes this in the same change that adds `list`/`retrieve`.
- Verified: `apps/portal/urls.py`'s `path("portal/tickets/", ...)` currently maps only `{"post": "create"}` — no `{"get": "list"}` — and there is no `path("portal/tickets/<int:pk>/", ...)` at all. Both are added by task 3.

---

## Story Goal

Let a logged-in customer see their own tickets — a list and a detail view — reusing the exact `PortalTicketViewSet`/`CustomerScopedModelViewSet` scoping PORTAL-1 built, and the shared `DataTable`/`Empty`/`Badge` components every staff list screen already uses.

1. **Backend:** `PortalTicketViewSet` gains `list` and `retrieve`, routed alongside the existing `create` action — still no `update`/`partial_update`/`destroy`. `PortalTicketCreateSerializer` is renamed `PortalTicketSerializer` (it now serves reads, not just the one write action it was named for). A `status` query-param filter is added to `get_queryset`, mirroring `TicketViewSet`'s own validation exactly, for the "live status tracking" the intake names.
2. **Frontend:** `PortalTicketListPage` (a `DataTable` over the customer's own tickets, status filter, no search — there is exactly one customer's worth of rows to page through) and `PortalTicketDetailPage` (a read-only `Card` view — subject, description, category, assigned agent, status, priority, dates). Both live entirely under `features/portal/`, importing nothing from `features/tickets/` (the lint boundary PORTAL-1 already established).
3. **The submission flow closes the loop PORTAL-1 opened.** `useCreatePortalTicket` (PORTAL-1) gains the `queryClient.invalidateQueries({ queryKey: portalTicketKeys.all })` its own code comment already flagged as this story's job — a ticket a customer just submitted now appears in their list without a manual refresh.

### The finding that shapes the backend task

**Renaming, not just re-registering, `PortalTicketCreateSerializer`.** The class already carries every field the read views need (`TicketSerializer.Meta.fields`, inherited verbatim) — nothing about its *shape* needs to change for `list`/`retrieve` to work. But its *name* would be actively misleading once it also serves two read-only actions: a reader of `apps/portal/views.py` seeing `serializer_class = PortalTicketCreateSerializer` on a viewset whose primary action is now `list` would reasonably wonder whether a different, read-oriented serializer was intended. Renamed to `PortalTicketSerializer` — the same relationship `TicketSerializer` (not `TicketCreateSerializer`) has to `TicketViewSet`'s full CRUD surface. The class body does not change, only its name and docstring.

### Explicitly out of scope

- **Editing or deleting a ticket from the portal.** Not named in the intake; `PortalTicketViewSet` still routes only `list`, `retrieve`, `create` — never `update`/`partial_update`/`destroy`. A customer cannot change their ticket's subject, description, status, or anything else after submitting it.
- **Search.** `TicketListPage`'s staff search box searches `subject`/`description`/`customer__name` across *every* customer's tickets — a meaningful filter over a large shared table. A customer's own queue is a small, personal list; text search over one's own handful of tickets is not named in the intake and is deferred as a forward note, not built speculatively.
- **Category/priority filters.** PORTAL-1 already deferred category/priority as customer-*writable* fields; this story does not introduce them as *filterable* either — the intake's own phrase is "live **status** tracking," not "status/category/priority tracking." A status filter alone is what's built (task 1/task 5).
- **PORTAL-3 (View History) — closed/historical ticket views, or any distinction between "active" and "past" tickets.** This story's list shows every one of the customer's tickets regardless of status (the same unfiltered-by-default behavior `TicketListPage`/`MyTicketsPage` already have) — `PORTAL-3`'s explicit job (`SupportOs backlog.MD:578-582`) is extending this same list with a historical view, not something to pre-empt here.
- **Ticket conversation/messages, internal notes, SLA status, or assignment controls on the detail page.** All staff/agent-only concerns (`TicketConversation`, `InternalNotesSection`, `TicketSlaSection`, `TicketAssigneeControl` — none imported, none reused). `PortalTicketDetailPage` shows only the fields already on `PortalTicketSerializer`'s read shape.
- **Automated tests.** Standing policy, `CONVENTIONS.md` §16. See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/customer-portal/SUPPORTOS-57/intake.md` — one task block (*"Scoped ticket list/detail + UI — Reuse ticket API (scoped) + shared table/states"*), **no attachments, no acceptance criteria**. Done Criteria derive from the one **Outcome** line: *"live status tracking."*
2. `SupportOs backlog.MD` lines 572–582 — `PORTAL-2` (this story) and `PORTAL-3` (the very next one, historical view) — confirms this story shows every ticket regardless of status, not a filtered "active only" view.
3. `backend/apps/portal/serializers.py` — the full file (from PORTAL-1). Task 1 renames the class; the body is unchanged.
4. `backend/apps/portal/views.py` — the full file (from PORTAL-1): `PortalTicketViewSet.queryset`/`serializer_class`/`permission_map`/`perform_create`. Task 1 adds `list`/`retrieve` to `permission_map`, adds `select_related`, adds the `status` filter to a new `get_queryset` override, and updates the `serializer_class` reference to the renamed class.
5. `backend/apps/tickets/views.py` — `TicketViewSet.queryset` (50, the `select_related` tuple task 1 copies), `ordering_fields`/`search_fields` (80–81), and the `status` branch of `get_queryset` (118–122) — task 1's own status filter mirrors this validation exactly.
6. `backend/apps/portal/urls.py` — the full file (from PORTAL-1, 17 lines). Task 3 changes the existing `path()`'s action map from `{"post": "create"}` to `{"get": "list", "post": "create"}` and adds one new `path()` for the detail route.
7. `frontend/src/features/tickets/components/MyTicketsPage.tsx` — the closest staff precedent (139 lines): a single customer's/agent's own scoped queue, `DataTable` + one status filter + one priority filter, no search box. Task 5's `PortalTicketListPage` copies this shape, minus the priority filter (out of scope, see above) and minus every column referencing `customer_name` (redundant — it is always the caller's own name).
8. `frontend/src/shared/ui/data-table/DataTable.tsx` (174 lines), `types.ts` (`ColumnDef`, `SortState`), and `useServerTable.ts` (41 lines) — the exact `query`/`sort`/`onSortChange`/`onPageChange` contract task 5 wires up. `DataTable` renders its own loading/empty/error rows (33–35) — `PortalTicketListPage` is not wrapped in `QueryBoundary`, same as `TicketListPage`/`MyTicketsPage`.
9. `frontend/src/features/tickets/api/{getTickets.ts,useTickets.ts,ticketKeys.ts}` — the exact `api.getPage` + `useQuery` + `featureKey` pattern task 4's `getPortalTickets.ts`/`usePortalTickets.ts`/`portalTicketKeys.ts` copy, posting to `/portal/tickets/` instead of `/tickets/`.
10. `frontend/src/features/tickets/api/{getTicket.ts,useTicket.ts}` — the single-resource `api.get` + `useQuery` pattern task 4's `getPortalTicket.ts`/`usePortalTicket.ts` copy.
11. `frontend/src/features/tickets/components/TicketDetailPage.tsx` lines 1–90 — the `Card`/`CardHeader`/`CardTitle`/`CardContent` + `dl` field-grid visual pattern task 6's `PortalTicketDetailPage` copies the **shape** of, with every staff-only section (`CustomerContextPanel`, `InternalNotesSection`, `TicketAssigneeControl`, `TicketConversation`, `TicketHistorySection`, `TicketSlaSection`, `TicketStatusControl`) absent.
12. `frontend/src/features/portal/api/usePortalTicketMutations.ts` (from PORTAL-1, 14 lines) — its own docstring already names this story as the one that adds `queryClient.invalidateQueries`. Task 2 is that change.
13. `frontend/src/app/router.tsx` — the `path: 'portal'` tree (257–296, post-PORTAL-1). Task 7 adds two sibling routes (`tickets`, `tickets/:id`) inside the existing `RequirePermission permission="portal.access"` block, and **must** keep the existing `tickets/new` entry declared before `tickets/:id` — the same static-before-dynamic ordering rule the staff tree already follows for `customers/new`/`tickets/new` (see the comments at router.tsx's existing `customers/new`/`tickets/new` entries).
14. `frontend/src/features/portal/components/{PortalLayout.tsx,PortalHomePage.tsx}` (post-PORTAL-1) — task 8 adds one nav link to `PortalLayout` and one secondary call to action to `PortalHomePage`.
15. `frontend/.oxlintrc.json` lines 8–18 — the `no-restricted-imports` rule that is why task 4's types/`PortalTicket` shape is redefined locally rather than imported from `features/tickets/types/ticket.ts` — the same boundary PORTAL-1 already worked within.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Reuse ticket API (scoped).** | Intake | `PortalTicketViewSet` (PORTAL-1's class, extended, not a new viewset) gains `list`/`retrieve`; scoping is inherited from `CustomerScopedModelViewSet` unchanged. |
| **Reuse shared table/states.** | Intake | `PortalTicketListPage` is built from the shared `DataTable`/`useServerTable`/`Empty` — the same components every staff list screen uses — not a bespoke table. |
| **Live status tracking.** | Intake | A `status` query-param filter on `PortalTicketViewSet.get_queryset`, and a `status` `Badge` column/field on both the list and detail views. |
| **A feature must not import from another feature.** | `frontend/.oxlintrc.json` §15 | `features/portal/types/portalTicket.ts` defines its own `PortalTicket`/`PORTAL_TICKET_STATUSES`/`PORTAL_TICKET_PRIORITIES` — none imported from `features/tickets/`. |
| **Every mutation invalidates its feature's whole key prefix.** | `CONVENTIONS.md` §23 | `useCreatePortalTicket` (task 2) invalidates `portalTicketKeys.all` on success — a create can change which page a ticket lands on, the same reasoning `useCreateTicket` already documents. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 1 — `PortalTicketViewSet` gains `list`/`retrieve`, and a `status` filter

**File: `backend/apps/portal/serializers.py`** — rename the class (body unchanged):

```python
from apps.tickets.serializers import TicketSerializer


class PortalTicketSerializer(TicketSerializer):
    """`TicketSerializer`, narrowed for a customer's own tickets — used for
    `create`, `list`, and `retrieve` alike (PORTAL-1/PORTAL-2). Was named
    `PortalTicketCreateSerializer` when it served only `create`; renamed
    now that it also serves the two read-only actions — the same
    relationship `TicketSerializer` (not `TicketCreateSerializer`) has to
    `TicketViewSet`'s full CRUD surface.

    `customer` is read-only here on top of `TicketSerializer`'s own
    read-only set — `PortalTicketViewSet.perform_create` is what actually
    sets it, from `request.user.customer_profile`, never from client input.
    Scoping `get_queryset()` (CustomerScopedModelViewSet) protects reads;
    it does nothing for a writable field on `create`, which is why this
    also has to be a serializer-level change, not just a viewset one.

    `category` and `priority` are read-only too — not named in either
    PORTAL-1 or PORTAL-2's task, and exposing a category picker would need
    a new customer-facing "list categories" endpoint nothing else here
    needs. A portal-submitted ticket lands uncategorized at the default
    priority; staff triage assigns both later, the same way an unassigned
    `assigned_agent` already works.
    """

    class Meta(TicketSerializer.Meta):
        read_only_fields = TicketSerializer.Meta.read_only_fields + (
            "customer",
            "category",
            "priority",
        )
```

**File: `backend/apps/portal/views.py`** — replace in full:

```python
import logging

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.core.permissions import Permissions
from apps.core.views import CustomerScopedModelViewSet
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket

from .serializers import PortalTicketSerializer

logger = logging.getLogger(__name__)


class PortalTicketViewSet(CustomerScopedModelViewSet):
    """A customer's own tickets — create (PORTAL-1), list and retrieve
    (PORTAL-2). `customer_field` is left at `CustomerScopedModelViewSet`'s
    default (`"customer"`) — `Ticket.customer` is already the right name,
    no override needed.

    Only `create`, `list`, `retrieve` are routed to a URL (see
    `apps/portal/urls.py`); `update`/`partial_update`/`destroy` exist on
    this class (inherited from `ModelViewSet`) but are unreachable — no
    router registers them, and no story has asked for a customer to edit
    or delete a submitted ticket.
    """

    # Same select_related tuple as TicketViewSet.queryset
    # (apps/tickets/views.py:50) — `category_name`/`assigned_agent_name`
    # are derived, joined fields; without this, `list` is an N+1 query,
    # one extra SELECT per row per joined field.
    queryset = Ticket.objects.select_related("customer", "category", "assigned_agent").all()
    serializer_class = PortalTicketSerializer
    permission_map = {
        "create": Permissions.PORTAL_ACCESS,
        "list": Permissions.PORTAL_ACCESS,
        "retrieve": Permissions.PORTAL_ACCESS,
    }

    # Each name here must match a ColumnDef.id on the frontend, exactly
    # like TicketViewSet's own contract (CONVENTIONS.md §23).
    ordering_fields = ("subject", "status", "priority", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset

        # Same validation TicketViewSet.get_queryset already uses for the
        # identical param (apps/tickets/views.py:118-122) — "live status
        # tracking" is the one filter this story's intake names.
        status = self.request.query_params.get("status")
        if status:
            if status not in Ticket.Status.values:
                raise ValidationError({"status": [_("Must be a valid status.")]})
            queryset = queryset.filter(status=status)

        return queryset

    def perform_create(self, serializer):
        # The one line CustomerScopedModelViewSet's scoping cannot do for
        # you on create: force the customer, never trust the client for it.
        ticket = serializer.save(customer=self.request.user.customer_profile)
        try:
            auto_assign_ticket.delay(ticket.id)
        except Exception:
            # Same resilience contract as TicketViewSet.perform_create
            # (apps/tickets/views.py:83-93) — the Ticket row is already
            # committed; auto-assignment queuing failing must not fail
            # the customer's submission.
            logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)
```

No `search_fields` — search is explicitly out of scope (see `## Story Goal`).

---

### 2 — Frontend mutation invalidation

**File: `frontend/src/features/portal/api/usePortalTicketMutations.ts`** — replace in full:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createPortalTicket } from './createPortalTicket'
import { portalTicketKeys } from './portalTicketKeys'
import type { PortalTicketInput } from '../types/portalTicket'

/**
 * Invalidates the whole `portal-tickets` key prefix on success — PORTAL-2's
 * list is paginated/sorted, so a create can change which rows land on which
 * page, the same reasoning `useCreateTicket`
 * (features/tickets/api/useTicketMutations.ts:18-24) documents. This is the
 * change PORTAL-1's own code comment named as PORTAL-2's job.
 */
export function useCreatePortalTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PortalTicketInput) => createPortalTicket(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalTicketKeys.all }),
  })
}
```

---

### 3 — Route `list` and `retrieve`

**File: `backend/apps/portal/urls.py`** — replace in full:

```python
from django.urls import path

from .views import PortalTicketViewSet

app_name = "portal"

# Plain path()s, not a router: this viewset exposes exactly three actions.
# Registering it with a router would additionally route update/partial_update
# /destroy URLs no story has asked for — see PortalTicketViewSet's own
# docstring.
urlpatterns = [
    path(
        "portal/tickets/",
        PortalTicketViewSet.as_view({"get": "list", "post": "create"}),
        name="portal-ticket-list",
    ),
    path(
        "portal/tickets/<int:pk>/",
        PortalTicketViewSet.as_view({"get": "retrieve"}),
        name="portal-ticket-detail",
    ),
]
```

Endpoints: `GET /api/portal/tickets/` (list, paginated), `POST /api/portal/tickets/` (unchanged from PORTAL-1), `GET /api/portal/tickets/<id>/` (retrieve, scoped — a request for another customer's ticket id 404s, since `get_queryset()` already excludes it before the pk lookup runs).

---

## Frontend Tasks

### 4 — `features/portal/types/` and `features/portal/api/` for reading tickets

**File: `frontend/src/features/portal/types/portalTicket.ts`** — extend (do not remove the existing `PortalTicketInput`/`PortalTicketCreated`):

```ts
/** Mirrors `apps.portal.serializers.PortalTicketSerializer` — the read
 * shape a customer's own ticket list/detail returns. Duplicated from
 * `features/tickets/types/ticket.ts`'s `Ticket`/`TicketStatus`/
 * `TicketPriority` rather than imported — `no-restricted-imports`
 * (frontend/.oxlintrc.json) forbids a cross-feature import, the same
 * boundary PORTAL-1's `PortalTicketInput` already works within. */
export const PORTAL_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
export type PortalTicketStatus = (typeof PORTAL_TICKET_STATUSES)[number]

export const PORTAL_TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type PortalTicketPriority = (typeof PORTAL_TICKET_PRIORITIES)[number]

export type PortalTicket = {
  id: number
  subject: string
  description: string
  customer: number
  customer_name: string
  category: number | null
  category_name: string | null
  assigned_agent: number | null
  assigned_agent_name: string | null
  status: PortalTicketStatus
  priority: PortalTicketPriority
  escalated: boolean
  escalated_at: string | null
  created_at: string
  updated_at: string
}
```

**Create file: `frontend/src/features/portal/api/portalTicketKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const portalTicketKeys = featureKey('portal-tickets')
```

**Create file: `frontend/src/features/portal/api/getPortalTickets.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { PortalTicket, PortalTicketStatus } from '../types/portalTicket'

export type PortalTicketListParams = ServerTableParams & {
  status?: PortalTicketStatus
}

export function getPortalTickets(params: PortalTicketListParams): Promise<Page<PortalTicket>> {
  return api.getPage<PortalTicket>('/portal/tickets/', { params })
}
```

**Create file: `frontend/src/features/portal/api/usePortalTickets.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getPortalTickets } from './getPortalTickets'
import type { PortalTicketListParams } from './getPortalTickets'
import { portalTicketKeys } from './portalTicketKeys'

export function usePortalTickets(params: PortalTicketListParams) {
  return useQuery({
    queryKey: portalTicketKeys.resource('list', params),
    queryFn: () => getPortalTickets(params),
  })
}
```

**Create file: `frontend/src/features/portal/api/getPortalTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { PortalTicket } from '../types/portalTicket'

export function getPortalTicket(id: number): Promise<PortalTicket> {
  return api.get<PortalTicket>(`/portal/tickets/${id}/`)
}
```

**Create file: `frontend/src/features/portal/api/usePortalTicket.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getPortalTicket } from './getPortalTicket'
import { portalTicketKeys } from './portalTicketKeys'

export function usePortalTicket(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: portalTicketKeys.resource('detail', id),
    queryFn: () => getPortalTicket(id),
    enabled: options?.enabled,
  })
}
```

---

### 5 — `PortalTicketListPage`

**Create file: `frontend/src/features/portal/components/PortalTicketListPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
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

import { usePortalTickets } from '../api/usePortalTickets'
import { PORTAL_TICKET_STATUSES } from '../types/portalTicket'
import type { PortalTicket, PortalTicketStatus } from '../types/portalTicket'

/**
 * The customer's own ticket queue — PORTAL-2. Shape copied from the staff
 * `MyTicketsPage` (features/tickets/components/MyTicketsPage.tsx), minus
 * the priority filter (out of scope) and the `customer_name` column
 * (redundant — every row belongs to the caller). Not wrapped in
 * `QueryBoundary` — `DataTable` renders its own loading/empty/error rows.
 */
export function PortalTicketListPage() {
  const { t } = useTranslation('portal')
  const { date } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  // "all" is the sentinel for "no filter" — same convention
  // TicketListPage/MyTicketsPage use (CONVENTIONS.md §19).
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    setPage(1)
  }, [statusFilter, setPage])

  const query = usePortalTickets({
    ...params,
    ...(statusFilter !== 'all' ? { status: statusFilter as PortalTicketStatus } : {}),
  })

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
      id: 'status',
      header: t('tickets.fields.status'),
      sortable: true,
      cell: (row) => <Badge variant="secondary">{t(`tickets.statuses.${row.status}`)}</Badge>,
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
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('tickets.list.title')}</h1>
        <Button asChild>
          <Link to="/portal/tickets/new">{t('tickets.new')}</Link>
        </Button>
      </div>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger aria-label={t('tickets.filters.status')} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('tickets.filters.allStatuses')}</SelectItem>
          {PORTAL_TICKET_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`tickets.statuses.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('tickets.list.title')}
        empty={
          <Empty title={t('tickets.list.empty')} description={t('tickets.list.emptyDescription')} />
        }
      />
    </div>
  )
}
```

---

### 6 — `PortalTicketDetailPage`

**Create file: `frontend/src/features/portal/components/PortalTicketDetailPage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { usePortalTicket } from '../api/usePortalTicket'

/**
 * A read-only view of one of the customer's own tickets — PORTAL-2. No
 * assign/escalate/status controls, no conversation, no internal notes —
 * all staff/agent-only concerns the staff `TicketDetailPage`
 * (features/tickets/components/TicketDetailPage.tsx) has that this one
 * deliberately does not reuse or mirror.
 */
export function PortalTicketDetailPage() {
  const { t } = useTranslation('portal')
  const { date } = useFormatters()
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const isValidId = !Number.isNaN(id)

  const query = usePortalTicket(id, { enabled: isValidId })

  return (
    <div className="flex flex-col gap-4">
      <Link to="/portal/tickets" className="text-sm text-muted-foreground hover:underline">
        {t('tickets.detail.backToList')}
      </Link>
      {isValidId ? (
        <QueryBoundary query={query}>
          {(ticket) => (
            <Card>
              <CardHeader>
                <CardTitle asChild className="text-lg">
                  <h1>{ticket.subject}</h1>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t('tickets.fields.status')}
                    </dt>
                    <dd>
                      <Badge variant="secondary">{t(`tickets.statuses.${ticket.status}`)}</Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t('tickets.fields.priority')}
                    </dt>
                    <dd>
                      <Badge variant="secondary">
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
                </dl>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t('tickets.fields.description')}
                  </dt>
                  <dd className="whitespace-pre-wrap">{ticket.description}</dd>
                </div>
              </CardContent>
            </Card>
          )}
        </QueryBoundary>
      ) : null}
    </div>
  )
}
```

---

### 7 — Wire `/portal/tickets` and `/portal/tickets/:id`

**File: `frontend/src/app/router.tsx`** — replace the existing `RequirePermission permission="portal.access"` block (lines 271–291) with:

```tsx
          {
            element: <RequirePermission permission="portal.access" />,
            children: [
              {
                index: true,
                lazy: async () => {
                  const { PortalHomePage } =
                    await import('@/features/portal/components/PortalHomePage')
                  return { element: <PortalHomePage /> }
                },
              },
              {
                path: 'tickets',
                lazy: async () => {
                  const { PortalTicketListPage } =
                    await import('@/features/portal/components/PortalTicketListPage')
                  return { element: <PortalTicketListPage /> }
                },
              },
              {
                // Must stay before `tickets/:id`, the same reason
                // `customers/new`/`tickets/new` are declared before their
                // own `:id` siblings elsewhere in this file.
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
            ],
          },
```

Only `tickets` and `tickets/:id` are new; `tickets/new` is unchanged from PORTAL-1, kept in its ordering-sensitive position.

---

### 8 — Nav and home-page links

**File: `frontend/src/features/portal/components/PortalLayout.tsx`** — add one nav link, directly before the existing "New ticket" link:

```tsx
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal">{t('nav.home')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/tickets">{t('nav.myTickets')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/tickets/new">{t('nav.newTicket')}</Link>
            </Button>
          </nav>
```

**File: `frontend/src/features/portal/components/PortalHomePage.tsx`** — add a second, secondary call to action alongside the existing "Submit a ticket" button:

```tsx
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/primitives/button'

export function PortalHomePage() {
  const { t } = useTranslation('portal')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('home.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('home.intro')}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/portal/tickets/new">{t('tickets.new')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/portal/tickets">{t('nav.myTickets')}</Link>
        </Button>
      </div>
    </div>
  )
}
```

---

### 9 — Locale keys

**File: `frontend/src/features/portal/locales/en.json`** — add `nav.myTickets`, and extend the existing `tickets` key with `fields.*`/`statuses.*`/`priorities.*`/`list.*`/`filters.*`/`detail.*`:

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
      "createdAt": "Submitted"
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
      "emptyDescription": "Submit your first ticket and it will show up here."
    },
    "filters": {
      "status": "Status",
      "allStatuses": "All statuses"
    },
    "detail": {
      "backToList": "Back to my tickets"
    }
  }
}
```

**File: `frontend/src/features/portal/locales/ar.json`** — the same key structure, translated. Every key present in `en` must exist in `ar` (`CONVENTIONS.md` §18) — a missing key falls back silently to English.

---

## Edge Cases & Failure Modes

- **A customer requesting another customer's ticket id gets a 404, not a 403.** `PortalTicketViewSet.get_queryset()` (inherited from `CustomerScopedModelViewSet`) already excludes every other customer's rows *before* the pk lookup runs — `get_object_or_404` never finds the row, so DRF raises `Http404`, not `PermissionDenied`. This is the same "scoping protects reads" behavior PORTAL-0/PORTAL-1 already established; this story is the first to actually exercise it through a real `retrieve` call.
- **A staff account (no `customer_profile`) hitting `GET /api/portal/tickets/` gets an empty list, not an error** — same `get_queryset()` `customer is None` → `.none()` branch PORTAL-0's own verification proved, now reachable through a real `list` action for the first time.
- **The `status` filter rejects an invalid value with a 400, not a silent no-op.** Mirrors `TicketViewSet.get_queryset`'s own validation (`apps/tickets/views.py:118-122`) exactly — a typo'd status string is a `ValidationError`, not an unfiltered list.
- **A ticket created before this story's `select_related` change still returns correctly** — `select_related` only changes the SQL query shape (fewer round trips), never which rows are returned or their field values. No migration, no backfill needed.
- **A hand-typed non-numeric `/portal/tickets/abc` does not crash the detail page.** Same `isValidId`/`enabled` guard `TicketDetailPage` already uses (`features/tickets/components/TicketDetailPage.tsx:30-37`) — the query never fires for a non-numeric id, and the page renders nothing rather than an error.
- **Sorting by `category_name`/`assigned_agent_name` is not offered.** Both are joined/derived display columns absent from `PortalTicketViewSet.ordering_fields`, the same non-sortable precedent `TicketListPage`/`MyTicketsPage` already establish for these exact two fields — `sortable` is simply omitted on those two `ColumnDef`s.
- **A customer with zero tickets sees `Empty`, not a table with a header row and nothing else.** `DataTable`'s own `query.isSuccess && query.data.items.length === 0` branch (`DataTable.tsx:144-150`) renders the `empty` prop — `PortalTicketListPage` passes one, matching `MyTicketsPage`'s own pattern.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — clean, and the existing suite reports the same passing count as before this change.
2. `ruff format --check .` / `ruff check .` on the new and changed Python.
3. `npm run build` — typechecks `PortalTicketListPage`, `PortalTicketDetailPage`, `PortalTicket`/`PortalTicketListParams`, and the new router entries.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl` — unchanged gates over the new files; lint is also what proves `features/portal/` still imports nothing from `features/tickets/`.
5. Real HTTP checks proving list/retrieve are correctly scoped, filtered, and that a create is now reflected in the list — Verification Steps 3–7. This is where the story's actual claim gets tested; nothing static can see it.

---

## Migration / Rollback

**No schema or data migration.** This story only extends existing Python modules (`apps/portal/serializers.py` renamed class, `apps/portal/views.py` extended, `apps/portal/urls.py` extended) and adds frontend modules — no model change.

**Rollback of the code:** revert the commits. No `npm install`/`pip install` needed — no new dependency in either app.

**Half-applied states to avoid:**

- **The serializer rename in task 1 without updating `views.py`'s `serializer_class` reference in the same change** → `ImportError: cannot import name 'PortalTicketCreateSerializer'` on Django startup. Ship both edits together.
- **Task 3's `urls.py` routing `list` before task 1's `permission_map` includes `"list"`** → every `list` request 403s (falls through `HasPermission` with no permission granted — wait, actually grant-on-omission means it would be authenticated-only, i.e. **any** authenticated user, staff included, could list — the wrong direction of failure, and worse than a 403). Ship task 1 and task 3 together, never one without the other.
- **Task 7's router entries before task 5/6's components exist** → `npm run build` fails on the missing lazy imports. Ship tasks 5–6 before task 7.
- **Task 2's `invalidateQueries` referencing `portalTicketKeys` before task 4 creates `portalTicketKeys.ts`** → a compile error, not a runtime bug. Ship task 4 before task 2, or in the same change.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` — `python manage.py check`, `ruff format --check .`, `ruff check .` — all clean.
2. **Backend regression:** `python manage.py test` — reports the same passing count as before this change.
3. **A customer lists only their own tickets, and sorting/filtering work:**

   ```powershell
   $t = (curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/ -H "Content-Type: application/json" -d '{\"email\":\"cust1@example.com\",\"password\":\"Sup3rSecret!\"}' | ConvertFrom-Json).data.access
   curl.exe -s http://127.0.0.1:8000/api/portal/tickets/ -H "Authorization: Bearer $t"
   curl.exe -s "http://127.0.0.1:8000/api/portal/tickets/?ordering=-created_at" -H "Authorization: Bearer $t"
   curl.exe -s "http://127.0.0.1:8000/api/portal/tickets/?status=open" -H "Authorization: Bearer $t"
   curl.exe -s -w "\nHTTP:%{http_code}\n" "http://127.0.0.1:8000/api/portal/tickets/?status=bogus" -H "Authorization: Bearer $t"
   ```

   Expect: only `cust1`'s own tickets in every response; the last call returns `400` with `error.fields.status`.
4. **A customer retrieves their own ticket by id, and 404s on another customer's:**

   ```powershell
   curl.exe -s http://127.0.0.1:8000/api/portal/tickets/<cust1-own-ticket-id>/ -H "Authorization: Bearer $t"
   curl.exe -s -w "\nHTTP:%{http_code}\n" http://127.0.0.1:8000/api/portal/tickets/<cust2-ticket-id>/ -H "Authorization: Bearer $t"
   ```

   Expect `200` with the ticket body for the first; `404` (not `403`) for the second.
5. **A staff account listing the portal endpoint gets an empty page, not an error or a data leak.** Repeat step 3's plain list call with a staff token that holds no `portal.access`: expect `403 permission_denied`. (There is no staff account holding `portal.access` to exercise the `200`-but-empty branch outside the PORTAL-0 harness — this is the same layering PORTAL-0's own verification already proved and is not re-tested here.)
6. **A newly created ticket appears in the list without a manual cache-busting reload.** In the browser (see Step 8), submit a new ticket via `/portal/tickets/new`, then visit `/portal/tickets`: the new ticket is present. This is `useCreatePortalTicket`'s `invalidateQueries` (task 2) actually working, not just compiling.
7. **`GET`/`POST` on the collection path and `GET` on the detail path all route correctly; `PATCH`/`DELETE` remain unreachable.** `curl -X PATCH .../portal/tickets/<id>/` with a valid customer token: expect `405 method_not_allowed` (the permission gate passes — customer holds `portal.access` and owns the ticket — so this exercises the actual method-routing this time, the same ordering PORTAL-1's own Step 6 uncovered for `GET` on the create-only endpoint).
8. **Frontend builds and lints clean:** from `frontend/` — `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` — all exit 0.
9. **The list and detail pages render and page/sort/filter correctly, in both languages.** With the backend running: `npm run dev`, log in as `cust1@example.com`, navigate to `/portal/tickets` (via the new "My tickets" nav link or `PortalHomePage`'s new secondary button). Confirm the status filter narrows the list, clicking a column header re-sorts, and clicking a subject navigates to `/portal/tickets/:id` showing the same ticket's fields. Switch language to Arabic and repeat: all labels, statuses, and priorities render in Arabic.

---

## Done Criteria

- [ ] `PortalTicketCreateSerializer` renamed `PortalTicketSerializer` in `apps/portal/serializers.py`; class body unchanged.
- [ ] `PortalTicketViewSet.permission_map` includes `list`/`retrieve`, both mapped to `Permissions.PORTAL_ACCESS`; `queryset` gains `.select_related("customer", "category", "assigned_agent")`; `ordering_fields = ("subject", "status", "priority", "created_at")`; `get_queryset` validates and applies an optional `status` filter on `list` only.
- [ ] `apps/portal/urls.py` routes `GET`+`POST /api/portal/tickets/` and `GET /api/portal/tickets/<id>/`; `PATCH`/`PUT`/`DELETE` on either path return `405` for an authorized customer (not routed).
- [ ] Verified by real HTTP (Steps 3–7): a customer sees and sorts/filters only their own tickets; retrieving another customer's ticket id 404s; a staff account (no `portal.access`) is denied; a create is reflected in a subsequent list call.
- [ ] `frontend/src/features/portal/types/portalTicket.ts` gains `PortalTicket`/`PORTAL_TICKET_STATUSES`/`PORTAL_TICKET_PRIORITIES`, none imported from `features/tickets/` (lint-verified).
- [ ] `frontend/src/features/portal/api/{portalTicketKeys.ts,getPortalTickets.ts,usePortalTickets.ts,getPortalTicket.ts,usePortalTicket.ts}` all exist; `usePortalTicketMutations.ts`'s `useCreatePortalTicket` now invalidates `portalTicketKeys.all`.
- [ ] `PortalTicketListPage` (DataTable, status filter, no search) and `PortalTicketDetailPage` (read-only Card view) both exist under `frontend/src/features/portal/components/`.
- [ ] `frontend/src/app/router.tsx` routes `/portal/tickets` and `/portal/tickets/:id`, with `tickets/new` still declared before `tickets/:id`.
- [ ] `PortalLayout` nav includes "My tickets"; `PortalHomePage` links to it alongside the existing "Submit a ticket" button.
- [ ] `features/portal/locales/{en,ar}.json` both have the extended `tickets.*` keys (`fields`, `statuses`, `priorities`, `list`, `filters`, `detail`) and `nav.myTickets`, with identical key sets.
- [ ] `python manage.py check`/`test`, `ruff format --check .`, `ruff check .`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` all exit 0.
- [ ] `.squad/plans/customer-portal/00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to PORTAL-3 (View History), which extends this same list with a historical/closed-tickets view.**
