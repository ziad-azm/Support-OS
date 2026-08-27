# Story 26 — Customer Context Panel (Story: SUPPORTOS-46)

## Prerequisites

- **Story 10 (CUST-1) and Story 12 (TKT-1) completed** — the intake names both (`Dependencies: CUST-1, TKT-1`). `Customer`/`CustomerSerializer` (`backend/apps/customers/serializers.py` lines 11-46) and `Ticket`/`TicketSerializer` (`backend/apps/tickets/models.py`/`serializers.py`) both exist and are unchanged by this story.
- **"Combined context API" (intake, task 1) reuses two already-built pieces rather than re-deriving either.** `apps/customers/serializers.py::CustomerSerializer` (Story 10) is the exact customer shape needed — no new serializer. `apps/customers/timeline.py::build_timeline` (Story 20) already answers "what has happened with this customer" across `Ticket`+`Message`; this story's own helper calls it directly and filters out the entries belonging to the ticket currently being viewed (see task 1's `build_ticket_context`), rather than writing a second, parallel history query.
- **The endpoint lives in `apps/tickets/`, not `apps/customers/`, even though most of its payload is customer data — because it is anchored by ticket id.** The intake's own two tasks make the anchor explicit: *"Combined context API"* is scoped to a ticket (the panel sits *beside ticket detail*, task 2), so `GET /api/tickets/<id>/context/` is a `TicketViewSet` action, the same way `GET /api/tickets/<id>/history/` (Story 24) is. `apps/tickets/context.py` importing `apps.customers.serializers.CustomerSerializer` and `apps.customers.timeline.build_timeline` is a reverse-direction import with direct precedent (`apps/customers/timeline.py` already imports `apps.tickets.models`/`apps.communications.models`, Story 20) — verified safe: neither `apps.customers.serializers` nor `apps.customers.timeline` imports anything back from `apps.tickets.views`/`apps.tickets.context`, so no cycle, only a one-way dependency at the leaf (helper-module) level.
- **This endpoint needs a permission check `CustomerViewSet.timeline` (Story 20) never did — but for the same reason, mirrored.** `CustomerViewSet.timeline`'s payload spans into `tickets`-gated data, so it explicitly re-checks `tickets.view` on top of its own `customers.view` gate (`apps/customers/views.py` lines 52-69). This story is the mirror image: a **ticket**-gated action (`permission_map["context"] = TICKETS_VIEW`) whose payload includes **customer** data, so it explicitly re-checks `customers.view` too — otherwise a `tickets.view`-only user (who may hold no `customers.view` at all — the two permissions are independent grants) could read full customer records through this side door, bypassing `CustomerViewSet`'s own gate entirely.
- **"Recent-history" deliberately excludes the ticket being viewed.** `TicketDetailPage` (Story 12 onward) already shows this ticket's own full detail, conversation (Story 13), and activity history (Story 24, `TicketHistorySection`) in the main column. A context panel that repeated the same ticket's own data would add nothing; the entire point is showing what **else** has happened with this customer. `build_timeline`'s entries all carry a `ticket_id` key (verified — both its `"ticket"`-kind and `"message"`-kind entries set it, `apps/customers/timeline.py` lines 44 and 59), which makes the exclusion a single filter, not a second query.
- **This is the project's first two-column/side-panel screen layout.** No existing page (`CustomerProfilePage`, `TicketDetailPage`, any list screen) uses more than a single stacked column. The grid this story adds to `TicketDetailPage` (task 6) uses Tailwind's arbitrary-value `grid-template-columns` syntax already present elsewhere in this codebase's own primitives (`grid-cols-[0_1fr]` in `shared/ui/primitives/alert.tsx`, `grid-cols-[1fr_auto]` in `card.tsx`) — not a new idiom, just its first use at the page-layout level.
- **The frontend panel duplicates `Customer`'s shape and `TimelineEntry`'s shape locally, rather than importing either from `features/customers`.** Same rule `features/customers/types/timelineEntry.ts` already follows in the opposite direction (its own docstring: *"a feature never imports from another feature... the label keys live in this feature's own locale namespace"*, Story 20) — `no-restricted-imports` (`CONVENTIONS.md` §15) forbids the cross-feature import regardless of which direction it would run.
- **No new permission constant.** `backend/apps/core/permissions.py` lines 26-32 confirm `TICKETS_VIEW`/`CUSTOMERS_VIEW` already exist and cover everything this story touches.

