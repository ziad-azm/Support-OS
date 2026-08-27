# Story 20 — Interaction History (Story: SUPPORTOS-30)

## Prerequisites

- **Story 10 (CUST-1), Story 12 (TKT-1), and the COMM-* stories completed** — the intake names all three (`Dependencies: CUST-1, TKT-1, COMM-*`). `Customer` (`apps/customers/models.py`, 95 lines), `Ticket` (`apps/tickets/models.py`, incl. `category` since Story 18), `Message` (`apps/communications/models.py`), `BaseModelViewSet`/`HasPermission`, `CustomerProfilePage.tsx` (100 lines) and `ContactDetailsSection.tsx` (250 lines) all exist and are extended, not replaced.
- **The "is COMM-* satisfied?" question the feature overview left open is now moot.** `.squad/plans/communication-channels/00-overview.md:27` recorded it as an open product call for whoever planned CUST-3: *"whether 'COMM-*' is satisfied by COMM-0's messaging spine alone or needs at least one real channel (COMM-1+) wired up is a product call story 13 does not make."* **All six COMM stories (COMM-0 through COMM-5) are now planned and implemented** (Stories 13–17, 19), so the question no longer needs answering — every channel that can write a `Message` exists. This story aggregates `Message` rows regardless of which adapter created them, so it is channel-agnostic by construction.
- **`interaction history` is explicitly assigned to `apps.customers` by the app-purpose table.** Verified: `backend/apps/README.md:62`, *"`customers` | Customer records, contacts, interaction history."* — this settles where the aggregation code lives, even though it reads `apps.tickets` and `apps.communications` models. That is a **reverse-direction cross-app import** (the models dependency runs `customers ← tickets ← communications`), but it has precedent and is safe: `apps/tickets/admin.py:3` already does `from apps.communications.models import Message` (Story 13's `MessageInline`) in the same against-the-grain direction, and `apps/communications/views.py` imports `apps.tickets.serializers` (Story 19). Django's `apps.populate()` loads every model before any URLconf or view module is imported, so a view-layer or helper-module import in this direction cannot deadlock. **No models are touched, so no cycle is possible at model-import time either** — `apps/customers/models.py` stays a leaf that imports nothing from `tickets`/`communications`.
- **This story is the project's first DRF `@action`.** Verified: `grep -rn "@action\|from rest_framework.decorators" backend/apps --include=*.py` returns **nothing** — every endpoint so far is either a router-generated CRUD route or a standalone `APIView`. Two mechanics were verified against the installed library before choosing it:
  - **The router generates the route automatically.** `rest_framework/routers.py:130-135` — `DynamicRoute(url=r'^{prefix}/{lookup}/{url_path}{trailing_slash}$', name='{basename}-{url_name}', detail=True)`, populated from `viewset.get_extra_actions()` (line 185). So `@action(detail=True, methods=["get"], url_path="timeline")` on `CustomerViewSet` yields `/api/customers/<pk>/timeline/` named `customer-timeline`, with **no change to `apps/customers/urls.py`**.
  - **`permission_map` gates it by the action's own name.** `rest_framework/viewsets.py:158` sets `self.action = self.action_map.get(method)`, which for this route is the method name `"timeline"`; `apps/core/permissions.py::HasPermission._required_permission` (lines 93-101) looks `view.action` up in `permission_map`. So `"timeline": Permissions.CUSTOMERS_VIEW` is the entry that gates it — and **omitting that entry does not deny, it falls through to authenticated-only** (`HasPermission`'s own documented behaviour, `permissions.py:75-80`, and `_required_permission`'s `mapping.get(request.method.lower())` fallback finds no `"get"` key either). The map entry is load-bearing; see `## Migration / Rollback`.
- **The timeline payload contains ticket and message data, so it is permission-checked twice.** `customers.view` alone would let a hypothetical `customers.view`-only role read ticket subjects and message bodies that `GET /api/tickets/` and `GET /api/messages/` both gate behind `tickets.view`. The action therefore also checks `Permissions.TICKETS_VIEW in permissions_for(request.user)` explicitly — the same "permission-checked, not just authenticated/adjacent" closing move Story 16's `TicketChatConsumer` made for its WebSocket. **Honest caveat:** no seeded role currently exercises this branch — verified against the live database, `admin`/`ziad@email.com` are superusers (all permissions) and `mgr`/`agent` both hold `customers.view` *and* `tickets.view` — so `## Verification Steps` creates a throwaway `customers.view`-only role to prove it, then deletes it.
- **The response is a plain, non-paginated JSON array, capped in code.** DRF's `DefaultPageNumberPagination` (`apps/core/pagination.py`) paginates a *queryset*; this endpoint merges two unrelated querysets in Python, so queryset pagination does not apply. Precedent for a plain array from an `APIView`-style read already exists: `WebFormCategoriesView` (Story 19) returns `CategorySerializer(..., many=True).data` with no pagination block. The cap is a module constant, `TIMELINE_MAX_ENTRIES = 100`, matching `DRF_MAX_PAGE_SIZE` and the `page_size: 100` ceiling `getContactDetails.ts:10-14` and `getCustomerOptions.ts` already accept for the same "inline on the profile, no pagination UI" reason.
- **Slicing each queryset to the cap *before* merging is correct, not an approximation.** Both source querysets are ordered newest-first, so the newest `N` of the merged list can only be drawn from the newest `N` of each side — taking `[:N]` from each before merging yields exactly the same top `N`, while bounding how many rows ever leave the database. This is what keeps a customer with 10 000 messages from loading 10 000 rows into memory.
- **No new model, no migration, no new dependency.** `Ticket`, `Message`, `Customer`, `Category` are all unchanged; nothing new is installed.

---

## Story Goal

1. **An interaction-aggregation API**: `GET /api/customers/<id>/timeline/` — a single chronological (newest-first) array merging every `Ticket` opened by that customer and every `Message` on any of those tickets, each entry tagged with a `kind` discriminator (`"ticket"` / `"message"`). Gated by `customers.view` **and** `tickets.view`.
2. **A timeline on the customer profile**: `InteractionTimelineSection`, a third card on `CustomerProfilePage` alongside the existing detail card and `ContactDetailsSection`, rendering the merged history through the shared `QueryBoundary` loading/error/empty states, fully translated in `en`/`ar`.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `build_timeline()` in `apps/customers/timeline.py` | The aggregation itself — a pure function over two querysets, kept out of the view so the view stays a thin permission + serialization shell. |
| `@action(detail=True)` on `CustomerViewSet` | The endpoint is a customer-scoped read of the customer resource; the router generates the URL and `permission_map` gates it (both verified — see `## Prerequisites`). |
| The extra `tickets.view` check | The payload is ticket/message data; `customers.view` alone would leak it. |
| `kind` discriminator + `${kind}-${id}` React keys | `id` is **not** unique across kinds — ticket 5 and message 5 both exist. See `## Edge Cases`. |
| `InteractionTimelineSection` in `features/customers/` | The intake says "timeline **on profile**" — its only consumer is `CustomerProfilePage`, so it lives beside `ContactDetailsSection`, not in a new feature. |

**Not here, and why:**

- **No pagination or "load more" UI.** A hard cap of the 100 most recent entries, matching the same decision `getContactDetails.ts` documents for a customer's contacts. Stated in the UI only by virtue of being newest-first; see `## Edge Cases`.
- **No notes or attachments in the timeline.** `CUST-4` (`SupportOs backlog.MD:296-302`) owns `Note`/`Attachment`; they do not exist yet, and this story adds no placeholder for them.
- **No ticket status-change or assignment events.** `TKT-5` (Ticket History, `SupportOs backlog.MD:343-348`) owns the `TicketActivity` log. This timeline aggregates the two record types that exist today — tickets and messages — exactly as the intake words it.
- **No real-time updates.** The timeline is a normal TanStack Query read (`staleTime: 30_000`, verified in the query-client config), not a WebSocket subscription. Story 16's per-ticket socket is scoped to one ticket's conversation, not a customer's whole history.
- **No writes.** `GET` only; no new mutation, no new permission constant.

---

## Context — Read These Files First

1. `.squad/stories/customer-management/SUPPORTOS-30/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 288-294 (`STORY (CUST-3) — Interaction History`) and lines 296-302 (`CUST-4`, the sibling this story must not pre-empt).
3. `backend/apps/customers/views.py` (67 lines) — `CustomerViewSet` (lines 11-35): the fully-populated `permission_map` (lines 22-29) task 2 adds one entry to, and `ordering_fields`/`search_fields` (34-35), untouched. `ContactDetailViewSet.get_queryset` (lines 56-67) is the precedent for a customer-scoped read, though this story scopes by URL `pk` rather than a query param.
4. `backend/apps/customers/urls.py` (11 lines) — the `DefaultRouter`; **confirm no edit is needed here** after task 2 (the router auto-generates the action's route — see `## Prerequisites`).
5. `backend/apps/core/permissions.py` (101 lines) — `Permissions.CUSTOMERS_VIEW`/`TICKETS_VIEW` (lines 29-31), `permissions_for()` (lines 42-57, the function the extra check calls), and `HasPermission._required_permission` (lines 93-101, the action-name lookup verified in `## Prerequisites`).
6. `backend/apps/tickets/models.py` — `Ticket.customer` (`related_name="tickets"`), `Ticket.category` (nullable, Story 18), `Ticket.Meta.ordering = ("-created_at",)` — the newest-first convention this timeline follows.
7. `backend/apps/communications/models.py` — `Message.ticket` (`related_name="messages"`), `direction`/`channel`/`body`, and `Meta.ordering = ("created_at",)` — **the opposite** order, for the documented reason that a conversation reads top-to-bottom. This story deliberately does not inherit that; see `## Product rules`.
8. `backend/apps/core/pagination.py` (38 lines) — confirms pagination is queryset-based, hence the plain-array decision in `## Prerequisites`.
9. `backend/apps/README.md` line 62 — the app-purpose table row assigning "interaction history" to `customers`.
10. `frontend/src/features/customers/components/CustomerProfilePage.tsx` (100 lines) — the `QueryBoundary` + detail-card + `<ContactDetailsSection customerId={customer.id} />` shape (lines 47-94); task 6 adds one sibling line at line 91.
11. `frontend/src/features/customers/components/ContactDetailsSection.tsx` (250 lines) — read lines 59-88 only: the `Card`/`CardHeader`/`CardTitle`/`CardContent` + `QueryBoundary` + `isEmpty`/`empty` + `<ul>` shape task 5 copies. **Ignore the form halves** (lines 144-250) — this story's section is read-only.
12. `frontend/src/features/customers/api/getContactDetails.ts` (14 lines) / `useContactDetails.ts` (11 lines) — the `customerKeys.resource('<resource>', customerId)` query-key shape and the `page_size: 100`-with-a-comment precedent tasks 4's files copy.
13. `frontend/src/features/web-form/api/getWebFormCategories.ts` (10 lines, Story 19) — the "plain array, not `Page<T>`" `api.get<T[]>` shape `getCustomerTimeline.ts` copies.
14. `frontend/src/features/customers/types/contactDetail.ts` (24 lines) — the `as const` + `(typeof X)[number]` pattern (lines 1-3) task 3's type file follows for its own channel/status/direction unions.
15. `frontend/src/features/customers/locales/en.json`/`ar.json` (57 lines each) — the nested `contacts.*` block (lines 30-56) is the shape task 7's `timeline.*` block mirrors.
16. `frontend/src/shared/hooks/useFormatters.ts` (23 lines) — `dateTime` (line 20), the formatter this story uses (contrast `date`, which every existing screen uses for a bare date — a timeline needs the time too).
17. `frontend/src/shared/ui/QueryBoundary.tsx` (48 lines) — `isEmpty`/`empty` props, and the docstring's "never hand-roll isPending/isError branches" rule.
18. `CONVENTIONS.md` § 15 (import conventions — why the timeline cannot import `@/features/tickets`' channel/status labels), § 19 (`DataTable` is the only table pattern — **and why this is a `<ul>`, not a table**; see `## Product rules`), § 23 (feature module conventions — Story 19's paragraph is the most recent, and this story's own addition appends after it).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Endpoint aggregates tickets + messages chronologically.** | Intake, task 1 | `build_timeline()` (`apps/customers/timeline.py`), `CustomerViewSet.timeline`. |
| **Timeline on the profile, using shared states.** | Intake, task 2 | `InteractionTimelineSection` rendering through `QueryBoundary`; three `Card`s on `CustomerProfilePage`. |
| **Newest-first, unlike `Message.Meta.ordering`.** | This story's design | `build_timeline()` sorts `reverse=True`. An agent opening a profile for "context" wants recent activity first — the same reason `Ticket.Meta.ordering` is `-created_at` (a queue read newest-first) rather than `Message`'s oldest-first conversation order. |
| **Gated by `customers.view` AND `tickets.view`.** | This story's design, closing a real leak | `permission_map["timeline"]` plus the explicit `permissions_for()` check in the action. |
| **A `<ul>`, not a `DataTable`.** | § 19 | `DataTable` is the only *table* pattern, and it is built for one homogeneous row type with server-side sort/pagination per `ColumnDef.id`. A timeline is a heterogeneous, unsortable, unpaginated feed of two different shapes — `ContactDetailsSection`'s own `<ul>` (line 75) is the in-project precedent for exactly this. |
| **Capped at the 100 most recent entries.** | This story's design | `TIMELINE_MAX_ENTRIES` in `apps/customers/timeline.py`. |
| Wire format is `snake_case` end to end; the UI translates values, the API never sends display labels. | § 12 | `kind`/`occurred_at`/`ticket_id`/`category_name`; `timeline.channels.*`/`directions.*`/`statuses.*` locale keys do the labelling. |
| No new permission constant, no new dependency, no migration. | § 17, § 22 | Reuses `CUSTOMERS_VIEW`/`TICKETS_VIEW`. |

---

## Backend Tasks

### 1 — The aggregation helper

**Create file: `backend/apps/customers/timeline.py`**

```python
"""Interaction-history aggregation — CUST-3.

Lives in `apps.customers` per `backend/apps/README.md`'s app-purpose table
("customers | Customer records, contacts, interaction history"), even though
it reads `apps.tickets` and `apps.communications` models. That is a
reverse-direction cross-app import, with precedent (`apps/tickets/admin.py`
imports `apps.communications.models`) and no cycle risk: no *model* here
imports across apps. See Story 20 `## Prerequisites`.
"""

from apps.communications.models import Message
from apps.tickets.models import Ticket

from .models import Customer

# The 100 most recent entries, matching DRF_MAX_PAGE_SIZE and the same
# "inline on the profile, no pagination UI" ceiling
# `getContactDetails.ts` accepts. Not an ENV var — an internal display
# limit, not deployment config.
TIMELINE_MAX_ENTRIES = 100


def build_timeline(customer: Customer) -> list[dict]:
    """Every ticket this customer opened and every message on those tickets,
    merged newest-first and capped at `TIMELINE_MAX_ENTRIES`.

    Newest-first deliberately diverges from `Message.Meta.ordering`
    (oldest-first, because a *conversation* reads top-to-bottom) and follows
    `Ticket.Meta.ordering` instead — an agent opening a profile wants recent
    activity first. See Story 20 `## Product rules`.
    """
    tickets = (
        Ticket.objects.filter(customer=customer)
        .select_related("category")
        .order_by("-created_at")[:TIMELINE_MAX_ENTRIES]
    )
    messages = (
        Message.objects.filter(ticket__customer=customer)
        .order_by("-created_at")[:TIMELINE_MAX_ENTRIES]
    )

    entries = [
        {
            "kind": "ticket",
            "id": ticket.id,
            "occurred_at": ticket.created_at,
            "ticket_id": ticket.id,
            "subject": ticket.subject,
            "status": ticket.status,
            "priority": ticket.priority,
            "category_name": ticket.category.name if ticket.category else None,
        }
        for ticket in tickets
    ] + [
        {
            "kind": "message",
            "id": message.id,
            "occurred_at": message.created_at,
            "ticket_id": message.ticket_id,
            "direction": message.direction,
            "channel": message.channel,
            "body": message.body,
        }
        for message in messages
    ]

    # Slicing each queryset to the cap BEFORE this merge is exact, not an
    # approximation: both sides are already newest-first, so the merged top
    # N can only be drawn from each side's top N. See Story 20
    # `## Prerequisites`.
    entries.sort(key=lambda entry: entry["occurred_at"], reverse=True)
    return entries[:TIMELINE_MAX_ENTRIES]
```

`select_related("category")` is what keeps `category_name` from costing one extra query per ticket — the same reasoning `TicketViewSet.queryset` documents for `customer`/`category` (Story 18). `message.ticket_id` needs no join: it is a column on the row.

---

### 2 — The endpoint

**File: `backend/apps/customers/views.py`** — extend imports, add one `permission_map` entry, and append the action to `CustomerViewSet`:

```python
from django.utils.translation import gettext_lazy as _
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.core.permissions import Permissions, permissions_for
from apps.core.views import BaseModelViewSet

from .models import ContactDetail, Customer
from .serializers import ContactDetailSerializer, CustomerSerializer
from .timeline import build_timeline
```

Inside `CustomerViewSet`, add the `"timeline"` entry to `permission_map`:

```python
    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
        # Keyed by the @action's own method name — DRF sets
        # `self.action = "timeline"` for it (verified, see Story 20
        # `## Prerequisites`). Without this entry the action would fall
        # through to authenticated-only, NOT be denied.
        "timeline": Permissions.CUSTOMERS_VIEW,
    }
```

and append the action after `search_fields`:

```python
    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        """A customer's full interaction history — CUST-3. The router
        generates `/api/customers/<pk>/timeline/` from this decorator; no
        `urls.py` change is needed (verified, see Story 20
        `## Prerequisites`).

        Permission-checked twice on purpose: `permission_map` gates it on
        `customers.view` like every other read here, and the explicit check
        below adds `tickets.view`, because the payload is ticket and message
        data that `TicketViewSet`/`MessageViewSet` both gate that way. The
        same "permission-checked, not just authenticated" move Story 16's
        `TicketChatConsumer` made. See Story 20 `## Prerequisites`.
        """
        if Permissions.TICKETS_VIEW not in permissions_for(request.user):
            raise PermissionDenied()
        customer = self.get_object()
        return Response(build_timeline(customer))
```

**No `apps/customers/urls.py` change.** **No migration.** **No serializer change** — `build_timeline` returns plain dicts, the same shape `HealthView`/`LiveChatStartView`/`WebFormSubmissionView` already return, and `EnvelopeJSONRenderer` wraps them; DRF's JSON encoder serialises the `datetime` values in `occurred_at` to ISO-8601 strings, exactly as it does for every `created_at` a `ModelSerializer` emits.

Endpoint: `GET /api/customers/<id>/timeline/`.

---

## Frontend Tasks

### 3 — Timeline types

**Create file: `frontend/src/features/customers/types/timelineEntry.ts`**

```ts
/** `as const` arrays, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`).
 * These duplicate `features/tickets`' own unions on purpose: a feature never
 * imports from another feature (CONVENTIONS.md §15), and the label keys live
 * in this feature's own locale namespace. */
export const TIMELINE_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
export type TimelineTicketStatus = (typeof TIMELINE_TICKET_STATUSES)[number]

export const TIMELINE_MESSAGE_CHANNELS = [
  'email',
  'whatsapp',
  'chat',
  'sms',
  'web_form',
] as const
export type TimelineMessageChannel = (typeof TIMELINE_MESSAGE_CHANNELS)[number]

export type TimelineMessageDirection = 'inbound' | 'outbound'

/** Mirrors the `kind: "ticket"` entries `apps.customers.timeline.build_timeline`
 * emits. `id` is the ticket's own id and is NOT unique across kinds — see
 * `timelineEntryKey` below. */
export type TimelineTicketEntry = {
  kind: 'ticket'
  id: number
  occurred_at: string
  ticket_id: number
  subject: string
  status: TimelineTicketStatus
  priority: string
  category_name: string | null
}

/** Mirrors the `kind: "message"` entries `build_timeline` emits. */
export type TimelineMessageEntry = {
  kind: 'message'
  id: number
  occurred_at: string
  ticket_id: number
  direction: TimelineMessageDirection
  channel: TimelineMessageChannel
  body: string
}

/** A discriminated union on `kind` — narrow with `entry.kind === 'ticket'`. */
export type TimelineEntry = TimelineTicketEntry | TimelineMessageEntry

/**
 * `id` alone is NOT a stable React key: a ticket and a message can share the
 * same numeric id, which would collide in the list and make React reuse the
 * wrong node. Key on the pair.
 */
export function timelineEntryKey(entry: TimelineEntry): string {
  return `${entry.kind}-${entry.id}`
}
```

---

### 4 — Timeline API layer

**Create file: `frontend/src/features/customers/api/getCustomerTimeline.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { TimelineEntry } from '../types/timelineEntry'

// A plain array, not a paginated `Page<T>` — the endpoint merges two
// querysets in Python, so DRF's queryset pagination does not apply and the
// backend caps the result at its own `TIMELINE_MAX_ENTRIES` (100) instead.
// Same shape as `features/web-form/api/getWebFormCategories.ts` (Story 19).
export function getCustomerTimeline(customerId: number): Promise<TimelineEntry[]> {
  return api.get<TimelineEntry[]>(`/customers/${customerId}/timeline/`)
}
```

**Create file: `frontend/src/features/customers/api/useCustomerTimeline.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getCustomerTimeline } from './getCustomerTimeline'

/**
 * Read-only. Nothing invalidates this key: the tickets and messages it
 * aggregates are created in `features/tickets`, which cannot reach
 * `customerKeys` (CONVENTIONS.md §15). The query client's 30s `staleTime`
 * is what refreshes it — see Story 20 `## Edge Cases`.
 */
export function useCustomerTimeline(customerId: number) {
  return useQuery({
    queryKey: customerKeys.resource('timeline', customerId),
    queryFn: () => getCustomerTimeline(customerId),
  })
}
```

---

### 5 — The timeline section

**Create file: `frontend/src/features/customers/components/InteractionTimelineSection.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { useCustomerTimeline } from '../api/useCustomerTimeline'
import { timelineEntryKey } from '../types/timelineEntry'
import type { TimelineEntry, TimelineMessageEntry, TimelineTicketEntry } from '../types/timelineEntry'

/**
 * The customer's interaction history — CUST-3. A `<ul>`, not a `DataTable`:
 * `DataTable` is for one homogeneous, server-sortable row type, and this is
 * a heterogeneous unpaginated feed of two shapes. `ContactDetailsSection`'s
 * own `<ul>` is the in-project precedent. See Story 20 `## Product rules`.
 */
export function InteractionTimelineSection({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const query = useCustomerTimeline(customerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('timeline.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          query={query}
          isEmpty={(entries) => entries.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('timeline.empty')}</p>}
        >
          {(entries) => (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <TimelineRow key={timelineEntryKey(entry)} entry={entry} />
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  return entry.kind === 'ticket' ? (
    <TicketRow entry={entry} />
  ) : (
    <MessageRow entry={entry} />
  )
}

function TicketRow({ entry }: { entry: TimelineTicketEntry }) {
  const { t } = useTranslation('customers')
  const { dateTime } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge>{t('timeline.kinds.ticket')}</Badge>
        <Badge variant="secondary">{t(`timeline.statuses.${entry.status}`)}</Badge>
        {entry.category_name ? <Badge variant="outline">{entry.category_name}</Badge> : null}
        <span>{dateTime(entry.occurred_at)}</span>
      </div>
      <Link to={`/tickets/${entry.ticket_id}`} className="hover:underline">
        {entry.subject}
      </Link>
    </li>
  )
}

function MessageRow({ entry }: { entry: TimelineMessageEntry }) {
  const { t } = useTranslation('customers')
  const { dateTime } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={entry.direction === 'outbound' ? 'default' : 'secondary'}>
          {t(`timeline.directions.${entry.direction}`)}
        </Badge>
        <Badge variant="outline">{t(`timeline.channels.${entry.channel}`)}</Badge>
        <Link to={`/tickets/${entry.ticket_id}`} className="hover:underline">
          {t('timeline.onTicket', { id: entry.ticket_id })}
        </Link>
        <span>{dateTime(entry.occurred_at)}</span>
      </div>
      {/* No forced `dir="ltr"` — a message body is free-form prose that may
          itself be Arabic, the same call `TicketConversation.tsx` made
          (Story 13). Contrast `ContactDetailRow`'s Latin-only value. */}
      <p className="whitespace-pre-wrap">{entry.body}</p>
    </li>
  )
}
```

---

### 6 — Wire it into the profile

**File: `frontend/src/features/customers/components/CustomerProfilePage.tsx`** — one import plus one line, directly after the existing `<ContactDetailsSection … />` (line 91):

```tsx
import { InteractionTimelineSection } from './InteractionTimelineSection'
```

```tsx
              <ContactDetailsSection customerId={customer.id} />
              <InteractionTimelineSection customerId={customer.id} />
```

Nothing else on this page changes — the detail card, the delete flow, and the `isValidId`/`QueryBoundary` structure are untouched.

---

### 7 — Locale keys

**File: `frontend/src/features/customers/locales/en.json`** — add a `timeline` block as a new top-level key (after `contacts`):

```json
  "timeline": {
    "title": "Interaction history",
    "empty": "No tickets or messages yet.",
    "onTicket": "On ticket #{{id}}",
    "kinds": {
      "ticket": "Ticket opened"
    },
    "statuses": {
      "open": "Open",
      "in_progress": "In progress",
      "resolved": "Resolved",
      "closed": "Closed"
    },
    "directions": {
      "inbound": "Customer",
      "outbound": "Agent"
    },
    "channels": {
      "email": "Email",
      "whatsapp": "WhatsApp",
      "chat": "Live chat",
      "sms": "SMS",
      "web_form": "Web form"
    }
  }
```

**File: `frontend/src/features/customers/locales/ar.json`** — the identical key set, translated:

```json
  "timeline": {
    "title": "سجل التفاعلات",
    "empty": "لا توجد تذاكر أو رسائل بعد.",
    "onTicket": "على التذكرة رقم {{id}}",
    "kinds": {
      "ticket": "تم فتح تذكرة"
    },
    "statuses": {
      "open": "مفتوحة",
      "in_progress": "قيد المعالجة",
      "resolved": "تم الحل",
      "closed": "مغلقة"
    },
    "directions": {
      "inbound": "العميل",
      "outbound": "الوكيل"
    },
    "channels": {
      "email": "البريد الإلكتروني",
      "whatsapp": "واتساب",
      "chat": "الدردشة المباشرة",
      "sms": "رسالة نصية",
      "web_form": "نموذج الويب"
    }
  }
```

The `statuses`/`directions`/`channels` values duplicate `features/tickets`' own locale strings verbatim. That is the documented cost of § 15's feature boundary, the same duplication `getCustomerOptions.ts`/`CustomerOption` already pay on the backend-shape side — **no `resources.ts` change**, since `customers` is already a registered namespace.

---

## Documentation Tasks

### 8 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 19's paragraph):

> **An aggregate read that spans several apps belongs to the app that owns the *question*, not the apps that own the rows.** `apps/customers/timeline.py` (Story 20, `CUST-3`) reads `Ticket` and `Message` to answer "what has happened with this customer," because `backend/apps/README.md`'s app-purpose table assigns interaction history to `customers`. That is a reverse-direction cross-app import (the models dependency runs `customers ← tickets ← communications`) and it is safe **as long as no model imports across apps** — Django loads every model before any view or helper module, so only a model-level cycle can actually deadlock. **A custom `@action` on a `ModelViewSet` is gated by its own method name in `permission_map`** (`"timeline": …`), and — like any unmapped action — a missing entry falls through to authenticated-only rather than denying, so the entry is load-bearing. **When an aggregate's payload contains data another domain's endpoints gate separately, check that permission explicitly too** (`permissions_for(request.user)`), rather than letting the aggregate become a way around it. **A heterogeneous feed is a `<ul>`, not a `DataTable`** — § 19's rule covers homogeneous, server-sortable, paginated rows; a merged timeline of two record shapes has none of those properties, and its React key must combine the discriminator with the id (`${kind}-${id}`), because ids are only unique within a kind.

---

## Edge Cases & Failure Modes

- **A ticket id and a message id can be equal**, so `key={entry.id}` would collide and make React reuse the wrong DOM node between two unrelated entries. `timelineEntryKey()` (`${kind}-${id}`) is the fix, and it is the single most likely silent bug in this story.
- **A `customers.view`-only user gets `403`, not a partial timeline.** The explicit `permissions_for()` check rejects the whole request rather than filtering ticket/message entries out — a half-empty timeline would be more confusing than a clear denial. No seeded role currently hits this branch; `## Verification Steps` step 6 creates one to prove it.
- **A customer with no tickets returns `[]` and renders the empty state**, not an error — `QueryBoundary`'s `isEmpty` prop handles it, the same way `ContactDetailsSection` handles a customer with no contacts.
- **A customer with more than 100 combined entries silently shows only the 100 most recent.** There is no "load more" control and no indication in the UI that truncation happened. Accepted for this story's scope, matching the identical decision `getContactDetails.ts` documents for contacts; a future story adding pagination would change `build_timeline`'s signature, not just the cap.
- **The timeline goes stale after a ticket or message is created elsewhere.** Nothing invalidates `customerKeys.resource('timeline', id)` — `features/tickets`' mutations cannot reach `customerKeys` (§ 15). In practice the 30-second `staleTime` (verified in the query-client config) means navigating away and back refetches; staying on the profile while a ticket is created in another tab does not. Accepted, and the reason `useCustomerTimeline`'s docstring says so at the call site.
- **A message on a ticket whose customer was later reassigned** would appear under the *current* customer, because the query filters `Message.ticket__customer` live rather than snapshotting. There is no ticket-reassignment feature today (`Ticket.customer` is only set at creation), so this is unreachable — noted because `TKT-3`/a future edit flow could make it reachable.
- **A ticket whose category was deleted shows no category badge**, not a crash — `category_name` is `None` (Story 18's `SET_NULL`), and `TicketRow` renders the badge conditionally.
- **Arabic ticket subjects and message bodies render correctly with no `dir` override.** Deliberate, and the opposite call from `ContactDetailRow`'s `dir="ltr"` (a Latin-only email/phone value): free-form prose may itself be Arabic. Same reasoning `TicketConversation.tsx` records.
- **`occurred_at` is serialised by DRF's JSON encoder, not a serializer field.** Both source models use `TimeStampedModel.created_at` (`auto_now_add`, timezone-aware), so both entry kinds sort against each other correctly and both render as ISO-8601 — verify the two kinds interleave rather than clustering, which is what a naive string sort or a mixed naive/aware comparison would produce.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes**.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: the route exists at the router-generated URL, permission gating on both `customers.view` and `tickets.view`, chronological interleaving of both entry kinds, the empty case, and a `404` for an unknown customer — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new timeline section.
6. An `en`/`ar` key-set comparison for `features/customers/locales/` (a throwaway script, not a checked-in test) — confirms both files declare the same keys after task 7.

---

## Migration / Rollback

**No migration.** No model changes, no new dependency.

**Rollback of the code:** revert the commits. Nothing to un-apply.

**Half-applied states to avoid:**

- **The `@action` added without the `"timeline"` entry in `permission_map`.** This does **not** 403 — it silently becomes authenticated-only, so any signed-in user with no permissions at all could read a customer's whole history. This is the single highest-risk mistake in this story; `## Verification Steps` step 6 is what catches it.
- **The explicit `permissions_for()` check dropped as "redundant."** It is not redundant with `permission_map` — that gate only checks `customers.view`. Removing it reopens the ticket-data leak.
- **Each queryset sliced *after* the merge instead of before.** Still correct output, but loads every ticket and message for the customer into memory first — the exact failure mode the cap exists to prevent.
- **`key={entry.id}` instead of `timelineEntryKey(entry)`.** No error, no build failure; just wrong rendering when a ticket and a message share an id.
- **Task 6 (profile wiring) before task 5 (`InteractionTimelineSection.tsx`)** — the import fails to resolve, a `tsc` build failure, not a silent gap.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **No migration was needed:** `python manage.py makemigrations --check --dry-run` (project-wide) exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **The route exists where the router should have generated it.** With an agent token, `GET /api/customers/<id>/timeline/` on any existing customer → `200` and a JSON array (possibly empty). Confirm the URL needed no `urls.py` entry by checking `git diff -- backend/apps/customers/urls.py` is empty.
5. **A populated timeline interleaves both kinds, newest-first.** Seed: create a customer, then two tickets on it, then a message on each ticket (`POST /api/messages/` with `direction: "inbound"`, different channels — e.g. `email` and `sms`) so ticket and message timestamps alternate. `GET /api/customers/<id>/timeline/` → entries strictly descending by `occurred_at`, with `kind` values **interleaved**, not grouped into a tickets block followed by a messages block. Confirm a `kind: "ticket"` entry carries `subject`/`status`/`category_name` and a `kind: "message"` entry carries `direction`/`channel`/`body`, and that both carry `ticket_id`.
6. **Permission gating, both halves.** (a) No `Authorization` header → `401`. (b) Create a throwaway role holding **only** `customers.view` and a user in it (via `manage.py shell`, the same approach Story 16's verification used for its no-permission user); with that user's token, `GET /api/customers/<id>/timeline/` → **`403`**, while `GET /api/customers/<id>/` → `200` (proving the extra `tickets.view` check is what denied it, not the base gate). (c) With the normal agent token → `200`. **Delete the throwaway role and user afterwards.**
7. **An unknown customer is a clean 404.** `GET /api/customers/999999/timeline/` with an agent token → `404` in envelope form (via `get_object()`), not a `500`.
8. **A customer with no tickets returns an empty array.** Create a fresh customer, `GET` its timeline → `200`, `[]`.
9. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in as an agent:
   - Open `/customers/<id>` for the customer seeded in step 5 — a third card, "Interaction history", renders below "Contact channels", listing both tickets and messages newest-first with translated status/direction/channel badges and a formatted date **and time**.
   - Click a ticket subject and a message's "On ticket #N" link — both navigate to that ticket's detail page.
   - Open a customer with no history — the card shows the empty message, not a spinner or an error.
   - Switch to Arabic — every badge and label translates, the `{{id}}` interpolation in "On ticket #N" renders, and the layout reads correctly in RTL (no clipped or reversed rows).
10. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
11. **Clean up** every record created for steps 5-8 (tickets first, then the customers — `Ticket.customer` is `PROTECT`), plus the throwaway role/user from step 6.

---

## Done Criteria

- [ ] `apps/customers/timeline.py` — `TIMELINE_MAX_ENTRIES = 100`, `build_timeline(customer)` merging tickets + messages newest-first, each queryset sliced to the cap **before** the merge, `select_related("category")` on the ticket side.
- [ ] `CustomerViewSet.timeline` — `@action(detail=True, methods=["get"], url_path="timeline")`, an explicit `Permissions.TICKETS_VIEW in permissions_for(request.user)` check, `self.get_object()` for the `404`/scoping, returning `build_timeline(customer)`.
- [ ] `permission_map` gains `"timeline": Permissions.CUSTOMERS_VIEW`.
- [ ] **No `apps/customers/urls.py` change, no migration, no new permission constant, no new dependency.**
- [ ] `features/customers/types/timelineEntry.ts` — the `kind`-discriminated union plus `timelineEntryKey()`.
- [ ] `features/customers/api/getCustomerTimeline.ts` (plain array, not `Page<T>`) and `useCustomerTimeline.ts` (`customerKeys.resource('timeline', customerId)`).
- [ ] `InteractionTimelineSection.tsx` — `Card` + `QueryBoundary` (with `isEmpty`/`empty`) + `<ul>`, ticket and message rows rendered by separate narrowed components, keys from `timelineEntryKey`, `dateTime` (not `date`) for timestamps.
- [ ] `CustomerProfilePage.tsx` — one import plus `<InteractionTimelineSection customerId={customer.id} />` after `<ContactDetailsSection … />`; nothing else on the page changed.
- [ ] `en.json`/`ar.json` — a `timeline` block with identical key sets in both languages; **no `resources.ts` change**.
- [ ] `CONVENTIONS.md` § 23 gains the aggregate-read-ownership / `@action`-permission-mapping / heterogeneous-feed paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: the router-generated route with no `urls.py` edit (Step 4); both kinds interleaved newest-first with their own fields (Step 5); `401`, `403`-for-`customers.view`-only, and `200`-for-agent (Step 6); `404` for an unknown customer (Step 7); `[]` for a customer with no history (Step 8).
- [ ] Both languages walk through cleanly in the browser, including both link targets and the `{{id}}` interpolation (Step 9).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record created during verification is cleaned up, including the throwaway `customers.view`-only role and user (Step 11).
- [ ] `.squad/plans/customer-management/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** The remaining `customer-management` story is **CUST-4 (Notes & Attachments)** (`SupportOs backlog.MD:296-302`), which depends only on `CUST-1` and is the first story in the project to need file upload and a documented storage location via `ENV`.
