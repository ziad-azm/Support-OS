# Story 43 — Submit Tickets (Story: SUPPORTOS-56)

## Prerequisites

- **PORTAL-0 complete:** [42-story-portal-access-customer-auth-SUPPORTOS-55.md](42-story-portal-access-customer-auth-SUPPORTOS-55.md). Verified landed on disk today: `Customer.user` (nullable 1:1 to `accounts.User`, `related_name="customer_profile"`); the seeded `customer` role holding exactly `["portal.access"]`; `apps/core/views.py`'s `CustomerScopedModelViewSet` (`get_queryset()` scoped to `request.user.customer_profile`, `customer_field` default `"customer"`); `HasPermission.has_object_permission`; the frontend's sibling `path: 'portal'` route tree in `frontend/src/app/router.tsx` (lines 257–287) with `PortalLayout` and a placeholder `PortalHomePage`, gated by the existing `RequireAuth` + `RequirePermission permission="portal.access"`.
- **TKT-1 complete** (`.squad/plans/ticket-management/12-story-create-track-tickets-SUPPORTOS-32.md`) — `apps/tickets/models.py`'s `Ticket` model, `apps/tickets/serializers.py`'s `TicketSerializer`, and `TicketViewSet` (`apps/tickets/views.py:47-93`), verified staff-only today: `permission_map` gates every action on `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE` (63–73), and `TicketSerializer.customer` (`serializers.py:43`) is a **writable, required** field — a client picks which `Customer` the ticket belongs to. This is exactly the field a portal-facing endpoint must NOT expose as writable; see `## Story Goal`.
- **`apps/portal/` is still the empty scaffold PORTAL-0 left it as** — verified: `apps/portal/{models.py,views.py,admin.py}` are one-line placeholders, no `urls.py`, no `serializers.py`, and `config/api_urls.py` has no `include("apps.portal.urls")` line. This story is the first to give the app real content, per its own stated purpose (`apps/README.md:74`, *"Customer-facing self-service surface"*).
- **No new permission or migration is needed.** The seeded `customer` role already holds `portal.access` (PORTAL-0's `apps/accounts/migrations/0004_seed_customer_role.py`) — this story reuses that single permission to gate ticket creation, exactly the "reused by all portal stories" promise `CONVENTIONS.md` §26 makes.
- **`SupportOs backlog.MD` line 566–570** — `### STORY (PORTAL-1) — Submit Tickets`, dependencies `PORTAL-0, TKT-1` (line 568), one task: *"Customer-scoped create API + UI — Reuse ticket create + `FORM`. Outcome: customers open tickets."* (line 570). `PORTAL-2` (line 572, "Track Requests" — scoped list/detail) is the very next story and is **not** this one's job.
- Verified frontend baseline: `frontend/src/features/portal/` contains exactly `components/{PortalLayout.tsx,PortalHomePage.tsx}` and `locales/{en,ar}.json` (PORTAL-0). No `api/` or `types/` directory exists yet under it.
- Verified: `frontend/.oxlintrc.json:8-18`'s `no-restricted-imports` rule blocks any `@/features/*` import from another feature. `features/portal/` therefore cannot import `Ticket`/`TicketInput` from `features/tickets/types/ticket.ts` — this story's frontend types are self-contained, not reused from `features/tickets/`. See `## Story Goal`.

---

## Story Goal

Let a logged-in customer open a support ticket for themselves — reusing the existing `Ticket` model, its `TicketSerializer`, its auto-assignment side effect, and the shared `FORM` building blocks, without ever letting the client choose which `Customer` the ticket belongs to.

1. **Backend:** `apps/portal/` gets its first real content — a `PortalTicketCreateSerializer` (a thin subclass of `TicketSerializer`) and a `PortalTicketViewSet` (a `CustomerScopedModelViewSet` subclass), exposing exactly one action: `POST /api/portal/tickets/`. The `customer` on the created ticket is **always** `request.user.customer_profile`, set server-side in `perform_create` — never accepted from the request body.
2. **Frontend:** a new `PortalTicketFormPage` at `/portal/tickets/new`, built from `useAppForm`/`TextField`/`TextareaField` exactly like `LoginPage` and the staff `TicketFormPage` already are, but with only the two fields a customer actually supplies: `subject` and `description`. `PortalHomePage` gains a real call to action linking to it, replacing PORTAL-0's placeholder copy.
3. **Narrower writable surface than staff.** A customer never picks the `customer` (forced), the `category` (deferred — see below), or the `priority` (defaults to `medium`, staff triages). This is a deliberate, minimal subset of `TicketSerializer`'s fields, not a new independent form.

### The finding that shapes the serializer design

**`TicketSerializer.customer` is writable and required** (`apps/tickets/serializers.py:19,43`, not in `read_only_fields`) — correct for `TicketViewSet`, where a staff member is creating a ticket *for* a customer they look up. A portal endpoint reusing that serializer unmodified would let a customer's browser submit an arbitrary `customer` id in the POST body and create a ticket **against a different customer's record** — `CustomerScopedModelViewSet.get_queryset()` only scopes *reads*; it does nothing to stop a client-supplied `customer` field from being *written* on create, since `create()` never calls `get_queryset()`. The fix: `PortalTicketCreateSerializer(TicketSerializer)` adds `customer` (and `category`, `priority`) to `read_only_fields`, and `PortalTicketViewSet.perform_create` is what actually sets `customer` — from `self.request.user.customer_profile`, never from client input. This is the same shape as `TicketViewSet.assign`/`set_status` deliberately keeping `assigned_agent`/`status` read-only on the base serializer and writing them only through a controlled server-side path (`apps/tickets/serializers.py:56-66`) — this story applies the identical pattern to `customer`.

### Explicitly out of scope

- **Category selection.** `TicketSerializer.category` becomes read-only on the portal serializer too — the intake's one task is "create API + UI" with no mention of a category picker, and exposing one would require a new customer-facing "list categories" read endpoint that nothing else in this story needs. A portal-submitted ticket is created with `category = None`; staff triage assigns one later, exactly like an unassigned `assigned_agent` already works. A forward note for whichever PORTAL-N story wants it.
- **Priority selection.** Left at the model default (`Ticket.Priority.MEDIUM`) for the same reason — not named in the intake, and priority triage is a staff concern (`TicketViewSet`'s own `permission_map` gates `update`/`partial_update` on `Permissions.TICKETS_MANAGE`, staff-only).
- **PORTAL-2 (Track Requests) — listing or viewing submitted tickets.** This story is create-only. `PortalTicketViewSet` exposes no `list`/`retrieve` URL (see task 2) — a customer cannot yet see their own ticket after submitting it beyond the confirmation toast. That is PORTAL-2's explicit job (`SupportOs backlog.MD:572-576`).
- **Editing or deleting a submitted ticket.** Not named in the intake; also why `PortalTicketViewSet`'s URL registration exposes only `create` (task 2), not the full `ModelViewSet` surface `CustomerScopedModelViewSet` technically has methods for.
- **File attachments on ticket creation.** Not named in the intake; `apps/customers/models.py`'s `Attachment` model is customer-record-scoped, not ticket-scoped, and out of scope regardless.
- **Automated tests.** Standing policy, `CONVENTIONS.md` §16. See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/customer-portal/SUPPORTOS-56/intake.md` — one task block (*"Customer-scoped create API + UI — Reuse ticket create + FORM"*), **no attachments, no acceptance criteria**. Done Criteria derive from the one **Outcome** line: *"customers open tickets."*
2. `SupportOs backlog.MD` lines 566–576 — `PORTAL-1` (this story) and `PORTAL-2` (the very next one) — confirms listing/tracking is explicitly not this story's job.
3. `backend/apps/tickets/models.py` — `Ticket` (26–110), especially `customer` (56–58, `PROTECT` FK to `Customer`) and the `Priority`/`Status` defaults (34–44, 87–92) a portal-created ticket falls back to.
4. `backend/apps/tickets/serializers.py` — full file (67 lines). `TicketSerializer` (14–66), its `Meta.fields` (39–55), and `read_only_fields` (61–66) — task 1's `PortalTicketCreateSerializer` subclasses this and extends `read_only_fields` by three more names.
5. `backend/apps/tickets/views.py` — `TicketViewSet.perform_create` (83–93) — task 2's `PortalTicketViewSet.perform_create` mirrors this exactly (queue `auto_assign_ticket`, swallow a queuing failure), with one addition: forcing `customer`.
6. `backend/apps/core/views.py` — `CustomerScopedModelViewSet` (from PORTAL-0) — `get_queryset()` and `customer_field` (default `"customer"`, already matching `Ticket.customer`, no override needed).
7. `backend/apps/core/permissions.py` — `Permissions.PORTAL_ACCESS` (from PORTAL-0) — the one permission this story's `permission_map` uses; no new constant.
8. `backend/apps/sla/tasks.py` — `auto_assign_ticket` (19–44) — verified generic (accepts a ticket id, no assumption about who created it); reused unmodified.
9. `backend/config/api_urls.py` — full file (23 lines, post-PORTAL-0). Task 3 adds one `include()` line, **above** the catch-all `re_path` which must stay last.
10. `backend/apps/README.md` line 74 — `portal`'s stated purpose; this story is the first to act on it.
11. `frontend/src/app/router.tsx` — the `path: 'portal'` tree (257–287, post-PORTAL-0). Task 6 adds one sibling route object inside the existing `RequirePermission permission="portal.access"` block (271–283), alongside the existing `index: true` entry.
12. `frontend/src/features/portal/components/PortalHomePage.tsx` (post-PORTAL-0, 15 lines) and `PortalLayout.tsx` (post-PORTAL-0, 50 lines) — task 7 edits both: `PortalHomePage` gets a real call to action, `PortalLayout` gets one new nav link.
13. `frontend/src/features/tickets/components/TicketFormPage.tsx` — the staff worked example (199 lines): `ticketSchema` (33–45), `useAppForm`/`Form`/`TextField`/`TextareaField`/`FormErrorSummary` usage (152–198), and the `onSuccess`/`onError` mutation pattern (124–138). Task 5's `PortalTicketFormPage` copies the **shape**, not the fields — `customer`/`category`/`priority` pickers are absent.
14. `frontend/src/features/tickets/api/createTicket.ts` (7 lines) and `useTicketMutations.ts`'s `useCreateTicket` (18–24) — the exact `api.post` + `useMutation` pattern task 4's `createPortalTicket.ts`/`useCreatePortalTicket` copies, posting to `/portal/tickets/` instead of `/tickets/`.
15. `frontend/.oxlintrc.json` lines 8–18 — the `no-restricted-imports` rule that is why task 4 defines its own local types instead of importing `features/tickets/types/ticket.ts`.
16. `frontend/src/shared/validation/schemas.ts` — `requiredString` (11–13) — task 5's `subject`/`description` fields reuse it verbatim, same as `TicketFormPage`'s own schema (33–38).
17. `frontend/src/shared/i18n/resources.ts` — the `portal` namespace entry (from PORTAL-0) — task 8 only edits the two JSON files it already points at; no new registration line.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Reuse ticket create + `FORM`.** | Intake | `PortalTicketCreateSerializer` subclasses `TicketSerializer` (not a from-scratch serializer); `PortalTicketFormPage` is built from the same `useAppForm`/`TextField`/`TextareaField`/`FormErrorSummary` primitives `TicketFormPage`/`LoginPage` already use. |
| **Customer-scoped.** | Intake | `PortalTicketViewSet(CustomerScopedModelViewSet)` — `get_queryset()` scoping is inherited unmodified; `perform_create` additionally forces `customer=request.user.customer_profile`, since scoping alone does not stop a writable `customer` field from being set on create. |
| **The backend owns authorization; the frontend check is UX only.** | `CONVENTIONS.md` §12 | `permission_map = {"create": Permissions.PORTAL_ACCESS}` is what actually gates the endpoint; the frontend nav link is reachable only inside the existing `RequirePermission permission="portal.access"` route group — no new frontend check invented. |
| **A feature must not import from another feature.** | `frontend/.oxlintrc.json` §15 | `features/portal/types/portalTicket.ts` is self-contained — it does not import `Ticket`/`TicketInput` from `features/tickets/`. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 1 — `PortalTicketCreateSerializer`

**Create file: `backend/apps/portal/serializers.py`**

```python
from apps.tickets.serializers import TicketSerializer


class PortalTicketCreateSerializer(TicketSerializer):
    """`TicketSerializer`, narrowed for a customer's own submission.

    `customer` is read-only here on top of `TicketSerializer`'s own
    read-only set — `PortalTicketViewSet.perform_create` is what actually
    sets it, from `request.user.customer_profile`, never from client input.
    Scoping `get_queryset()` (CustomerScopedModelViewSet) protects reads;
    it does nothing for a writable field on `create`, which is why this
    also has to be a serializer-level change, not just a viewset one.

    `category` and `priority` are read-only too — not named in the
    intake's one task, and exposing a category picker would need a new
    customer-facing "list categories" endpoint nothing else here needs.
    A portal-submitted ticket lands uncategorized at the default priority;
    staff triage assigns both later, the same way an unassigned
    `assigned_agent` already works.
    """

    class Meta(TicketSerializer.Meta):
        read_only_fields = TicketSerializer.Meta.read_only_fields + (
            "customer",
            "category",
            "priority",
        )
```

Inherits `TicketSerializer`'s `Meta.fields` verbatim — the JSON shape returned to the customer (`id`, `subject`, `description`, `customer`, `customer_name`, `category`, `category_name`, `assigned_agent`, `assigned_agent_name`, `status`, `priority`, `escalated`, `escalated_at`, `created_at`, `updated_at`) is identical to what staff see; only what is writable narrows.

---

### 2 — `PortalTicketViewSet`

**Create file: `backend/apps/portal/views.py`**

```python
import logging

from apps.core.permissions import Permissions
from apps.core.views import CustomerScopedModelViewSet
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket

from .serializers import PortalTicketCreateSerializer

logger = logging.getLogger(__name__)


class PortalTicketViewSet(CustomerScopedModelViewSet):
    """A customer's own ticket-creation endpoint — PORTAL-1.

    `customer_field` is left at `CustomerScopedModelViewSet`'s default
    (`"customer"`) — `Ticket.customer` is already the right name, no
    override needed. Only `create` is routed to a URL (see
    `apps/portal/urls.py`); `list`/`retrieve`/`update`/`destroy` exist on
    this class (inherited from `ModelViewSet`) but are unreachable — no
    router registers them. PORTAL-2 is what will route `list`/`retrieve`
    for this same customer boundary.
    """

    queryset = Ticket.objects.all()
    serializer_class = PortalTicketCreateSerializer
    permission_map = {"create": Permissions.PORTAL_ACCESS}

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

---

### 3 — Wire the endpoint

**Create file: `backend/apps/portal/urls.py`**

```python
from django.urls import path

from .views import PortalTicketViewSet

app_name = "portal"

# A plain `path()`, not a router: this viewset exposes exactly one action.
# Registering it with a router would additionally route list/retrieve/
# update/destroy URLs this story does not want reachable — see
# PortalTicketViewSet's own docstring.
urlpatterns = [
    path("portal/tickets/", PortalTicketViewSet.as_view({"post": "create"}), name="portal-ticket-create"),
]
```

**File: `backend/config/api_urls.py`** — add one line, **above** the catch-all `re_path` which must stay last (verified current order: `core`, `accounts`, `customers`, `tickets`, `communications`, `notifications`, `agents`, `knowledge_base`):

```python
urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.customers.urls")),
    path("", include("apps.tickets.urls")),
    path("", include("apps.communications.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.agents.urls")),
    path("", include("apps.knowledge_base.urls")),
    path("", include("apps.portal.urls")),
    # Must stay last: turns an unmatched /api/ path into an enveloped 404
    # instead of Django's HTML 404 page.
    re_path(r"^", ApiNotFoundView.as_view()),
]
```

Endpoint: `POST /api/portal/tickets/`.

---

## Frontend Tasks

### 4 — `features/portal/types/` and `features/portal/api/`

**Create file: `frontend/src/features/portal/types/portalTicket.ts`**

```ts
/** The write shape a customer submits. Deliberately narrower than
 * `features/tickets/types/ticket.ts`'s `TicketInput` — `customer`,
 * `category`, and `priority` are all set server-side
 * (`PortalTicketCreateSerializer`/`PortalTicketViewSet.perform_create`).
 * Not imported from `features/tickets/` — `no-restricted-imports`
 * (frontend/.oxlintrc.json) forbids a cross-feature import; this feature
 * keeps its own minimal, self-contained type instead. */
export type PortalTicketInput = {
  subject: string
  description: string
}

/** Only the field this feature actually reads from the response — no
 * ticket detail page exists yet in the portal (PORTAL-2/3), so nothing
 * here needs the full `Ticket` shape. */
export type PortalTicketCreated = {
  id: number
}
```

**Create file: `frontend/src/features/portal/api/createPortalTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { PortalTicketCreated, PortalTicketInput } from '../types/portalTicket'

export function createPortalTicket(input: PortalTicketInput): Promise<PortalTicketCreated> {
  return api.post<PortalTicketCreated>('/portal/tickets/', input)
}
```

**Create file: `frontend/src/features/portal/api/usePortalTicketMutations.ts`**

```ts
import { useMutation } from '@tanstack/react-query'

import { createPortalTicket } from './createPortalTicket'
import type { PortalTicketInput } from '../types/portalTicket'

/**
 * No `queryClient.invalidateQueries` — unlike `useCreateTicket`
 * (`features/tickets/api/useTicketMutations.ts:18-24`), there is no
 * portal ticket list cached anywhere yet (PORTAL-2 is what adds one).
 */
export function useCreatePortalTicket() {
  return useMutation({
    mutationFn: (input: PortalTicketInput) => createPortalTicket(input),
  })
}
```

---

### 5 — `PortalTicketFormPage`

**Create file: `frontend/src/features/portal/components/PortalTicketFormPage.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, TextField, TextareaField, useAppForm } from '@/shared/ui/form'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreatePortalTicket } from '../api/usePortalTicketMutations'

// Same field caps as the staff TicketFormPage's own schema
// (features/tickets/components/TicketFormPage.tsx:33-38) — frontend-only
// sanity ceilings, not a mirror of a server constraint.
const schema = z.object({
  subject: requiredString(200),
  description: requiredString(5000),
})

type FormValues = z.output<typeof schema>

export function PortalTicketFormPage() {
  const { t } = useTranslation('portal')
  const navigate = useNavigate()
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: { subject: '', description: '' },
  })

  const mutation = useCreatePortalTicket()

  function onSubmit(values: FormValues) {
    mutation.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('tickets.created') })
        navigate('/portal', { replace: true })
      },
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
        // A non-validation failure is already toasted by the shared
        // mutation error handler. See CONVENTIONS.md §21.
      },
    })
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('tickets.new')}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <TextField control={form.control} name="subject" label={t('tickets.fields.subject')} />
          <TextareaField
            control={form.control}
            name="description"
            label={t('tickets.fields.description')}
          />
          <FormErrorSummary errors={formErrors} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('tickets.actions.submit')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
```

No `customer`/`category`/`priority` fields — the whole point of task 1's narrower serializer.

---

### 6 — Wire `/portal/tickets/new`

**File: `frontend/src/app/router.tsx`** — add one sibling entry inside the existing `RequirePermission permission="portal.access"` block (lines 271–283), alongside the existing `index: true` route:

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
                path: 'tickets/new',
                lazy: async () => {
                  const { PortalTicketFormPage } =
                    await import('@/features/portal/components/PortalTicketFormPage')
                  return { element: <PortalTicketFormPage /> }
                },
              },
            ],
          },