---

## Story Goal

1. **Combined context API**: `GET /api/tickets/<id>/context/` (gated `tickets.view` **and** `customers.view`, both checked) returns `{"customer": {...CustomerSerializer fields...}, "recent_history": [...up to 5 entries, newest-first, excluding this ticket...]}` via a new `apps/tickets/context.py::build_ticket_context`.
2. **Context side panel UI**: a new `CustomerContextPanel` rendered beside `TicketDetailPage`'s main content in a two-column layout — the customer's core fields plus their recent cross-ticket activity, so an agent never has to navigate to `/customers/<id>` mid-conversation.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/tickets/context.py::build_ticket_context` | "Combined context API... ticket+customer+recent-history" (intake) — one call combining two already-built pieces. |
| `GET /tickets/<id>/context/`, double permission check | "one call for context" (intake) — and the same domain-spanning-payload rule Story 20 established, mirrored. |
| `CustomerContextPanel`, two-column `TicketDetailPage` layout | "reusable side panel beside ticket detail... context without screen switching" (intake). |

**Not here, and why:**

- **No editing from the panel.** The intake's outcome is "context without screen switching," not "editing without screen switching" — the panel is read-only; editing the customer still goes through `/customers/<id>/edit`. `CustomerFormPage` is unchanged.
- **No new customer fields, notes, or attachments in the panel.** `NotesSection`/`AttachmentsSection` (Story 21) stay on `CustomerProfilePage` only — duplicating them here would be a second, harder-to-keep-in-sync copy of already-built UI, and the intake names only "ticket+customer+recent-history," not notes/attachments.
- **No live/real-time updates to the panel.** Same accepted limitation `useCustomerTimeline` (Story 20) already documents for the profile timeline — a `useQuery`-backed read, refreshed by `staleTime`, not a subscription. See `## Edge Cases & Failure Modes`.
- **No reuse of this panel on any other screen in this story.** It is built as a standalone, ticket-id-scoped component — genuinely reusable in shape, but its only consumer here is `TicketDetailPage`. A second consumer is a future story's call, not invented now.
- **No pagination on `recent_history`.** Same reasoning `build_timeline`'s own 100-entry cap already established (Story 20) — this is a short preview (5 entries), not a browsable list; the "View full profile" link is where an agent goes for everything.

---

## Context — Read These Files First

