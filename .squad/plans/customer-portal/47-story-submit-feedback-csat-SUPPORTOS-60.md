# Story 47 — Submit Feedback (CSAT) (Story: SUPPORTOS-60)

## Prerequisites

- **PORTAL-2 complete:** [44-story-track-requests-SUPPORTOS-57.md](44-story-track-requests-SUPPORTOS-57.md) — `PortalTicketViewSet`/`PortalTicketSerializer` (`apps/portal/`), `usePortalTicket`/`PortalTicketDetailPage` (`frontend/src/features/portal/`).
- **`CONVENTIONS.md` §25 (Design intelligence)** already records the exact reporting design `RPT-4` (Customer Satisfaction, not yet planned) will use: *"satisfied/neutral/dissatisfied breakdown... Waffle Chart... Distinct accessible color pair per category"* (line 1560). **This is not a coincidence to work around — it is the vocabulary this story's `rating` field must use.** A 5-star or 1–10 scale would need translation into three buckets later; a 3-way choice matching `RPT-4`'s own chart design needs none. This is what "satisfaction capture reused by reporting" (the intake's own Outcome line) means concretely.
- **`SupportOs backlog.MD` line 590–594** — `### STORY (PORTAL-5) — Submit Feedback (CSAT)`, dependency `PORTAL-2` (line 592). One 🔑 task: *"`Feedback`/CSAT model + API + form (feeds Reports CSAT) — Implement post-resolution rating + comment via `FORM`. Outcome: satisfaction capture reused by reporting."* (line 594). Line 602–603 (`EPIC 13`, not yet planned) names `RPT-4` as the eventual reader of this data — **not built here**.
- Verified: no `Feedback` model, serializer, view, or migration exists anywhere in `backend/apps/` today (grepped `apps/*/models.py` for `Feedback` — no hits). This is the first genuinely new model this epic has added (every prior PORTAL-N story either extended `Ticket` or reused `FAQ`/`Article` unmodified).
- Verified: `apps/tickets/models.py` already imports `from apps.customers.models import Customer` (line 5) — `Feedback.customer` (task 1) needs no new import.
- Verified: `apps/tickets/migrations/` currently ends at `0006_ticketactivity.py`.
- **The finding that shapes `Feedback.customer`'s exact shape — read before task 1.** `CustomerScopedModelViewSet.get_queryset()` and `HasPermission.has_object_permission` (`apps/core/views.py`/`apps/core/permissions.py`) both resolve `customer_field` by reading `getattr(obj, f"{customer_field}_id", None)` — a **single, direct attribute**, not a Django ORM double-underscore lookup path. A nested `customer_field = "ticket__customer"` would satisfy `get_queryset()`'s `filter(**{...})` (valid ORM syntax) but silently break `has_object_permission` (`getattr(obj, "ticket__customer_id", None)` is never a real attribute — always `None`), reproducing the exact class of bug Story 46 just found and fixed in `ArticleViewSet.retrieve`, in the opposite direction (a false negative instead of a false positive). `Feedback.customer` is therefore a **direct, denormalized FK** — redundant with `ticket.customer` but required for both mechanisms to work unmodified. See task 1's model code for the full reasoning, kept as a permanent comment.
- Verified: `frontend/src/shared/ui/form/RadioGroupField.tsx` already exists (63 lines) — the exact 3-option picker this story's rating field needs, unused by any existing form today (`FORM`'s own "ships ahead of its first consumer" pattern, same as several primitives before it).
- Verified: `frontend/src/shared/validation/serverErrors.ts`'s `applyServerErrors` (28–53) already surfaces a server validation error for a field the RHF form does not have (e.g. `ticket`) as a **form-level** message via its `unattached` return, not silently dropped — confirmed by reading the function in full. This is exactly the case task 8's form hits: the customer never edits `ticket` (it comes from the URL), so a `ticket`-keyed validation error (wrong ownership, wrong status, duplicate) needs no special handling — the existing `FormErrorSummary` machinery already renders it.

---

## Story Goal

Let a customer rate a resolved or closed ticket — a satisfied/neutral/dissatisfied choice plus an optional comment — reusing `CustomerScopedModelViewSet`, `FORM`, and the exact reporting vocabulary already recorded for `RPT-4`.