```

Full path: `/portal/tickets/new`.

---

### 7 — `PortalHomePage` gets a real call to action; `PortalLayout` gets a nav link

**File: `frontend/src/features/portal/components/PortalHomePage.tsx`** — replace the placeholder body:

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
      <Button asChild className="self-start">
        <Link to="/portal/tickets/new">{t('tickets.new')}</Link>
      </Button>
    </div>
  )
}
```

`home.placeholder` (PORTAL-0's *"There is nothing here yet"*) is now false — task 8 replaces it with `home.intro` in both locale files.

**File: `frontend/src/features/portal/components/PortalLayout.tsx`** — add one nav link, directly after the existing "Home" link (in the `<nav>` block):

```tsx
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal">{t('nav.home')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/tickets/new">{t('nav.newTicket')}</Link>
            </Button>
          </nav>
```

---

### 8 — Locale keys

**File: `frontend/src/features/portal/locales/en.json`** — replace `home.placeholder` with `home.intro`, and add a `tickets` key alongside the existing `shell`/`home`/`nav` keys:

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
    "newTicket": "New ticket"
  },
  "tickets": {
    "new": "Submit a ticket",
    "fields": {
      "subject": "Subject",
      "description": "Description"
    },
    "actions": {
      "submit": "Submit"
    },
    "created": "Your ticket has been submitted."
  }
}
```

**File: `frontend/src/features/portal/locales/ar.json`** — the same key structure, translated. Every key present in `en` must exist in `ar` (`CONVENTIONS.md` §18) — a missing key falls back silently to English.

---

## Edge Cases & Failure Modes

- **A customer cannot set `customer` on create, even by hand-crafting the request body.** `PortalTicketCreateSerializer` marks it read-only — DRF silently ignores a read-only field present in `request.data` rather than erroring, and `perform_create` overwrites it with `request.user.customer_profile` regardless. Verified as the correct, intended behaviour: the scoping story 42 built (`get_queryset()`) protects reads; this task's serializer change is what protects the write path, which scoping alone does not cover.
- **A customer with `role = None` or no `customer_profile` hits `PortalTicketViewSet`'s `permission_map` (403) before `perform_create` ever runs** — `IsAuthenticated + HasPermission` (via `CustomerScopedModelViewSet` → `BaseModelViewSet`) checks `portal.access` first. This mirrors the exact 403 behaviour PORTAL-0's own verification already proved for a role-less customer.
- **A staff account (no `customer_profile`, and no `portal.access` permission either) is denied at the permission layer, the same as PORTAL-0's harness proved for `list`.** No new failure mode — `create` and `list` share the same `HasPermission` gate.
- **`auto_assign_ticket.delay()` failing (e.g. Redis unreachable) must not fail the customer's submission.** Same `try/except Exception: logger.exception(...)` contract `TicketViewSet.perform_create` already uses — the `Ticket` row is committed before the task is queued, so a queuing failure only means "not yet auto-assigned," not "ticket lost."
- **A portal-submitted ticket has `category = None` and `priority = "medium"`, indistinguishable in the database from a staff-created ticket with those same values.** This is intentional — nothing about the `Ticket` model itself marks "who created this," and no story asks for that distinction. Staff triage treats every uncategorized ticket the same regardless of origin.
- **`PortalTicketViewSet` technically has `list`/`retrieve`/`update`/`destroy` methods (inherited from `ModelViewSet` via `CustomerScopedModelViewSet` via `BaseModelViewSet`), but none are routed.** `apps/portal/urls.py`'s plain `path()` (not a router) only ever calls `.as_view({"post": "create"})`, so `'get'` is absent from the view's action map. **Verified the actual response, which is not what a naive reading suggests:** DRF's `APIView.dispatch()` runs `self.initial(request, ...)` — authentication and `check_permissions()` — *before* it looks up a handler for the request method. So `GET /api/portal/tickets/` with **no token** returns `401 not_authenticated` (the permission gate short-circuits first, never reaching the "is GET mapped" check), while `GET` with a **valid customer token** (holding `portal.access`) passes the permission gate and then hits `http_method_not_allowed` — a real `405 Method Not Allowed` with `error.code: "method_not_allowed"`, not a plain Django 404 and not a real read. Never assume an unmapped HTTP method on a routed path produces a 404 without checking the auth/permission ordering first.
- **The success toast, not a ticket detail page, is the only confirmation a customer gets.** There is no `/portal/tickets/:id` route yet (PORTAL-2/3). `PortalTicketFormPage` navigates back to `/portal` on success, not to a nonexistent detail route — do not link to one until PORTAL-2 ships it.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — clean, and the existing suite reports the same passing count as before this change.
2. `ruff format --check .` / `ruff check .` on the new and changed Python.
3. `npm run build` — typechecks `PortalTicketFormPage`, `PortalTicketInput`/`PortalTicketCreated`, and the new router entry.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl` — unchanged gates over the new files; lint is also what proves `features/portal/` imports nothing from `features/tickets/`.
5. Real HTTP checks proving a customer can create a ticket scoped to themselves and cannot set an arbitrary `customer` — Verification Steps 3–5. This is where the story's actual claim gets tested; nothing static can see it.