1. `.squad/stories/agent-workspace/SUPPORTOS-46/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 418-423 (`EPIC 6`, `STORY (AGENT-2) — Customer Context Panel`) — re-verified against the file directly (see Story 25's own correction of an earlier mis-citation, `.squad/plans/agent-workspace/00-overview.md`).
3. `backend/apps/customers/timeline.py` (71 lines, Story 20) — read in full: `build_timeline`'s entry shape (lines 41-64, both kinds carry `ticket_id`) and the "slice each side to the cap before merging is exact" reasoning (lines 66-70) task 1 relies on.
4. `backend/apps/customers/serializers.py` lines 11-46 — `CustomerSerializer`, instantiated directly (`CustomerSerializer(customer).data`) with no `context={'request': ...}` needed — verified: it declares no request-dependent field (no file/URL field, unlike `AttachmentSerializer`).
5. `backend/apps/customers/views.py` lines 52-69 — `CustomerViewSet.timeline`: the exact double-permission-check shape (`permissions_for`/`PermissionDenied`) task 2's `context` action mirrors in the opposite direction.
6. `backend/apps/tickets/views.py` (251 lines, after Story 25) — imports (lines 1-14), `permission_map` (lines 46-65), and `history` (lines 240-251, the most recent action) — task 2's `context` action is appended after it, following the identical `@action`/docstring/`self.get_object()`/`Response(...)` shape.
7. `backend/apps/tickets/history.py` (Story 24) — the placement/shape precedent for a same-app "combine two pieces into one dict" helper module; `apps/tickets/context.py` (task 1) follows the same shape one level further (a nested object, not a merged list).
8. `frontend/src/features/customers/types/timelineEntry.ts` (49 lines, Story 20) — read in full: the exact duplicate-the-union-locally reasoning task 3's `types/ticketContext.ts` follows, this time duplicating `Customer`'s shape too (not just the ticket/message unions).
9. `frontend/src/features/customers/types/customer.ts` (19 lines) — `Customer`'s exact field types (`email: string | null`, `phone`/`company: string`, never null) — task 3's `TicketContextCustomer` mirrors this verbatim.
10. `frontend/src/features/customers/components/InteractionTimelineSection.tsx` (97 lines, Story 20) — the `TicketRow`/`MessageRow` shape task 5's `CustomerContextPanel` row components adapt (narrower: no category badge, no channel badge — a compact panel, not a full-width timeline; see task 5).
11. `frontend/src/features/tickets/components/TicketDetailPage.tsx` (190 lines, after Story 24) — the `<>...</>` fragment (lines 76-181) wrapping the main `Card`/`TicketConversation`/`TicketHistorySection` — task 6 wraps this in a left-column `<div>` inside a new two-column grid, with `CustomerContextPanel` as the right column.
12. `frontend/src/shared/ui/primitives/alert.tsx` line 7 and `card.tsx` line 23 — confirms arbitrary-value `grid-cols-[...]` is an established Tailwind idiom in this codebase, reused (not invented) by task 6's page-level grid.
13. `frontend/src/features/tickets/locales/en.json`/`ar.json` (111 lines each, after Story 25) — the `escalation`/`history` blocks' nesting shape task 7's new `context` block follows.
14. `CONVENTIONS.md` §15 (import conventions), §20's aggregate-read paragraph (Story 20 — "an aggregate read that spans several apps belongs to the app that owns the question"), §23 (feature module conventions).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Combined ticket+customer+recent-history endpoint, one call.** | Intake, task 1 | `apps/tickets/context.py::build_ticket_context`; `GET /tickets/<id>/context/`. |
| **Reusable side panel beside ticket detail.** | Intake, task 2 | `CustomerContextPanel`, rendered in `TicketDetailPage`'s new right column. |
| **A payload spanning two permission domains checks both explicitly.** | Story 20's own rule (CUST-3), mirrored | `context` action checks `customers.view` on top of its `permission_map["context"] = TICKETS_VIEW` gate. |
| **Recent history excludes the ticket currently being viewed.** | This story's design | `build_ticket_context` filters `build_timeline`'s entries by `ticket_id != ticket.id`. |
| **The panel is read-only.** | Intake's own framing ("context without screen switching," not editing) | No mutation hooks, no form, in `CustomerContextPanel`. |
| Wire format is `snake_case` end to end; the UI translates, the API sends values. | §12 | `customer`, `recent_history`, `ticket_id`, `occurred_at`. |
| No new permission constant, no new dependency. | §17, §22 | Reuses `TICKETS_VIEW`/`CUSTOMERS_VIEW`. |

---

## Backend Tasks

### 1 — The combined-context helper

**Create file: `backend/apps/tickets/context.py`**

```python
"""Combined ticket+customer+recent-history context — AGENT-2.

Lives in `apps.tickets`: the endpoint is anchored by ticket id (the panel
sits beside the ticket detail screen), even though most of the payload is
customer data. Reuses `apps.customers.serializers.CustomerSerializer` and
`apps.customers.timeline.build_timeline` (Story 20) rather than re-deriving
either. Reverse-direction import, verified safe — the same precedent
`apps/customers/timeline.py` already set importing `apps.tickets.models`:
neither `apps.customers.serializers` nor `apps.customers.timeline` imports
anything back from `apps.tickets.views`/`apps.tickets.context`, so there is
no cycle, only a one-way leaf-module dependency. See Story 26
`## Prerequisites`.
"""

from apps.customers.serializers import CustomerSerializer
from apps.customers.timeline import build_timeline

from .models import Ticket

# A short preview, not the full profile timeline (`TIMELINE_MAX_ENTRIES`,
# 100, apps/customers/timeline.py) — the panel shows recent context at a
# glance; the customer's own profile page is where an agent goes for the
# complete history.
CONTEXT_HISTORY_MAX_ENTRIES = 5