1. **A new `Feedback` model** in `apps/tickets/models.py` (co-located with `Ticket` — this is ticket-lifecycle data, not a new business area; see `apps/README.md`'s "Where new code goes" rule 1). One row per ticket (`ticket` is a `OneToOneField`), `rating` a 3-way `TextChoices` matching `RPT-4`'s already-decided vocabulary, `comment` optional.
2. **`PortalFeedbackViewSet`** (`apps/portal/`), `CustomerScopedModelViewSet`-based, `create`-only — reusing `Permissions.PORTAL_ACCESS` (no new permission constant), with server-side validation that the ticket belongs to the caller and is actually resolved/closed.
3. **`PortalTicketSerializer` gains one read-only field, `has_feedback`** — a `SerializerMethodField` using the verified-safe `hasattr(ticket, "feedback")` pattern (the reverse `OneToOneField` accessor, same `RelatedObjectDoesNotExist`-subclasses-`AttributeError` fact Story 42 already verified for `Customer.user`/`customer_profile`). This is how the frontend knows whether to show a "Rate this ticket" call to action or "thanks for your feedback," without a second endpoint.
4. **`PortalFeedbackFormPage`**, reached from `PortalTicketDetailPage` once a ticket is resolved/closed and has no feedback yet — a `RadioGroupField` (rating) + `TextareaField` (comment), the same `useAppForm`/`FormErrorSummary` shape every portal form already uses.
5. **No staff-facing viewer or report.** `RPT-4` is not yet planned; this story ships the data producer only. Django admin is the interim way to see submitted feedback, the same "admin until a later epic" pattern already used for `Role`/`Customer.user`.

### Explicitly out of scope

- **Any staff-facing `FeedbackViewSet`, list screen, or report.** Not named in the intake; `RPT-4` (`SupportOs backlog.MD:623-627`) is a separate, not-yet-planned story. Building one now would be exactly the "half-finished implementation" / speculative infrastructure this project's own conventions warn against — `PortalFeedbackSerializer` is therefore **not** a narrowed subclass of a staff `FeedbackSerializer` the way `PortalTicketSerializer` narrows `TicketSerializer`; there is nothing to subclass yet, so it is the only serializer `Feedback` has.
- **Editing or deleting submitted feedback**, by the customer or anyone else. `PortalFeedbackViewSet` routes `create` only.
- **A numeric or 5-star rating scale.** Deliberately the exact 3-way `satisfied`/`neutral`/`dissatisfied` vocabulary `CONVENTIONS.md` §25 already recorded for `RPT-4`'s chart design — see `## Prerequisites`.
- **Feedback on an `open`/`in_progress` ticket.** Server-validated: only `resolved`/`closed` tickets accept feedback (`validate_ticket`, task 4).
- **A reminder/notification prompting the customer to leave feedback.** Not named in the intake; the only entry point is a manual visit to the ticket's detail page.
- **Automated tests.** Standing policy, `CONVENTIONS.md` §16. See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/customer-portal/SUPPORTOS-60/intake.md` — one 🔑 task (*"`Feedback`/CSAT model + API + form (feeds Reports CSAT)... Implement post-resolution rating + comment via `FORM`"*), **no attachments, no acceptance criteria**. Done Criteria derive from the one **Outcome** line: *"satisfaction capture reused by reporting."*
2. `SupportOs backlog.MD` lines 590–594 (`PORTAL-5`) and 601–627 (`EPIC 13`, especially `RPT-4` at 623–627) — confirms `RPT-4` is the future consumer, not built here.
3. `CONVENTIONS.md` lines 1556–1567 (`## 25. Design intelligence`, the `RPT-4` chart rows) — the source of the `satisfied`/`neutral`/`dissatisfied` vocabulary task 1's `Rating` choices copy verbatim.
4. `backend/apps/tickets/models.py` — `Ticket` (26–110, especially `Status` at 34–38 and `customer` at 56–58) and `TicketActivity` (113–166, especially its `ticket` FK's `CASCADE` reasoning at 127–131) — task 1's `Feedback.ticket` copies this exact `CASCADE` reasoning; `Feedback.customer` copies `Ticket.customer`'s FK shape but not its `PROTECT`.
5. `backend/apps/tickets/admin.py` — `TicketActivityAdmin` (44–49, 6 lines) — the exact `ModelAdmin` shape task 3's `FeedbackAdmin` copies.
6. `backend/apps/tickets/serializers.py` — full file (67 lines) — confirms `Feedback` has no existing staff serializer to subclass, unlike `Ticket`/`TicketSerializer` before PORTAL-1.
7. `backend/apps/core/permissions.py` — `HasPermission.has_object_permission` (its Story 46-corrected form) and `apps/core/views.py`'s `CustomerScopedModelViewSet` — read together with `## Prerequisites`'s `customer_field` finding before writing `Feedback.customer`.
8. `backend/apps/customers/serializers.py` lines 11–35 — `CustomerSerializer`'s own comment on DRF's `UniqueValidator` auto-derivation (*"ModelSerializer only auto-derives a UniqueValidator for a field it generates itself"*) — the exact verified DRF fact task 4's `PortalFeedbackSerializer` relies on: leaving `ticket` un-overridden is what gives duplicate-feedback prevention for free.
9. `backend/apps/portal/serializers.py` and `views.py` (post-PORTAL-2/PORTAL-1, both read in full above) — task 4/5 extend both: `PortalTicketSerializer` gains `has_feedback`, `PortalTicketViewSet.queryset` gains one more `select_related` entry, and both files gain the new `PortalFeedbackSerializer`/`PortalFeedbackViewSet`.
10. `backend/apps/portal/urls.py` (post-PORTAL-2, 22 lines) — task 6 adds one more `path()`, same plain-`path()`-not-router shape as the existing two.
11. `frontend/src/shared/ui/form/RadioGroupField.tsx` — full file (63 lines) — the exact `options`/`field.value`/`onValueChange` contract task 8's rating picker uses.
12. `frontend/src/features/tickets/components/TicketFormPage.tsx` lines 33–45, 181–189 — the `choice()` + `SelectField` pattern for `TICKET_PRIORITIES` this story's `RadioGroupField` + `choice(PORTAL_FEEDBACK_RATINGS)` mirrors, substituting a radio group for a select (three options read better as a radio group than a dropdown).
13. `frontend/src/shared/validation/serverErrors.ts` — full file (53 lines), specifically the `unattached`/`known` logic (32–45) — confirms a `ticket`-keyed server error (the form has no `ticket` field) surfaces correctly at form level with zero special handling in task 8.
14. `frontend/src/features/portal/components/PortalTicketDetailPage.tsx` — full file (as it exists post-PORTAL-2, no draft-status or feedback UI). Task 9 adds one conditional block after the existing `<Card>`.
15. `frontend/src/features/portal/types/portalTicket.ts` — full file (48 lines, post-PORTAL-2). Task 7 adds one field, `has_feedback: boolean`, to the `PortalTicket` type.
16. `frontend/src/app/router.tsx` — the `path: 'portal'` tree (post-PORTAL-4). Task 10 adds one sibling route, `tickets/:id/feedback`, alongside the existing `tickets/:id`.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Post-resolution rating + comment via `FORM`.** | Intake | `PortalFeedbackFormPage` built from `useAppForm`/`RadioGroupField`/`TextareaField`/`FormErrorSummary` — the same building blocks every portal form already uses. `validate_ticket` (task 4) rejects a non-resolved/closed ticket server-side. |
| **Feeds Reports CSAT.** | Intake | `Feedback.rating`'s three values are exactly `RPT-4`'s already-recorded chart categories (`CONVENTIONS.md` §25) — no translation layer will be needed when `RPT-4` is eventually built. |
| **Customer-scoped.** | Intake (implicit — every portal resource so far has been) | `PortalFeedbackViewSet(CustomerScopedModelViewSet)`; `perform_create` forces `customer`, `validate_ticket` rejects another customer's ticket id — the same two-layer defense (`get_queryset` for reads, explicit validation for writes) every prior portal create endpoint uses. |
| **A feature must not import from another feature.** | `frontend/.oxlintrc.json` §15 | `features/portal/types/portalFeedback.ts` is self-contained; nothing here has a `features/tickets/` counterpart to import from anyway (no staff feedback feature exists). |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 1 — The `Feedback` model

**File: `backend/apps/tickets/models.py`** — add after `TicketActivity` (currently the last class in the file):

```python
class Feedback(TimeStampedModel):
    """Post-resolution customer satisfaction rating — PORTAL-5. One row per
    ticket (`ticket` is a `OneToOneField`), submitted by the customer
    through the portal. No staff-facing viewer or report exists yet —
    `RPT-4` (Customer Satisfaction, `SupportOs backlog.MD:623-627`, not
    yet planned) is the eventual consumer named in the intake ("feeds
    Reports CSAT"); this story ships the model, the portal submission
    endpoint, and Django admin as the interim way to see the data.
    """

    class Rating(models.TextChoices):
        # Matches CONVENTIONS.md §25's already-recorded RPT-4 chart design
        # ("satisfied/neutral/dissatisfied breakdown", a Waffle Chart over
        # exactly these three categories) — this vocabulary is not invented
        # here, it is the one already decided for reporting.
        SATISFIED = "satisfied", _("Satisfied")
        NEUTRAL = "neutral", _("Neutral")
        DISSATISFIED = "dissatisfied", _("Dissatisfied")

    # CASCADE, not PROTECT: feedback has no existence independent of the
    # ticket it is about, the same reasoning TicketActivity.ticket uses
    # (above). OneToOneField, not ForeignKey: one CSAT rating per ticket —
    # the DB-level uniqueness DRF turns into a free UniqueValidator on
    # create (see apps/portal/serializers.py, PortalFeedbackSerializer).
    ticket = models.OneToOneField(
        Ticket, on_delete=models.CASCADE, related_name="feedback", verbose_name=_("ticket")
    )
    # Denormalized from `ticket.customer` — deliberately a direct FK, not
    # reached via a `ticket__customer` lookup. CustomerScopedModelViewSet's
    # `customer_field` and HasPermission.has_object_permission both resolve
    # `customer_field` as `getattr(obj, f"{customer_field}_id", None)` — a
    # single real attribute, not an ORM double-underscore path. A nested
    # field name would satisfy `get_queryset()`'s `filter(**{...})` but
    # silently break `has_object_permission` (`getattr(obj,
    # "ticket__customer_id", None)` is never a real attribute) — the exact
    # class of bug Story 46 found and fixed in ArticleViewSet.retrieve, in
    # the opposite direction. CASCADE, matching `ticket` above.
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="feedback", verbose_name=_("customer")
    )
    rating = models.CharField(_("rating"), max_length=20, choices=Rating.choices)
    comment = models.TextField(_("comment"), blank=True)

    class Meta:
        verbose_name = _("feedback")
        verbose_name_plural = _("feedback")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_rating_display()} — ticket #{self.ticket_id}"
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations tickets
```

Expect one file, `apps/tickets/migrations/0007_feedback.py` (next after `0006_ticketactivity.py`), creating the `Feedback` table with a unique constraint on `ticket_id`. Purely additive — no existing row affected, **no database reset required**. Commit it in the same change as the model — `MigrationStateTests.test_no_pending_migrations` fails the build otherwise.

---

### 2 — Register `Feedback` in Django admin

**File: `backend/apps/tickets/admin.py`** — add, after `TicketActivityAdmin`:

```python
from .models import Category, Feedback, Ticket, TicketActivity


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    """The only way to see submitted feedback until RPT-4 builds a real
    report — same interim-admin pattern as `RoleAdmin` before SEC-1.
    """

    list_display = ("ticket", "customer", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = ("ticket__subject", "customer__name", "comment")
    readonly_fields = ("created_at", "updated_at")
```

(The `from .models import ...` line replaces the existing one at the top of the file — add `Feedback` to the existing tuple, do not duplicate the import.)

---

### 3 — `PortalFeedbackSerializer` and `PortalTicketSerializer.has_feedback`

**File: `backend/apps/portal/serializers.py`** — replace in full:

```python
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer
from apps.tickets.models import Feedback, Ticket
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

    `has_feedback` — PORTAL-5. `Feedback.ticket` is a `OneToOneField` with
    `related_name="feedback"`, so `hasattr(ticket, "feedback")` is the same
    verified-safe pattern Story 42 already used for `Customer.user`'s
    reverse accessor (`RelatedObjectDoesNotExist` subclasses
    `AttributeError`, so `getattr`/`hasattr` need no try/except). Read-only
    by construction (`SerializerMethodField`); no entry needed in
    `read_only_fields`.
    """

    has_feedback = serializers.SerializerMethodField()

    class Meta(TicketSerializer.Meta):
        fields = TicketSerializer.Meta.fields + ("has_feedback",)
        read_only_fields = TicketSerializer.Meta.read_only_fields + (
            "customer",
            "category",
            "priority",
        )

    def get_has_feedback(self, ticket: Ticket) -> bool:
        return hasattr(ticket, "feedback")


class PortalFeedbackSerializer(BaseModelSerializer):
    """A customer's own post-resolution rating — PORTAL-5. No staff-facing
    counterpart exists to subclass (unlike `PortalTicketSerializer`
    narrowing `TicketSerializer`) — `Feedback` has no viewer at all yet,
    staff or portal, so this is the only serializer for it. See Story 47
    `## Explicitly out of scope`.
    """

    class Meta(BaseModelSerializer.Meta):
        model = Feedback
        fields = ("id", "ticket", "customer", "rating", "comment", "created_at", "updated_at")
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("customer",)

    def validate_ticket(self, ticket: Ticket) -> Ticket:
        """Runs in ADDITION to (not instead of) the automatic `UniqueValidator`
        DRF derives for `ticket` because it is left un-overridden — see
        `apps.customers.serializers.CustomerSerializer`'s own comment on
        this exact DRF behaviour. Ownership and status-eligibility are
        checked here; "already has feedback" is the free UniqueValidator.
        """
        customer = self.context["request"].user.customer_profile
        if ticket.customer_id != customer.id:
            raise serializers.ValidationError(_("That ticket does not belong to you."))
        if ticket.status not in (Ticket.Status.RESOLVED, Ticket.Status.CLOSED):
            raise serializers.ValidationError(
                _("Feedback can only be submitted for a resolved or closed ticket.")
            )
        return ticket
```

---

### 4 — `PortalFeedbackViewSet`

**File: `backend/apps/portal/views.py`** — add, and extend `PortalTicketViewSet.queryset`:

```python
from apps.tickets.models import Feedback, Ticket

from .serializers import PortalFeedbackSerializer, PortalTicketSerializer

# ...

class PortalTicketViewSet(CustomerScopedModelViewSet):
    # ...
    # `"feedback"` added — the reverse side of a OneToOneField IS
    # select_related-able in Django (unlike a reverse ForeignKey, which
    # needs prefetch_related), so `has_feedback` costs no extra query per
    # row on `list`. Verified: Feedback.ticket is a OneToOneField.
    queryset = Ticket.objects.select_related(
        "customer", "category", "assigned_agent", "feedback"
    ).all()
    # ...(rest unchanged)


class PortalFeedbackViewSet(CustomerScopedModelViewSet):
    """A customer's own CSAT submission — PORTAL-5. Create only; no
    `list`/`retrieve` route exists or is needed — a customer learns
    whether they already rated a ticket via
    `PortalTicketSerializer.has_feedback`, not by fetching `Feedback` rows
    directly. `customer_field` left at the default (`"customer"`) —
    `Feedback.customer` is a direct FK, matching what
    `CustomerScopedModelViewSet`/`HasPermission.has_object_permission`
    both expect (see Story 47 `## Prerequisites`).
    """

    queryset = Feedback.objects.all()
    serializer_class = PortalFeedbackSerializer
    permission_map = {"create": Permissions.PORTAL_ACCESS}

    def perform_create(self, serializer):
        serializer.save(customer=self.request.user.customer_profile)
```

Only the `queryset` line changes on `PortalTicketViewSet`; every other line (`serializer_class`, `permission_map`, `ordering_fields`, `get_queryset`, `perform_create`) is unchanged from PORTAL-2.

---

### 5 — Route `POST /api/portal/feedback/`

**File: `backend/apps/portal/urls.py`** — add one more `path()`:

```python
from .views import PortalFeedbackViewSet, PortalTicketViewSet

# ...

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
    path(
        "portal/feedback/",
        PortalFeedbackViewSet.as_view({"post": "create"}),
        name="portal-feedback-create",
    ),
]
```

Endpoint: `POST /api/portal/feedback/`.

---

## Frontend Tasks

### 6 — `has_feedback` on the `PortalTicket` type

**File: `frontend/src/features/portal/types/portalTicket.ts`** — add one field to `PortalTicket`:

```ts
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
  has_feedback: boolean
}
```

---

### 7 — `features/portal/types/portalFeedback.ts` and `api/`

**Create file: `frontend/src/features/portal/types/portalFeedback.ts`**

```ts
/** Mirrors `apps.tickets.models.Feedback.Rating` — matches CONVENTIONS.md
 * §25's already-recorded RPT-4 chart design verbatim; not an arbitrary
 * choice. See Story 47 `## Prerequisites`. */
export const PORTAL_FEEDBACK_RATINGS = ['satisfied', 'neutral', 'dissatisfied'] as const
export type PortalFeedbackRating = (typeof PORTAL_FEEDBACK_RATINGS)[number]

/** The write shape. `ticket` comes from the route param, never a field the
 * customer edits — see `PortalFeedbackFormPage`. */
export type PortalFeedbackInput = {
  ticket: number
  rating: PortalFeedbackRating
  comment: string
}

export type PortalFeedbackCreated = {
  id: number
}
```

**Create file: `frontend/src/features/portal/api/createPortalFeedback.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { PortalFeedbackCreated, PortalFeedbackInput } from '../types/portalFeedback'

export function createPortalFeedback(input: PortalFeedbackInput): Promise<PortalFeedbackCreated> {
  return api.post<PortalFeedbackCreated>('/portal/feedback/', input)
}
```

**Create file: `frontend/src/features/portal/api/usePortalFeedbackMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createPortalFeedback } from './createPortalFeedback'
import { portalTicketKeys } from './portalTicketKeys'
import type { PortalFeedbackInput } from '../types/portalFeedback'

/**
 * Invalidates `portalTicketKeys.all`, not a new `portal-feedback` key
 * prefix — there is no feedback list/detail cached anywhere (create-only,
 * see PortalFeedbackViewSet). What a successful submission actually
 * changes is `has_feedback` on the ticket the customer just rated, so the
 * ticket cache is the one that must go stale, the same
 * invalidate-the-thing-that-changed reasoning `useCreatePortalTicket`
 * already uses.
 */
export function useCreatePortalFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PortalFeedbackInput) => createPortalFeedback(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalTicketKeys.all }),
  })
}
```

---

### 8 — `PortalFeedbackFormPage`

**Create file: `frontend/src/features/portal/components/PortalFeedbackFormPage.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import * as z from 'zod'

import { choice, optionalString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, RadioGroupField, TextareaField, useAppForm } from '@/shared/ui/form'
import { useToast } from '@/shared/ui/toast/useToast'

import { useCreatePortalFeedback } from '../api/usePortalFeedbackMutations'
import { PORTAL_FEEDBACK_RATINGS } from '../types/portalFeedback'

const schema = z.object({
  rating: choice(PORTAL_FEEDBACK_RATINGS),
  comment: optionalString(2000),
})

type FormValues = z.output<typeof schema>

/**
 * Reached only from `PortalTicketDetailPage`'s "Rate this ticket" link
 * (task 9) — no data is fetched here (no GET call), so unlike
 * `PortalTicketDetailPage` there is no `Number.isNaN` guard: a bad or
 * tampered `:id` simply produces a server validation error on submit
 * ("That ticket does not belong to you." / not resolved/closed), surfaced
 * by `FormErrorSummary` exactly like any other server-side rejection.
 */
export function PortalFeedbackFormPage() {
  const { t } = useTranslation('portal')
  const navigate = useNavigate()
  const { toast } = useToast()
  const { id: idParam } = useParams()
  const ticketId = Number(idParam)
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    // 'satisfied' as the initial radio selection, matching the precedent
    // `TicketFormPage`'s own priority Select sets (a concrete default, not
    // an empty one) — see Story 47 `## Explicitly out of scope`'s note
    // that a real product might prefer no pre-selection to avoid biasing
    // responses; not built here, since no story asks for it.
    defaultValues: { rating: 'satisfied', comment: '' },
  })

  const mutation = useCreatePortalFeedback()

  function onSubmit(values: FormValues) {
    mutation.mutate(
      { ticket: ticketId, rating: values.rating, comment: values.comment ?? '' },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('tickets.feedback.created') })
          navigate(`/portal/tickets/${ticketId}`, { replace: true })
        },
        onError: (error) => {
          if (isValidationError(error)) {
            setFormErrors(applyServerErrors(form, error))
          }
        },
      },
    )
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('tickets.feedback.title')}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <RadioGroupField
            control={form.control}
            name="rating"
            label={t('tickets.feedback.fields.rating')}
            options={PORTAL_FEEDBACK_RATINGS.map((value) => ({
              value,
              label: t(`tickets.feedback.ratings.${value}`),
            }))}
          />
          <TextareaField
            control={form.control}
            name="comment"
            label={t('tickets.feedback.fields.comment')}
          />
          <FormErrorSummary errors={formErrors} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('tickets.feedback.actions.submit')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
```

A `ticket`-keyed server error (wrong ownership, wrong status, duplicate submission) has no matching RHF field — `applyServerErrors` (verified, `## Prerequisites`) routes it into `formErrors` automatically; no extra handling needed here.

---

### 9 — The "Rate this ticket" call to action

**File: `frontend/src/features/portal/components/PortalTicketDetailPage.tsx`** — add `Button` to the existing imports, and one conditional block directly after the closing `</Card>`:

```tsx
import { Button } from '@/shared/ui/primitives/button'

// ...inside the QueryBoundary render prop, after </Card>:

              {!ticket.has_feedback &&
              (ticket.status === 'resolved' || ticket.status === 'closed') ? (
                <Button asChild>
                  <Link to={`/portal/tickets/${ticket.id}/feedback`}>
                    {t('tickets.feedback.cta')}
                  </Link>
                </Button>
              ) : null}
              {ticket.has_feedback ? (
                <p className="text-sm text-muted-foreground">{t('tickets.feedback.thanks')}</p>
              ) : null}
```

`Link` is already imported (used by the existing "back to my tickets" link).

---

### 10 — Wire `/portal/tickets/:id/feedback`

**File: `frontend/src/app/router.tsx`** — add one sibling entry alongside the existing `tickets/:id` route. No ordering constraint against `tickets/:id` — `tickets/:id/feedback` is a deeper, distinct path (three segments vs. two) that cannot be shadowed by it:

```tsx
              {
                path: 'tickets/:id',
                lazy: async () => {
                  const { PortalTicketDetailPage } =
                    await import('@/features/portal/components/PortalTicketDetailPage')
                  return { element: <PortalTicketDetailPage /> }
                },
              },
              {
                path: 'tickets/:id/feedback',
                lazy: async () => {
                  const { PortalFeedbackFormPage } =
                    await import('@/features/portal/components/PortalFeedbackFormPage')
                  return { element: <PortalFeedbackFormPage /> }
                },
              },
```

Full path: `/portal/tickets/:id/feedback`.

---

### 11 — Locale keys

**File: `frontend/src/features/portal/locales/en.json`** — add a `feedback` block inside the existing `tickets` key, alongside `fields`/`actions`/`statuses`/`priorities`/`list`/`filters`/`detail`/`history`:

```json
    "feedback": {
      "cta": "Rate this ticket",
      "thanks": "Thanks for your feedback.",
      "title": "Rate your experience",
      "fields": {
        "rating": "How satisfied were you?",
        "comment": "Comments (optional)"
      },
      "ratings": {
        "satisfied": "Satisfied",
        "neutral": "Neutral",
        "dissatisfied": "Dissatisfied"
      },
      "actions": {
        "submit": "Submit feedback"
      },
      "created": "Thank you for your feedback."
    }
```

**File: `frontend/src/features/portal/locales/ar.json`** — the same key structure, translated. Every key present in `en` must exist in `ar` (`CONVENTIONS.md` §18) — a missing key falls back silently to English.

---

## Edge Cases & Failure Modes

- **A customer resubmitting feedback for the same ticket gets a clean `400`, not a `500`.** DRF's auto-derived `UniqueValidator` on `ticket` (un-overridden field, `OneToOneField` → unique) catches it before the database ever sees a duplicate-key attempt — verified via `apps/customers/serializers.py`'s own documented DRF behaviour (`## Prerequisites`).
- **A customer submitting feedback for another customer's ticket id gets a clean `400` naming `ticket`, not a `403` and not a `404`.** `validate_ticket` checks `ticket.customer_id != customer.id` explicitly — deliberately a validation error, not relying on `CustomerScopedModelViewSet`'s `get_queryset()` scoping, because `create()` never calls `get_queryset()` (the same PORTAL-1 lesson `PortalTicketViewSet.perform_create` forcing `customer` already applies, here applied to validating a *reference* instead of forcing a value).
- **Feedback for an `open`/`in_progress` ticket is rejected with a clear message, not silently accepted.** `validate_ticket`'s status check — the "post-resolution" half of the intake's own wording, enforced server-side regardless of what the frontend CTA's visibility condition does.
- **`has_feedback` costs no extra query per row on `list`.** `select_related("feedback")` works for the reverse side of a `OneToOneField` in Django (unlike a reverse `ForeignKey`, which needs `prefetch_related`) — verified Django ORM behaviour, task 4.
- **A ticket deleted by staff (`TicketViewSet.destroy`, `Permissions.TICKETS_MANAGE`) takes its feedback with it.** `Feedback.ticket`'s `CASCADE` — deliberate, the same "no existence independent of its parent" reasoning `TicketActivity.ticket` already uses. Not expected to happen often in practice (deleting a ticket with real history is rare), but the data no longer means anything once its subject is gone.
- **Deleting a `Customer` while their feedback exists.** `Feedback.customer` is `CASCADE`, but in practice `Ticket.customer`'s own `on_delete=PROTECT` already blocks deleting a `Customer` with any ticket — and every `Feedback` row has a ticket — so `Feedback`'s `CASCADE` is defensively correct but never actually the thing that fires first.
- **The pre-selected `'satisfied'` radio default is a real, if minor, survey-design tradeoff.** A product that cares about unbiased CSAT responses would likely want no pre-selection, forcing an explicit choice. Not built here — see `## Explicitly out of scope` and task 8's own comment; this matches the existing precedent (`TicketFormPage`'s priority `Select` also pre-selects a concrete default) rather than inventing a new "start empty" pattern for one field.
- **A hand-crafted request omitting `rating` entirely** gets DRF's own standard "this field is required" validation error (`rating` has no `blank=True`/`null=True` on the model, so `required=True` is the correct DRF-derived default) — no custom handling needed.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — clean, and the existing suite reports the same passing count as before this change; `MigrationStateTests.test_no_pending_migrations` is what catches the model shipping without its migration.
2. `ruff format --check .` / `ruff check .` on the new and changed Python.
3. `npm run build` — typechecks `PortalFeedbackFormPage`, the new types/API files, the `has_feedback` field, and the new router entry.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl` — unchanged gates over the new files.
5. Real HTTP checks proving the ownership/status/duplicate validations all actually fire, and that `has_feedback` flips correctly after a real submission — Verification Steps 3–8. This is where the story's actual claims get tested; nothing static can see any of them.

---

## Migration / Rollback

**One schema migration, no data migration.** `apps/tickets/migrations/0007_feedback.py` creates the `Feedback` table — purely additive, no existing row touched, **no database reset required**.

**Rollback of the code:** revert the commits. No `npm install`/`pip install` needed — no new dependency in either app.

**Rollback of the schema:** `python manage.py migrate tickets 0006_ticketactivity` drops the `Feedback` table. Safe at any time — nothing else references it (no other model has an FK to `Feedback`).

**Half-applied states to avoid:**

- **Task 1's model before its migration** → `MigrationStateTests.test_no_pending_migrations` fails the build. Commit together.
- **Task 4's `PortalFeedbackViewSet` before task 1's model/migration land** → `ImportError` on Django startup. Ship task 1 before tasks 3–5.
- **Task 3's `PortalTicketSerializer.has_feedback` before task 1's `Feedback` model exists** → the reverse `related_name="feedback"` accessor does not exist yet, and `hasattr` would need the model to be migrated first for the table to even be queryable. Ship task 1 first.
- **Task 10's router entry before task 8's `PortalFeedbackFormPage.tsx`/task 9's `PortalTicketDetailPage.tsx` edit exist** → `npm run build` fails on the missing lazy import. Ship tasks 8–9 before task 10.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` — `python manage.py check`, `ruff format --check .`, `ruff check .` — all clean.
2. **Migration applies forward, no reset:** `python manage.py migrate` — `tickets.0007_feedback` applies; `python manage.py showmigrations tickets` shows it applied.
3. **A customer can rate their own resolved/closed ticket:**

   ```powershell
   $t = (curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/ -H "Content-Type: application/json" -d '{\"email\":\"cust1@example.com\",\"password\":\"Sup3rSecret!\"}' | ConvertFrom-Json).data.access
   # Use a ticket id belonging to cust1 that is resolved or closed.
   curl.exe -s -X POST http://127.0.0.1:8000/api/portal/feedback/ -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d '{\"ticket\":<closed-ticket-id>,\"rating\":\"satisfied\",\"comment\":\"Quick and helpful.\"}'
   ```

   Expect `201`.
4. **`has_feedback` flips to `true` for that ticket, and to `false` for one with none:** `GET /api/portal/tickets/<that-id>/` with the same token → `data.has_feedback: true`. A different, unrated ticket → `false`.
5. **A second submission for the same ticket is rejected, not a 500:** repeat step 3's exact request. Expect `400`, `error.fields.ticket` naming the duplicate (DRF's auto `UniqueValidator` message).
6. **Feedback for another customer's ticket is rejected:** repeat step 3 with a ticket id belonging to `cust2`/Customer Two. Expect `400`, `error.fields.ticket` = *"That ticket does not belong to you."*
7. **Feedback for a non-resolved/closed ticket is rejected:** repeat step 3 with an `open`/`in_progress` ticket id belonging to `cust1`. Expect `400`, `error.fields.ticket` = *"Feedback can only be submitted for a resolved or closed ticket."*
8. **A staff account, or unauthenticated request, cannot submit feedback:** repeat step 3 with a staff token lacking `portal.access` → `403`. With no `Authorization` header → `401`.
9. **Frontend builds and lints clean:** from `frontend/` — `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` — all exit 0.
10. **The end-to-end flow works in the browser, in both languages.** With the backend running: `npm run dev`, log in as `cust1@example.com`, open a resolved/closed ticket's detail page — the "Rate this ticket" button appears. Submit a rating and comment: a success toast appears, the app navigates back to the ticket detail page, and "Rate this ticket" is now replaced by the "Thanks for your feedback" message. Switch to Arabic and repeat on a different eligible ticket: all copy (title, rating labels, button, toast) renders in Arabic.

---

## Done Criteria

- [ ] `Feedback` model exists in `apps/tickets/models.py` — `ticket` a `OneToOneField` (`CASCADE`), `customer` a direct `ForeignKey` (`CASCADE`), `rating` a `TextChoices` with exactly `satisfied`/`neutral`/`dissatisfied` (matching `CONVENTIONS.md` §25's `RPT-4` chart design), `comment` optional.
- [ ] `apps/tickets/migrations/0007_feedback.py` committed alongside the model; applies with **no database reset**.
- [ ] `Feedback` registered in Django admin (`FeedbackAdmin`), the interim way to see submitted feedback before `RPT-4`.
- [ ] `PortalFeedbackSerializer` exists in `apps/portal/serializers.py`; `ticket`'s auto-derived `UniqueValidator` (un-overridden field) prevents a duplicate submission with a clean `400`; `validate_ticket` rejects another customer's ticket and a non-resolved/closed one.
- [ ] `PortalFeedbackViewSet` exists in `apps/portal/views.py`, `create`-only, `permission_map = {"create": Permissions.PORTAL_ACCESS}` — no new `Permissions` constant.
- [ ] `POST /api/portal/feedback/` routed in `apps/portal/urls.py`.
- [ ] `PortalTicketSerializer.has_feedback` exists (`SerializerMethodField`, `hasattr(ticket, "feedback")`); `PortalTicketViewSet.queryset` gains `"feedback"` in its `select_related` tuple.
- [ ] Verified by real HTTP (Steps 3–8): a customer can rate their own eligible ticket; a duplicate submission 400s cleanly; another customer's ticket is rejected; a non-resolved/closed ticket is rejected; staff/unauthenticated callers are denied.
- [ ] `frontend/src/features/portal/types/portalFeedback.ts`, `api/{createPortalFeedback.ts,usePortalFeedbackMutations.ts}`, and `components/PortalFeedbackFormPage.tsx` all exist; `PortalTicket` gains `has_feedback: boolean`.
- [ ] `PortalTicketDetailPage` shows "Rate this ticket" when eligible (resolved/closed, no feedback yet) and "Thanks for your feedback" once submitted.
- [ ] `frontend/src/app/router.tsx` routes `/portal/tickets/:id/feedback`.
- [ ] `features/portal/locales/{en,ar}.json` both have the new `tickets.feedback.*` block, with identical key sets.
- [ ] `python manage.py check`/`test`, `ruff format --check .`, `ruff check .`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` all exit 0.
- [ ] `.squad/plans/customer-portal/00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation. This completes EPIC 10 — `customer-portal` is now fully planned (PORTAL-0 through PORTAL-5), matching `SupportOs backlog.MD` lines 556–594.**