---

## Migration / Rollback

**No schema or data migration.** This story adds two new Python modules (`apps/portal/serializers.py`, `apps/portal/views.py`) and one (`apps/portal/urls.py`), plus one `include()` line — no model changes, no new `Permissions` constant, no new `Role`/migration.

**Rollback of the code:** revert the commits. No `npm install`/`pip install` needed — no new dependency in either app.

**Half-applied states to avoid:**

- **Task 3's `config/api_urls.py` include before tasks 1–2's `serializers.py`/`views.py` exist** → `ImportError` on Django startup (`apps.portal.urls` imports `apps.portal.views`, which imports `apps.portal.serializers`). Ship all three together.
- **Task 6's router entry before task 5's `PortalTicketFormPage.tsx` exists** → `npm run build` fails on the missing lazy import. Ship task 5 first.
- **A `PortalTicketCreateSerializer` that forgets to extend `TicketSerializer.Meta.read_only_fields` (assigns a fresh tuple instead)** → `customer` becomes writable again, silently reopening the exact vulnerability this story exists to close. Verification Step 4 exercises this directly.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` — `python manage.py check`, `ruff format --check .`, `ruff check .` — all clean.
2. **Backend regression:** `python manage.py test` — reports the same passing count as before this change.
3. **A customer can create a ticket scoped to themselves:**

   ```powershell
   $t = (curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/ -H "Content-Type: application/json" -d '{\"email\":\"cust1@example.com\",\"password\":\"Sup3rSecret!\"}' | ConvertFrom-Json).data.access
   curl.exe -s -X POST http://127.0.0.1:8000/api/portal/tickets/ -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d '{\"subject\":\"Cannot log in\",\"description\":\"I get an error on the login page.\"}'
   ```

   Expect `201`, `data.customer_name` = `"Customer One"` (or whichever `Customer` `cust1@example.com` is linked to), `data.category` = `null`, `data.priority` = `"medium"`, `data.status` = `"open"`.
4. **A client-supplied `customer` is ignored, not honoured.** Repeat step 3's request with an extra `"customer": <some other customer's id>` key in the body: the response's `customer_name` is still the caller's own customer — never the supplied id. This is the core security property task 1 exists to guarantee.
5. **A staff account, or a customer with no `portal.access`, cannot hit the endpoint.** POST the same body with a staff token (no `portal.access` permission): expect `403 permission_denied`. POST with no `Authorization` header: expect `401 not_authenticated`.
6. **`GET /api/portal/tickets/` never returns ticket data.** With no `Authorization` header: expect `401 not_authenticated` (the permission gate runs before the method lookup). With a valid customer token that holds `portal.access`: expect `405 method_not_allowed` — confirms no `list` route is registered, without assuming a plain 404.
7. **Frontend builds and lints clean:** from `frontend/` — `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` — all exit 0.
8. **The form renders and submits, in both languages.** With the backend running: `npm run dev`, log in as `cust1@example.com`, navigate to `/portal/tickets/new` (via the new "New ticket" nav link or `PortalHomePage`'s call to action). Submit a subject and description: a success toast appears (`tickets.created`), and the app navigates back to `/portal`. Switch language to Arabic first and repeat: the form's labels, button, and toast are all Arabic.

---

## Done Criteria

- [ ] `PortalTicketCreateSerializer` exists in `apps/portal/serializers.py`, subclasses `TicketSerializer`, and adds `customer`, `category`, `priority` to `read_only_fields` (on top of `TicketSerializer`'s own).
- [ ] `PortalTicketViewSet` exists in `apps/portal/views.py`, subclasses `CustomerScopedModelViewSet`, declares `permission_map = {"create": Permissions.PORTAL_ACCESS}`, and its `perform_create` sets `customer=request.user.customer_profile` and queues `auto_assign_ticket` with the same try/except resilience `TicketViewSet.perform_create` uses.
- [ ] `apps/portal/urls.py` exists, registering exactly `POST /api/portal/tickets/` via `.as_view({"post": "create"})` — no router, no `list`/`retrieve`/`update`/`destroy` route.
- [ ] `config/api_urls.py` includes `apps.portal.urls`, above the catch-all `re_path`.
- [ ] No new `Permissions` constant, no new migration, no new `Role` — verified this story reuses `portal.access` and the `customer` role from PORTAL-0 unchanged.
- [ ] Verified by real HTTP (Steps 3–6): a customer's created ticket is correctly scoped to their own `Customer`; a client-supplied `customer` id is silently overridden, never honoured; a staff account or unauthenticated caller is denied; `GET` on the same path returns `401` (no token) or `405 method_not_allowed` (valid customer token) — never ticket data.
- [ ] `frontend/src/features/portal/types/portalTicket.ts`, `api/createPortalTicket.ts`, `api/usePortalTicketMutations.ts`, and `components/PortalTicketFormPage.tsx` all exist; none imports from `features/tickets/` (lint-verified).
- [ ] `frontend/src/app/router.tsx` routes `/portal/tickets/new` inside the existing `RequirePermission permission="portal.access"` group, alongside the existing index route.
- [ ] `PortalHomePage` shows a real call to action linking to `/portal/tickets/new`; `PortalLayout`'s nav includes a "New ticket" link.
- [ ] `features/portal/locales/{en,ar}.json` both have the new `tickets.*` keys and `home.intro` (replacing `home.placeholder`), with identical key sets.
- [ ] `python manage.py check`/`test`, `ruff format --check .`, `ruff check .`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` all exit 0.
- [ ] `.squad/plans/customer-portal/00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to PORTAL-2 (Track Requests), which is the first story to route `list`/`retrieve` for a portal customer's own tickets.**