def build_ticket_context(ticket: Ticket) -> dict:
    """The customer behind this ticket, plus their most recent activity
    EXCLUDING this same ticket — `TicketDetailPage` already shows this
    ticket's own detail, conversation, and history in full; the point of
    this panel is what else has happened with this customer. Every
    `build_timeline` entry carries `ticket_id`, for both its "ticket" and
    "message" kinds, which makes the exclusion a single filter.
    """
    customer = ticket.customer
    history = [
        entry for entry in build_timeline(customer) if entry["ticket_id"] != ticket.id
    ][:CONTEXT_HISTORY_MAX_ENTRIES]
    return {
        "customer": CustomerSerializer(customer).data,
        "recent_history": history,
    }
```

---

### 2 — Views: the `context` action

**File: `backend/apps/tickets/views.py`** — extend imports:

```python
from rest_framework.exceptions import PermissionDenied, ValidationError
```

```python
from apps.core.permissions import Permissions, permissions_for
```

```python
from .context import build_ticket_context
```

(The first two lines replace the existing single-symbol imports on the same lines; the third is a new import alongside the other same-app helper imports.)

Add the `context` permission_map entry (alongside the existing five):

```python
        "context": Permissions.TICKETS_VIEW,
```

Append the `context` action, after `history` (the current last action):

```python
    @action(detail=True, methods=["get"], url_path="context")
    def context(self, request, pk=None):
        """Combined ticket+customer+recent-history context for the side
        panel — AGENT-2. Permission-checked twice on purpose, the mirror
        image of `CustomerViewSet.timeline` (Story 20): `permission_map`
        gates this on `tickets.view` like every other read here, and the
        explicit check below adds `customers.view`, because the payload
        includes a full customer record that `CustomerViewSet` gates that
        way. See Story 26 `## Prerequisites`.
        """
        if Permissions.CUSTOMERS_VIEW not in permissions_for(request.user):
            raise PermissionDenied()
        ticket = self.get_object()
        return Response(build_ticket_context(ticket))
```

**No `apps/tickets/urls.py` change** (router-generated, `detail=True`, like every prior action). **No migration** — no model or field change. Endpoint: `GET /api/tickets/<id>/context/`.

---

## Frontend Tasks

### 3 — Context types

**Create file: `frontend/src/features/tickets/types/ticketContext.ts`**

```ts
import type { MessageChannel, MessageDirection } from './message'
import type { TicketStatus } from './ticket'

/**
 * Mirrors `apps.customers.serializers.CustomerSerializer` — the same
 * shape `features/customers/types/customer.ts` declares, duplicated here
 * because `features/tickets` cannot import from `features/customers`
 * (CONVENTIONS.md §15). See Story 26 `## Prerequisites`.
 */
export type TicketContextCustomer = {
  id: number
  name: string
  email: string | null
  phone: string
  company: string
  created_at: string
  updated_at: string
}

/** Mirrors the `kind: "ticket"` entries `apps.tickets.context.build_ticket_context`
 * emits (via `build_timeline`), minus the fields the compact panel row
 * does not render. */
export type TicketContextTicketEntry = {
  kind: 'ticket'
  id: number
  occurred_at: string
  ticket_id: number
  subject: string
  status: TicketStatus
}

/** Mirrors the `kind: "message"` entries emitted the same way. */
export type TicketContextMessageEntry = {
  kind: 'message'
  id: number
  occurred_at: string
  ticket_id: number
  direction: MessageDirection
  channel: MessageChannel
  body: string
}

export type TicketContextEntry = TicketContextTicketEntry | TicketContextMessageEntry

/** Mirrors `apps.tickets.context.build_ticket_context`'s top-level shape. */
export type TicketContext = {
  customer: TicketContextCustomer
  recent_history: TicketContextEntry[]
}

/** `id` alone is not a stable React key across kinds — same reasoning as
 * `timelineEntryKey` (Story 20) and `ticketHistoryEntryKey` (Story 24). */
export function ticketContextEntryKey(entry: TicketContextEntry): string {
  return `${entry.kind}-${entry.id}`
}
```

---

### 4 — Context API layer

**Create file: `frontend/src/features/tickets/api/getTicketContext.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { TicketContext } from '../types/ticketContext'

// A plain object, not a paginated `Page<T>` — same reasoning as
// `getTicketHistory.ts` (Story 24): the endpoint returns one combined
// payload, already capped server-side.
export function getTicketContext(ticketId: number): Promise<TicketContext> {
  return api.get<TicketContext>(`/tickets/${ticketId}/context/`)
}
```

**Create file: `frontend/src/features/tickets/api/useTicketContext.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getTicketContext } from './getTicketContext'
import { ticketKeys } from './ticketKeys'

/**
 * Read-only. `recent_history` deliberately excludes this ticket's own
 * activity (see `## Prerequisites`), so none of this ticket's own
 * mutations (`useAssignTicket`, `useSetTicketStatus`, `useCreateMessage`)
 * need to invalidate this key — nothing they change is reflected in this
 * panel's data by design. What COULD change this panel's data is an event
 * on a DIFFERENT ticket for the same customer, or an edit to the customer
 * record itself (`features/customers`) — neither is reachable from
 * `features/tickets` (§15), the same cross-feature gap
 * `useCustomerTimeline`'s own docstring already accepts for the reverse
 * direction (Story 20). `staleTime` is what eventually refreshes it.
 */
export function useTicketContext(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('context', ticketId),
    queryFn: () => getTicketContext(ticketId),
  })
}
```

---

### 5 — The context panel

**Create file: `frontend/src/features/tickets/components/CustomerContextPanel.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { useTicketContext } from '../api/useTicketContext'
import { ticketContextEntryKey } from '../types/ticketContext'
import type {
  TicketContextEntry,
  TicketContextMessageEntry,
  TicketContextTicketEntry,
} from '../types/ticketContext'

/**
 * AGENT-2 — the customer behind this ticket, plus their recent activity
 * elsewhere, shown beside the ticket detail screen so an agent never has
 * to leave it for context. Read-only: editing the customer still goes
 * through `/customers/<id>/edit`. See Story 26 `## Prerequisites`.
 */
export function CustomerContextPanel({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const query = useTicketContext(ticketId)

  return (
    <QueryBoundary query={query}>
      {(context) => (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('context.customerTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link
                to={`/customers/${context.customer.id}`}
                className="font-medium hover:underline"
              >
                {context.customer.name}
              </Link>
              <dl className="flex flex-col gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t('context.email')}</dt>
                  <dd>{context.customer.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('context.phone')}</dt>
                  <dd>{context.customer.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('context.company')}</dt>
                  <dd>{context.customer.company || '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('context.historyTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {context.recent_history.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('context.historyEmpty')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {context.recent_history.map((entry) => (
                    <ContextEntryRow key={ticketContextEntryKey(entry)} entry={entry} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </QueryBoundary>
  )
}

function ContextEntryRow({ entry }: { entry: TicketContextEntry }) {
  return entry.kind === 'ticket' ? (
    <ContextTicketRow entry={entry} />
  ) : (
    <ContextMessageRow entry={entry} />
  )
}

function ContextTicketRow({ entry }: { entry: TicketContextTicketEntry }) {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-2 text-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{t(`statuses.${entry.status}`)}</Badge>
        <span>{date(entry.occurred_at)}</span>
      </div>
      <Link to={`/tickets/${entry.ticket_id}`} className="hover:underline">
        {entry.subject}
      </Link>
    </li>
  )
}

function ContextMessageRow({ entry }: { entry: TicketContextMessageEntry }) {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={entry.direction === 'outbound' ? 'default' : 'secondary'}>
          {t(`conversation.directions.${entry.direction}`)}
        </Badge>
        <Link to={`/tickets/${entry.ticket_id}`} className="hover:underline">
          {t('context.onTicket', { id: entry.ticket_id })}
        </Link>
        <span>{date(entry.occurred_at)}</span>
      </div>
      {/* No forced `dir="ltr"` — same reasoning every other message body
          render in this feature uses: free-form prose that may itself be
          Arabic. `line-clamp-2` (already used, `shared/ui/primitives
          /alert.tsx`) keeps a long reply from dominating the narrow panel. */}
      <p className="line-clamp-2 whitespace-pre-wrap">{entry.body}</p>
    </li>
  )
}
```

---

### 6 — Ticket detail: two-column layout

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — one import:

```tsx
import { CustomerContextPanel } from './CustomerContextPanel'
```

(Add alongside the existing same-directory imports, keeping the block alphabetized.)

Replace the `QueryBoundary` render prop's `<>...</>` fragment (lines 76-181) with a two-column grid: the existing `Card`/`TicketConversation`/`TicketHistorySection` become the left column, `CustomerContextPanel` the new right column.

```tsx
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:items-start">
              <div className="flex flex-col gap-4">
                <Card>
                  {/* ... unchanged Card content ... */}
                </Card>
                <TicketConversation ticketId={ticket.id} />
                <TicketHistorySection ticketId={ticket.id} />
              </div>
              <CustomerContextPanel ticketId={ticket.id} />
            </div>
```

Everything inside the existing `Card` (lines 77-178) is **unchanged** — only its wrapping fragment becomes a two-`<div>` grid, and `CustomerContextPanel` is added as the grid's second child. On narrow viewports (`grid-cols-1`, the default), the panel stacks below the main content; at `lg:` and above it sits beside it, matching the intake's "beside ticket detail" wording.

---

### 7 — Locale keys

**File: `frontend/src/features/tickets/locales/en.json`** — one new top-level `context` block:

```json
  "context": {
    "customerTitle": "Customer",
    "email": "Email",
    "phone": "Phone",
    "company": "Company",
    "historyTitle": "Recent History",
    "historyEmpty": "No other recent activity.",
    "onTicket": "On ticket #{{id}}"
  },
```

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
  "context": {
    "customerTitle": "العميل",
    "email": "البريد الإلكتروني",
    "phone": "الهاتف",
    "company": "الشركة",
    "historyTitle": "النشاط الأخير",
    "historyEmpty": "لا يوجد نشاط آخر حديث.",
    "onTicket": "على التذكرة رقم {{id}}"
  },
```

No `resources.ts` change — `tickets` is already a registered namespace. These are new, self-contained keys (not reused from `customers:fields.*`) — see `## Prerequisites` for why cross-namespace reuse is avoided here, matching `timelineEntry.ts`'s own precedent.

---

## Documentation Tasks

### 8 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 23. Feature module conventions` (after Story 24's paragraph):

> **A payload that spans two permission domains checks both explicitly, regardless of which domain's action it hangs off.** `TicketViewSet.context` (Story 26, `AGENT-2`) is the mirror image of `CustomerViewSet.timeline` (Story 20, `CUST-3`): where `timeline` is a `customers.view`-gated action whose payload reaches into `tickets`-gated data and re-checks `tickets.view`, `context` is a `tickets.view`-gated action whose payload includes a full customer record and re-checks `customers.view`. The direction of the anchor (which app the `@action` lives in) is decided by what the endpoint is *about* — here, "context for the ticket currently open" — not by which domain's data makes up more of the response. **Reusing another domain's own serializer for a sub-payload, not just its models, avoids a second declaration of the same shape.** `apps/tickets/context.py::build_ticket_context` calls `apps.customers.serializers.CustomerSerializer(customer).data` directly rather than hand-assembling a dict of customer fields — the same "reuse the target domain's already-built piece" instinct `apps/customers/timeline.py` (Story 20) established for `Ticket`/`Message`, extended here to a serializer, not just querysets. **The project's first two-column/side-panel page layout uses the same arbitrary-value `grid-cols-[...]` syntax already present in this codebase's own UI primitives** (`alert.tsx`, `card.tsx`) — `TicketDetailPage`'s new grid is that idiom's first use at the page level, not a new pattern.

---

### 9 — Overview

**File: `.squad/plans/agent-workspace/00-overview.md`** — add this story's row to the `## Stories` table and a dependency-notes paragraph summarizing: the double-permission-check mirroring `CUST-3`, the `recent_history`-excludes-current-ticket design, and the first-side-panel-layout note.

---

## Edge Cases & Failure Modes

- **A `tickets.view`-only user with no `customers.view` gets a `403` from `GET .../context/`**, not a partial/redacted payload — the explicit check raises before `self.get_object()` runs, mirroring `CustomerViewSet.timeline`'s exact failure mode.
- **A customer with no other tickets or messages** (this is their first, or only, interaction) sees `context.historyEmpty` ("No other recent activity."), not an error — `recent_history` is simply `[]`.
- **`recent_history` never includes this ticket's own messages or its own "ticket" entry**, even on a ticket with a long conversation — the `ticket_id != ticket.id` filter excludes both kinds uniformly, since `build_timeline` sets `ticket_id` on every entry regardless of kind.
- **The panel does not refresh when a DIFFERENT ticket for the same customer changes** (status, assignment, a new reply) — no invalidation wiring reaches across tickets for this query key; it refreshes on `staleTime` like `useCustomerTimeline` already does. Reloading the page or navigating away and back refreshes it immediately.
- **The panel does not refresh when the customer's own record is edited** via `/customers/<id>/edit` — that mutation lives in `features/customers` and cannot invalidate a `features/tickets` query key (§15). Same accepted cross-feature gap, not new to this story.
- **On a narrow viewport, the panel stacks below the main ticket content**, not beside it — `grid-cols-1` is the default, `lg:grid-cols-[...]` only applies at the `lg` breakpoint and above. This is deliberate, not a bug: a side-by-side layout below `lg` would leave both columns too narrow to be usable.
- **A customer's `email` is `null`, `phone`/`company` are empty strings** (never `null`) — the panel renders `—` for either case (`?? '—'` for `email`, `|| '—'` for `phone`/`company`), matching `CustomerProfilePage`'s own established fallback for the exact same fields.
- **Arabic customer names, ticket subjects, and message bodies round-trip correctly** — none of these are forced `dir="ltr"`, matching every other free-text render in this feature.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations --check --dry-run` (project-wide) — must report **no changes** (no model change in this story).
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: the combined payload's shape and content, the current-ticket exclusion, the double permission check (`403` without `customers.view` even when `tickets.view` is held, and vice versa), and an empty-history customer — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new panel and the layout change.
6. An `en`/`ar` key-set comparison for `features/tickets/locales/` (a throwaway script, not a checked-in test).

---

## Migration / Rollback

**No migration** — this story changes no model or field, only a new read-only action and frontend code.

**Rollback of the code:** revert the commits. No database state to unwind.

**Half-applied states to avoid:**

- **The `customers.view` check omitted or placed AFTER `self.get_object()`.** Omitting it entirely means any `tickets.view` holder can read full customer records regardless of their `customers.view` grant — the highest-risk mistake in this story, the same class Story 20's own `## Migration / Rollback` flagged for the reverse case. Placing it after `get_object()` is lower-risk but still wrong: it would leak whether a given ticket id exists (via a 404-vs-403 timing/response difference) to a caller who should be rejected outright.
- **`recent_history` filtering by `entry["id"] != ticket.id` instead of `entry["ticket_id"] != ticket.id`.** `"id"` is the ENTRY's own id (a ticket id for `kind: "ticket"` entries, but a MESSAGE id for `kind: "message"` entries) — filtering on it would fail to exclude this ticket's own messages, since a message's `id` is never equal to `ticket.id`.
- **`CustomerSerializer` instantiated with `context={'request': request}`** when it needs none — harmless here (verified, task 1's docstring/`## Context` note it declares no request-dependent field), but worth not copying forward as a habit into a future reuse of `CustomerSerializer` that does need one (e.g. if a URL-based field is ever added).

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **No migration generated:** `python manage.py makemigrations tickets` reports **no changes**; project-wide `makemigrations --check --dry-run` exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **The combined payload is correctly shaped.** Create a customer, and two tickets for them (`ticket-A`, `ticket-B`); send a reply on each. With a `tickets.manage`+`customers.view` token: `GET /api/tickets/<ticket-A id>/context/` → `200`, `data.customer` matches the customer's `CustomerSerializer` fields exactly, `data.recent_history` contains `ticket-B`'s "ticket" entry and its message, newest-first, and does **not** contain `ticket-A`'s own entry or its own message.
5. **An empty history renders correctly.** Create a fresh customer with exactly one ticket and no other tickets/messages. `GET /api/tickets/<that ticket's id>/context/` → `200`, `data.recent_history` is `[]`.
6. **The double permission check, both directions.** Using a throwaway role with `tickets.view` but **not** `customers.view`: `GET .../context/` → `403`. Using a throwaway role with `customers.view` but **not** `tickets.view`: `GET .../context/` → `403` (denied by `permission_map` before the explicit check even runs). With neither → `403`. With both → `200`. With no token → `401`.
7. **The full bilingual UI walkthrough.** `npm run dev` with the backend up, signed in with both permissions, viewing `ticket-A` from step 4:
   - The ticket detail page now shows a right-hand panel (at `lg`+ viewport width) with the customer's name (linking to `/customers/<id>`), email, phone, company, and a "Recent History" card listing `ticket-B`'s entries.
   - Resize the browser below the `lg` breakpoint — the panel moves below the main content instead of beside it.
   - Click the customer name link → lands on the full `/customers/<id>` profile.
   - Switch to Arabic — every label in both panel cards translates, and the layout reads correctly in RTL (panel on the visually-left side at `lg`+, matching RTL column order).
8. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.
9. **Clean up** every ticket, customer, and message created for steps 4-6, plus any throwaway role/user reused from a prior story's verification.

---

## Done Criteria

- [ ] `apps/tickets/context.py::build_ticket_context` — returns `{"customer": ..., "recent_history": [...]}`, excludes the current ticket's own entries, capped at `CONTEXT_HISTORY_MAX_ENTRIES` (5).
- [ ] `TicketViewSet.context` (`detail=True`, `GET`, `url_path="context"`) — `permission_map["context"] = TICKETS_VIEW`, plus an explicit `customers.view` check before `self.get_object()`.
- [ ] **No migration, no new permission constant, no `apps/tickets/urls.py` change.**
- [ ] `types/ticketContext.ts` — `TicketContextCustomer`/`TicketContextTicketEntry`/`TicketContextMessageEntry`/`TicketContext`, `ticketContextEntryKey`.
- [ ] `api/getTicketContext.ts`, `api/useTicketContext.ts` — plain-object fetch, no invalidation wiring needed from other ticket mutations (documented why).
- [ ] `CustomerContextPanel.tsx` — two `Card`s (customer fields, recent history), read-only, reusing the `TicketRow`/`MessageRow`-shaped rendering pattern in compact form.
- [ ] `TicketDetailPage.tsx` — the existing `Card`/`TicketConversation`/`TicketHistorySection` wrapped in a left-column `<div>` inside a new `grid grid-cols-1 lg:grid-cols-[...]` wrapper; `CustomerContextPanel` as the right column; **no change to the `Card`'s own contents**.
- [ ] `en.json`/`ar.json` — the new `context` block; identical key sets in both languages; **no `resources.ts` change**; no reuse of `customers:fields.*` (own self-contained keys).
- [ ] `CONVENTIONS.md` §23 gains the mirrored-double-permission-check / reuse-the-target-domain's-serializer / first-side-panel-layout paragraph.
- [ ] `python manage.py test` reports **54** passing; project-wide `makemigrations --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: the combined payload's shape and current-ticket exclusion (Step 4); an empty-history customer (Step 5); the double permission check in both directions plus `401` (Step 6).
- [ ] Both languages walk through cleanly in the browser, including the responsive stack-vs-side-by-side behaviour (Step 7).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] Every record and any reused throwaway role/user created during verification is cleaned up (Step 9).
- [ ] `.squad/plans/agent-workspace/00-overview.md` updated with this story's row and dependency notes (task 9).

**STOP HERE. Report to the user and wait for confirmation.** The remaining `agent-workspace` stories are **AGENT-3 (Tasks & Reminders, blocked on `SLA-4` notifications)**, **AGENT-4 (Quick Replies, depends only on `COMM-0`, complete)**, and **AGENT-5 (Team Collaboration, depends on this feature's `TKT-5` history pattern and `SLA-4`)** — `SupportOs backlog.MD` lines 425-444. `AGENT-4` is the next immediately plannable story.
