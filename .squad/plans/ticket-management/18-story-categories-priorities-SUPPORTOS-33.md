# Story 18 — Categories & Priorities (Story: SUPPORTOS-33)

## Prerequisites

- **Story 12 (TKT-1) completed.** `Ticket` (`apps/tickets/models.py`), `TicketViewSet`/`TicketSerializer`, `BaseModelViewSet`/`BaseModelSerializer`, `useServerTable`/`DataTable`, and `TicketFormPage`/`TicketListPage`/`TicketDetailPage` all exist and are extended, not replaced. `Ticket`'s own docstring (`models.py:8-15`) names this story explicitly: *"`status` and `priority` are deliberately minimal placeholders: TKT-2 owns real priority/category management... None of that is pre-empted here."*
- **`Ticket.priority` already exists as a real, editable field** — `models.py:23-27` (`Priority(TextChoices)`: `low`/`medium`/`high`/`urgent`), already in `TicketSerializer.Meta.fields` (`serializers.py:24`), already in `TicketViewSet.ordering_fields` (`views.py:27`), already a `SelectField` in `TicketFormPage.tsx` (lines 149-157) and a sortable column in `TicketListPage.tsx` (lines 71-76). This story does **not** add a priority model or field — "priority field with management endpoints" (intake, task 1) is satisfied by `Category`'s CRUD endpoints; priority itself needs no "management" beyond what already ships, since it is a fixed enum, not a business-configurable set.
- **`Category` does not exist yet.** Verified: no `Category` anywhere in `apps/tickets/models.py` (55 lines) or `apps/tickets/**`. `backend/apps/README.md:63` already assigns it a home: *"`tickets` — Tickets, categories, priorities, status transitions, history."* — confirming `Category` belongs in `apps.tickets`, not a new app.
- **This is the project's first nullable foreign key.** Every existing FK is required: `Ticket.customer` (`PROTECT`), `Message.ticket` (`CASCADE`), `ContactDetail.customer` (`CASCADE`). `Ticket.category` is optional — a ticket can be uncategorized — so it needs `null=True, blank=True` and a third `on_delete` behaviour, `SET_NULL`: deleting a `Category` must leave every ticket that had it intact, just uncategorized, unlike `PROTECT` (blocks deletion) or `CASCADE` (deletes the ticket too). Django requires `null=True` for `SET_NULL` to be valid at all — verified: `django.db.models.ForeignKey.__init__` raises `models.E320` via system checks otherwise (not exercised here since `null=True` is set from the start).
- **DRF derives `required=False`/`allow_null=True` for `TicketSerializer.category` automatically — no explicit field declaration needed.** Verified by reading the installed library: `rest_framework/utils/field_mapping.py::get_relation_kwargs`, lines 286-287 (`if model_field.null: kwargs['allow_null'] = True`) and lines 293-294 (`if model_field.has_default() or model_field.blank or model_field.null: kwargs['required'] = False`). `category_name` (the read-only display field, mirroring `customer_name`) **does** need an explicit declaration with `allow_null=True`, because `source="category.name"` must not error when `category` is `None` — verified safe: `rest_framework/fields.py::Field.get_attribute`, lines 444-450, catches the `AttributeError` from `getattr(None, "name")` and returns `None` when `self.allow_null` is `True`.
- **No `django-filter` dependency exists, and this story does not add one.** Verified: no `django_filter`/`DjangoFilterBackend` reference anywhere in `backend/`; `REST_FRAMEWORK.DEFAULT_FILTER_BACKENDS` (`config/settings/base.py:232-235`) is `OrderingFilter` + `SearchFilter` only. Equality filtering (`?category=`, `?priority=`) is hand-written in `TicketViewSet.get_queryset`, the same pattern `MessageViewSet`/`ContactDetailViewSet` already use for their (required) `ticket`/`customer` params — this story's filters are the same mechanism, made **optional** instead of required.
- **No equality-filter UI exists anywhere in the project yet.** `CustomerListPage`/`TicketListPage` (Story 10/12) have free-text `search` and sortable columns only. This story is the first to add a dropdown filter to a list screen; `shared/ui/LanguageSwitcher.tsx` (44 lines) is the only existing precedent for the plain `Select` primitive driven by local component state (`value`/`onValueChange`) rather than React Hook Form's `Controller` — the shape task 9's filter `Select`s copy.
- **`Category` is fully owned by `features/tickets/`, not a cross-feature type.** Unlike `CustomerOption` (`frontend/src/features/tickets/types/customerOption.ts`), which exists only because `no-restricted-imports` forbids importing `@/features/customers`, `Category` is a `tickets`-domain concept per `apps/README.md`'s own table — no boundary is being crossed, so the full `Category` type (not a minimal "*Option" mirror) is used everywhere in this feature: the list column, the form selector, and the filter dropdown.
- **No new permission constants** — the intake says "Reuse `AUTHZ`" explicitly. `CategoryViewSet` reuses `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE` (`apps/core/permissions.py:31-32`), already granted to `admin`/`manager`/`agent` by `apps/tickets/migrations/0002_grant_ticket_permissions.py` — this story adds **no new grant migration**, mirroring `MessageViewSet`'s reuse of the same constants (Story 13 `## Product rules`).

---

## Story Goal

1. **`Category` model + CRUD API** (`CategoryViewSet`, reusing `tickets.*` permissions) and a nullable `Ticket.category` FK (`SET_NULL`) — "classify tickets" (intake, task 1's outcome).
2. **A category selector in the ticket form**, alongside the existing priority selector, and **category/priority filter dropdowns on the ticket list**, alongside the existing free-text search and sortable columns — "filter/sort by category/priority" (intake, task 2's outcome). Priority is already sortable; this story adds equality **filtering** for both category and priority, and a **column** for category (not sortable, mirroring `customer_name`'s own precedent).

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `Category` model + `CategoryViewSet` | The intake's literal ask — "management endpoints," reusing `AUTHZ`. |
| `Ticket.category` (nullable FK, `SET_NULL`) | Links a ticket to a category without forcing every ticket to have one. |
| Category `SelectField` in `TicketFormPage.tsx` | The intake's "selectors." |
| Category/priority filter `Select`s in `TicketListPage.tsx` | The intake's "list filters." |
| `category_name` column (not sortable) | Mirrors `customer_name`'s exact precedent (Story 12) — a joined display column, not sortable. |

**Not here, and why:**

- **No frontend category-management screen** (a "Categories" admin page to create/edit/delete categories from the UI). The intake's task 2 names only "selectors" and "list filters" — no CRUD screen. Categories are managed via `POST/PATCH/DELETE /api/categories/` directly, or Django admin (`CategoryAdmin`, task 4) — the same "admin handles it until a UI is explicitly asked for" boundary the comm stories drew for provider config.
- **No `search_fields` change to `TicketViewSet`** (e.g. adding `category__name`). The intake separates "search" from "filter/sort by category/priority" — free-text search is unchanged.
- **No status filter.** Not named in the intake; `status`-related UI is `TKT-4`'s (`status-transition validation, escalation`), unchanged from Story 12's own scope boundary.
- **No assignment, "my tickets," or status/escalation UI.** `TKT-3`/`TKT-4`'s own stories — Story 12's scope-boundary table (`.squad/plans/ticket-management/00-overview.md`) already draws this line.

---

## Context — Read These Files First

1. `.squad/stories/ticket-management/SUPPORTOS-33/intake.md` — two task blocks, **no attachments, no acceptance criteria**.
2. `SupportOs backlog.MD` lines 322-327 (`STORY (TKT-2) — Categories & Priorities`).
3. `backend/apps/tickets/models.py` (55 lines, after Story 12) — `Ticket`'s docstring (lines 8-15, naming this story), `Priority(TextChoices)` (lines 23-27, already real), `customer` FK (`PROTECT`, lines 39-41) and `Meta` (lines 49-52) — the exact shape `Category` and `Ticket.category` follow/extend.
4. `backend/apps/tickets/serializers.py` (27 lines) — `TicketSerializer.customer_name` (line 13, `source="customer.name"`) — the direct precedent `category_name` copies, with the added `allow_null=True` this FK's nullability requires.
5. `backend/apps/tickets/views.py` (28 lines) — `TicketViewSet` has **no `get_queryset` override today**; `MessageViewSet.get_queryset` (`apps/communications/views.py`, ~lines 44-55, after Story 17) is the structural precedent for a hand-written query-param filter, adapted here to be **optional** instead of required.
6. `backend/apps/tickets/urls.py` (15 lines) — one `SimpleRouter` registering `"tickets"` only; `backend/apps/customers/urls.py` (11 lines) is the precedent for registering **two** viewsets on one router (`router.register("customers", ...)` + `router.register("contact-details", ...)`), copied here for `"tickets"` + `"categories"`.
7. `backend/apps/tickets/admin.py` (21 lines) — `TicketAdmin` (`list_display`, `list_filter`, `search_fields`, `readonly_fields`); `backend/apps/customers/admin.py`'s `CustomerAdmin`/`ContactDetailAdmin` pair is the precedent for a second, sibling `ModelAdmin` in the same file.
8. `backend/apps/tickets/migrations/0001_initial.py` (35 lines) and `0002_grant_ticket_permissions.py` (43 lines) — confirms `TICKETS_VIEW`/`TICKETS_MANAGE` are already granted to `admin`/`manager`/`agent`; this story's migration depends on `0002` and adds no grant of its own.
9. `backend/apps/core/permissions.py` lines 31-32 (`Permissions.TICKETS_VIEW`/`TICKETS_MANAGE`) — the constants `CategoryViewSet.permission_map` reuses verbatim.
10. `backend/config/settings/base.py` lines 218-237 (`REST_FRAMEWORK`) — confirms `DEFAULT_FILTER_BACKENDS` is `OrderingFilter`/`SearchFilter` only, no `django_filter`.
11. `frontend/src/features/tickets/types/ticket.ts` (30 lines) — `Ticket`/`TicketInput` types this story extends with `category`/`category_name`.
12. `frontend/src/features/tickets/components/TicketFormPage.tsx` (169 lines, after Story 12) — `ticketSchema`, `EMPTY_DEFAULTS`, `toDefaults`/`toTicketInput`, the `customer`/`priority` `SelectField`s (lines 143-157) — the exact shape the category selector copies.
13. `frontend/src/features/tickets/components/TicketListPage.tsx` (119 lines, after Story 12) — `columns` (lines 51-83, `customer_name` at 58-64 is the "joined column, not sortable" precedent), the `search`/`searchInput` state + debounce + page-reset `useEffect` (lines 34-47) — the exact pattern the category/priority filter state copies.
14. `frontend/src/features/tickets/components/TicketDetailPage.tsx` (113 lines, after Story 12) — the `<dl>` grid (lines 57-82) this story adds one `<div>` to.
15. `frontend/src/features/tickets/api/getCustomerOptions.ts` (14 lines) / `useCustomerOptions.ts` (18 lines) — the `page_size: 100, ordering: 'name'` shape `getCategories.ts`/`useCategories.ts` copy exactly (same simplification: no search-as-you-type combobox exists yet).
16. `frontend/src/features/tickets/api/getTickets.ts` (11 lines) — `TicketListParams = ServerTableParams & { search?: string }`, extended with `category`/`priority`.
17. `frontend/src/shared/ui/LanguageSwitcher.tsx` (44 lines) — the plain `Select` (`value`/`onValueChange`, not `Controller`) pattern the list-page filters copy; `frontend/src/shared/ui/primitives/select.tsx` — confirms `SelectItem` takes a `value: string` prop (a non-empty sentinel, e.g. `"all"`/`"none"`, stands in for "no selection"/"no filter" — the same reason `LanguageSwitcher` never needs one, since every language is a real selectable value).
18. `frontend/src/features/tickets/locales/en.json`/`ar.json` (66/66 lines) — `fields`/`priorities` namespaces this story extends; no `filters` namespace exists yet.
19. `CONVENTIONS.md` § 19 (lines 381-487, "Design system, theming & data tables" — `DataTable`/`useServerTable`'s sort-resets-page-1 rule, extended here for filters), § 23 (lines 823+, feature module conventions — the FK-deletion-behaviour and optional-vs-required-filter patterns this story's own addition documents).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **`Category` model + CRUD API, reusing `AUTHZ`.** | Intake, task 1 | `Category(TimeStampedModel)`, `CategoryViewSet` (`permission_map` = `TICKETS_VIEW`/`TICKETS_MANAGE`, no new constants). |
| **Priority field already exists — no new model, no new "management" beyond CRUD on categories.** | This story's design, per `## Prerequisites` | No change to `Ticket.priority`. |
| **Category selector in the ticket form.** | Intake, task 2 | `TicketFormPage.tsx`'s new `category` `SelectField`. |
| **List filters for category and priority.** | Intake, task 2 | `TicketListPage.tsx`'s new `Select`s, merged into `useTickets`' params the same way `search` already is. |
| **Deleting a category never blocks or deletes tickets — it just unsets them.** | This story's design | `Ticket.category`'s `on_delete=models.SET_NULL`. |
| **An equality filter is optional: absent means "no filter," present-but-malformed is a `400`, never a silent no-op.** | This story's design | `TicketViewSet.get_queryset`'s `category`/`priority` handling. |
| Wire format is `snake_case` end to end; a cleared nullable field is sent as explicit `null`, never omitted. | § 12, § 23 | `category: number \| null` in `TicketInput`; `TicketFormPage`'s "no category" option always sends `category: null`, never omits the key. |
| Config from `ENV`; no new secret, no new dependency. | § 17 | N/A — no provider, no new package. |

---

## Backend Tasks

### 1 — The `Category` model and `Ticket.category` field

**File: `backend/apps/tickets/models.py`** — add `Category` before `Ticket`, and replace `Ticket`'s docstring:

```python
class Category(TimeStampedModel):
    """A ticket classification tag — TKT-2's own model. Unlike
    `ContactDetail` (shared machinery reused by every channel adapter),
    nothing outside `apps.tickets` references this model. See Story 18
    `## Story Goal`.
    """

    name = models.CharField(_("name"), max_length=100, unique=True)

    class Meta:
        verbose_name = _("category")
        verbose_name_plural = _("categories")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Ticket(TimeStampedModel):
    """A support ticket — the core record EPIC 4's sibling stories extend.

    `priority` and `category` are real as of Story 18 (TKT-2): `Category`
    is a full CRUD resource (`CategoryViewSet`), and `priority` has always
    been the editable `TextChoices` field it appears as. `status` is still
    a placeholder pending TKT-4 (status-transition validation, escalation).
    TKT-3 owns assignment, TKT-5 owns activity history. None of that is
    pre-empted here.
    """
```

Add the field to `Ticket`, after `customer`:

```python
    # SET_NULL, not PROTECT or CASCADE: the project's first nullable FK.
    # Contrast `customer` above (PROTECT — an identity that must not
    # silently vanish) and `Message.ticket` (CASCADE — no existence
    # independent of its parent, Story 13). A category is a classification
    # tag: deleting one should leave every ticket that had it intact, just
    # uncategorized. See Story 18 `## Prerequisites`.
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
        verbose_name=_("category"),
    )
```

**Migration:** from `backend/`, venv active:

```
python manage.py makemigrations tickets
```

Expect **one** new file under `apps/tickets/migrations/` containing a `CreateModel` for `Category` and an `AddField` for `Ticket.category` (`null=True`, `on_delete=django.db.models.deletion.SET_NULL`). Depends on `("tickets", "0002_grant_ticket_permissions")` — Django adds this automatically. **No new permission-grant migration** — see `## Prerequisites`.

---

### 2 — Serializers

**File: `backend/apps/tickets/serializers.py`** — replace entirely:

```python
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Category, Ticket


class CategorySerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = Category
        fields = ("id", "name", "created_at", "updated_at")


class TicketSerializer(BaseModelSerializer):
    # Read-only convenience for the list/detail screens — without it, every
    # row would show a bare numeric customer id. Source traverses the FK;
    # the viewset's `select_related("customer")` (task 3) is what keeps this
    # from costing an extra query per row on `list`.
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    # `category` itself needs no explicit declaration — DRF derives
    # `required=False`/`allow_null=True` from the model field's own
    # `null=True`/`blank=True` (verified, see Story 18 `## Prerequisites`).
    # `category_name` does need one: `allow_null=True` is what makes
    # `source="category.name"` return `None` instead of erroring when a
    # ticket has no category — also verified against DRF's own source.
    category_name = serializers.CharField(
        source="category.name", read_only=True, allow_null=True
    )

    class Meta(BaseModelSerializer.Meta):
        model = Ticket
        fields = (
            "id",
            "subject",
            "description",
            "customer",
            "customer_name",
            "category",
            "category_name",
            "status",
            "priority",
            "created_at",
            "updated_at",
        )
```

---

### 3 — Views and routing

**File: `backend/apps/tickets/views.py`** — replace entirely:

```python
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Category, Ticket
from .serializers import CategorySerializer, TicketSerializer


class CategoryViewSet(BaseModelViewSet):
    """Category CRUD — TKT-2's own management endpoints. Reuses `tickets.*`
    — a category is part of the ticket domain, not a separate permission
    domain (mirrors `MessageViewSet`'s reuse of the same constants, Story 13
    `## Product rules`). See Story 18 `## Prerequisites`.
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    ordering_fields = ("name", "created_at")
    search_fields = ("name",)


class TicketViewSet(BaseModelViewSet):
    """Ticket CRUD. The second consumer of `BaseModelViewSet`, after Customer."""

    queryset = Ticket.objects.select_related("customer", "category").all()
    serializer_class = TicketSerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    # Each name here must match a `ColumnDef.id` on the frontend, exactly
    # like `CustomerViewSet`. `customer`/`customer_name`/`category_name` are
    # deliberately absent — see Story 12 `## Story Goal` for why
    # `customer_name` is not sortable, the same choice this story makes for
    # `category_name`.
    ordering_fields = ("subject", "status", "priority", "created_at")
    search_fields = ("subject", "description", "customer__name")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset

        # Optional, unlike MessageViewSet/ContactDetailViewSet's required
        # `ticket`/`customer` params (Story 11/13) — a ticket list must
        # still work with no filter applied. Present-but-malformed input is
        # still a 400, not a silent no-op. See Story 18 `## Product rules`.
        category_id = self.request.query_params.get("category")
        if category_id:
            try:
                category_id = int(category_id)
            except ValueError:
                raise ValidationError(
                    {"category": [_("Must be a valid category id.")]}
                ) from None
            queryset = queryset.filter(category_id=category_id)

        priority = self.request.query_params.get("priority")
        if priority:
            if priority not in Ticket.Priority.values:
                raise ValidationError({"priority": [_("Must be a valid priority.")]})
            queryset = queryset.filter(priority=priority)

        return queryset
```

**File: `backend/apps/tickets/urls.py`** — replace entirely:

```python
from rest_framework.routers import SimpleRouter

from .views import CategoryViewSet, TicketViewSet

app_name = "tickets"

# SimpleRouter, not DefaultRouter: apps.customers.urls already mounts a
# DefaultRouter at the same `path("")` prefix in config/api_urls.py, and its
# auto-generated API-root view already claims `/api/` (Story 10). A second
# DefaultRouter mounted at the same prefix would register a second, dead
# root view. SimpleRouter generates none — see Story 12 `## Prerequisites`.
# Two viewsets on one router, mirroring apps/customers/urls.py's
# customers/contact-details pair (Story 11).
router = SimpleRouter()
router.register("tickets", TicketViewSet, basename="ticket")
router.register("categories", CategoryViewSet, basename="category")

urlpatterns = router.urls
```

No `config/api_urls.py` change — `apps.tickets.urls` is already included (Story 12).

---

### 4 — Admin

**File: `backend/apps/tickets/admin.py`** — extend imports and add `CategoryAdmin`:

```python
from django.contrib import admin

from apps.communications.models import Message

from .models import Category, Ticket


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ("direction", "channel", "body", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Also the de facto category-management UI for now — this story ships
    no frontend CRUD screen for categories. See Story 18 `## Story Goal`.
    """

    list_display = ("name", "created_at")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "customer", "category", "status", "priority", "created_at")
    list_filter = ("status", "priority", "category")
    search_fields = ("subject", "description", "customer__name")
    readonly_fields = ("created_at", "updated_at")
    inlines = (MessageInline,)
```

(`TicketAdmin.list_display`/`list_filter` gain `category` — everything else unchanged.)

---

## Frontend Tasks

### 5 — Category type and API layer

**Create file: `frontend/src/features/tickets/types/category.ts`**

```ts
/** Mirrors `apps.tickets.serializers.CategorySerializer` verbatim. Owned by
 * this feature — `Category` is a `tickets`-domain concept
 * (`backend/apps/README.md`), not a cross-feature boundary the way
 * `CustomerOption` is. */
export type Category = {
  id: number
  name: string
  created_at: string
  updated_at: string
}
```

**Create file: `frontend/src/features/tickets/api/getCategories.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Category } from '../types/category'

// page_size: 100 (the server's max) — no search-as-you-type combobox exists
// yet, the same simplification `getCustomerOptions.ts` accepted.
export function getCategories(): Promise<Page<Category>> {
  return api.getPage<Category>('/categories/', { params: { page_size: 100, ordering: 'name' } })
}
```

**Create file: `frontend/src/features/tickets/api/useCategories.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getCategories } from './getCategories'
import { ticketKeys } from './ticketKeys'

export function useCategories() {
  return useQuery({
    queryKey: ticketKeys.resource('categories'),
    queryFn: getCategories,
  })
}
```

---

### 6 — Ticket type

**File: `frontend/src/features/tickets/types/ticket.ts`** — replace entirely:

```ts
/** `as const` arrays, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`). */
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

/** Mirrors `apps.tickets.serializers.TicketSerializer` verbatim. */
export type Ticket = {
  id: number
  subject: string
  description: string
  customer: number
  customer_name: string
  category: number | null
  category_name: string | null
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  updated_at: string
}

/** The write shape. `status` is excluded on purpose: this story ships no
 * status-changing UI (TKT-4 owns it) — the server default (`open`) is what
 * every created ticket gets, and there is no form field to send anything
 * else. `category` is nullable — a ticket may be uncategorized; the form
 * always sends this key explicitly (`null` to clear), never omits it. */
export type TicketInput = {
  subject: string
  description: string
  customer: number
  category: number | null
  priority: TicketPriority
}
```

---

### 7 — Ticket form: category selector

**File: `frontend/src/features/tickets/components/TicketFormPage.tsx`** — extend imports, schema, defaults, and JSX:

```tsx
import { useCategories } from '../api/useCategories'
```

```tsx
// Radix's `Select.Item` requires a non-empty `value` — this sentinel stands
// in for "no category" the same way the list filters' `"all"` sentinel
// stands in for "no filter" (task 9). See CONVENTIONS.md §19.
const CATEGORY_NONE = 'none'

const ticketSchema = z.object({
  subject: requiredString(200),
  description: requiredString(5000),
  customer: z.string().min(1),
  category: z.string().min(1),
  priority: choice(TICKET_PRIORITIES),
})

type FormValues = z.output<typeof ticketSchema>

const EMPTY_DEFAULTS: FormValues = {
  subject: '',
  description: '',
  customer: '',
  category: CATEGORY_NONE,
  priority: 'medium',
}

function toDefaults(ticket: Ticket): FormValues {
  return {
    subject: ticket.subject,
    description: ticket.description,
    customer: String(ticket.customer),
    category: ticket.category === null ? CATEGORY_NONE : String(ticket.category),
    priority: ticket.priority,
  }
}

function toTicketInput(values: FormValues): TicketInput {
  return {
    subject: values.subject,
    description: values.description,
    customer: Number(values.customer),
    category: values.category === CATEGORY_NONE ? null : Number(values.category),
    priority: values.priority,
  }
}
```

Inside `TicketForm`, add the query and gate on it alongside `customerOptionsQuery`:

```tsx
  const customerOptionsQuery = useCustomerOptions()
  const categoriesQuery = useCategories()
```

```tsx
  {customerOptionsQuery.isPending || categoriesQuery.isPending ? (
    <Loading />
  ) : (
```

Build the options and add the selector between `customer` and `priority`:

```tsx
  const categoryOptions =
    categoriesQuery.data?.items.map((category) => ({
      value: String(category.id),
      label: category.name,
    })) ?? []
```

```tsx
            <SelectField
              control={form.control}
              name="customer"
              label={t('fields.customer')}
              options={customerOptions}
            />
            <SelectField
              control={form.control}
              name="category"
              label={t('fields.category')}
              options={[{ value: CATEGORY_NONE, label: t('fields.noCategory') }, ...categoryOptions]}
            />
            <SelectField
              control={form.control}
              name="priority"
              label={t('fields.priority')}
              options={TICKET_PRIORITIES.map((value) => ({
                value,
                label: t(`priorities.${value}`),
              }))}
            />
```

---

### 8 — Ticket list: category column and filters

**File: `frontend/src/features/tickets/api/getTickets.ts`** — replace entirely:

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Ticket, TicketPriority } from '../types/ticket'

export type TicketListParams = ServerTableParams & {
  search?: string
  category?: string
  priority?: TicketPriority
}

export function getTickets(params: TicketListParams): Promise<Page<Ticket>> {
  return api.getPage<Ticket>('/tickets/', { params })
}
```

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`** — extend imports, state, params, columns, and JSX:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'

import { useCategories } from '../api/useCategories'
import { useTickets } from '../api/useTickets'
import { TICKET_PRIORITIES } from '../types/ticket'
import type { Ticket, TicketPriority } from '../types/ticket'
```

```tsx
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  // "all" is the sentinel for "no filter" — Radix's Select.Item requires a
  // non-empty value, mirroring the form's CATEGORY_NONE sentinel.
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const categoriesQuery = useCategories()

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  // A filter change narrows the result set the same way a search does —
  // reset to page 1, or the user can land on a now-nonexistent page.
  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter, priorityFilter, setPage])

  const query = useTickets({
    ...params,
    ...(search ? { search } : {}),
    ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter as TicketPriority } : {}),
  })
```

Add the column, right after `customer_name`:

```tsx
    {
      id: 'category_name',
      header: t('fields.category'),
      // Not sortable: mirrors `customer_name`'s precedent (Story 12) — a
      // joined/derived display column, not in the viewset's
      // `ordering_fields`. See Story 18 `## Prerequisites`.
      cell: (row) => row.category_name ?? t('fields.noCategory'),
    },
```

Add the filter row between the search `Input` and `DataTable`:

```tsx
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('search')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger aria-label={t('filters.category')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
            {(categoriesQuery.data?.items ?? []).map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
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
```

---

### 9 — Ticket detail: category display

**File: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — add one `<div>` to the `<dl>` grid, right after the customer entry:

```tsx
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.category')}</dt>
                      <dd>{ticket.category_name ?? t('fields.noCategory')}</dd>
                    </div>
```

---

### 10 — Locale namespace

**File: `frontend/src/features/tickets/locales/en.json`** — extend `fields` and add a top-level `filters` object:

```json
  "fields": {
    "subject": "Subject",
    "description": "Description",
    "customer": "Customer",
    "category": "Category",
    "noCategory": "No category",
    "status": "Status",
    "priority": "Priority",
    "createdAt": "Created"
  },
```

```json
  "filters": {
    "category": "Filter by category",
    "priority": "Filter by priority",
    "allCategories": "All categories",
    "allPriorities": "All priorities"
  },
```

(Add the `filters` block as a new top-level key, e.g. right after `priorities`.)

**File: `frontend/src/features/tickets/locales/ar.json`** — the identical key set, translated:

```json
  "fields": {
    "subject": "الموضوع",
    "description": "الوصف",
    "customer": "العميل",
    "category": "الفئة",
    "noCategory": "بدون فئة",
    "status": "الحالة",
    "priority": "الأولوية",
    "createdAt": "تاريخ الإنشاء"
  },
```

```json
  "filters": {
    "category": "تصفية حسب الفئة",
    "priority": "تصفية حسب الأولوية",
    "allCategories": "كل الفئات",
    "allPriorities": "كل الأولويات"
  },
```

---

## Documentation Tasks

### 11 — Conventions

**File: `CONVENTIONS.md`** — append one paragraph to the end of `## 19. Design system, theming & data tables` (after the "Cross-reference forward" paragraph, before the `---` that closes the section):

> **An equality filter on a list screen is local component state merged into the query params at the call site, exactly like free-text `search`** — not a `useServerTable` feature. `TicketListPage`'s category/priority filters (Story 18, `TKT-2`) are the worked example: each filter is a plain `Select` (the `LanguageSwitcher` pattern — controlled `value`/`onValueChange`, not React Hook Form's `Controller`, since a filter is not a form field) with a non-empty sentinel value (`"all"`) standing in for "no filter," because Radix's `Select.Item` requires a non-empty `value`. **Changing a filter resets the page** the same way changing `search` already does — a filtered result set can be narrower than the page the user was on.

**File: `CONVENTIONS.md`** — append two paragraphs to the end of `## 23. Feature module conventions` (after Story 17's paragraph):

> **A foreign key has three deletion behaviours in this project, chosen by what the relationship means, not by default.** `PROTECT` (`Ticket.customer`, Story 12) is for an identity relationship that must not silently vanish. `CASCADE` (`Message.ticket`, Story 13) is for a child with no existence independent of its parent. `SET_NULL` (`Ticket.category`, Story 18, `TKT-2`) is for a classification tag: deleting the referenced row should leave the referencing row intact, just unset — the FK must be `null=True` for Django to allow `SET_NULL`, making this the project's first nullable foreign key.
>
> **An optional equality filter on a list endpoint is validated when present, never required.** Contrast `MessageViewSet`/`ContactDetailViewSet`'s `ticket`/`customer` query params (Story 13/11), which raise `ValidationError` when *absent* because the endpoint is meaningless without them. `TicketViewSet`'s `category`/`priority` filters (Story 18) do the opposite: silently skip filtering when the param is absent, but still raise `ValidationError` for a present-but-malformed value (a non-numeric `category`, an unrecognised `priority`) — a list screen's default (unfiltered) view must keep working, but garbage input should not silently do nothing either.

---

## Edge Cases & Failure Modes

- **Deleting a category that tickets still reference does not fail and does not delete those tickets.** `on_delete=SET_NULL` — every ticket that had it gets `category=None`; verify via `DELETE /api/categories/<id>/` → `204`, then `GET` an affected ticket shows `"category": null, "category_name": null`.
- **`?category=<non-numeric>` and `?priority=<not-a-real-choice>` both return `400`**, not a silently-ignored filter and not a `500` — `TicketViewSet.get_queryset` raises `ValidationError` for present-but-malformed input, distinct from the "absent → no filter" case.
- **The ticket list with no filters applied is unaffected** — `category`/`priority` query params are optional; their absence is not an error, matching every list endpoint's existing default behaviour.
- **A duplicate category name is rejected at the database/serializer level**, not silently accepted twice — `Category.name` is `unique=True`, and because `name` is *not* explicitly declared on `CategorySerializer` (unlike `Customer.email`'s trap, `CONVENTIONS.md` §23), `ModelSerializer` auto-derives a `UniqueValidator` for it — verified against the same DRF behaviour that finding already documents.
- **Clearing a ticket's category via the form sends `category: null` explicitly, never omits the key.** `TicketFormPage`'s "no category" option (`CATEGORY_NONE` sentinel) always resolves to a real value in `toTicketInput` (`null`), and `updateTicket` always sends the full `TicketInput` shape via `PATCH` — matching the project's established "explicit `null` clears a nullable field, omission does not" rule.
- **The category filter dropdown and the category selector in the form both fetch `/categories/` independently** (`useCategories`, cached under `ticketKeys.resource('categories')`) — no shared cross-component cache concern, since both live in the same feature and the same TanStack Query cache.
- **Arabic category names round-trip correctly** — no ASCII assumption anywhere in `Category`/`CategorySerializer`/the frontend selector or filter.
- **A ticket list filtered to a category with zero matching tickets shows the existing empty state** (`search ? <Empty title={noSearchResults} /> : <Empty .../>`) — unchanged from Story 12, since filters reuse the same `DataTable`/`query` wiring `search` already drives, no new empty-state branch needed.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass.
2. `python manage.py makemigrations tickets --check --dry-run` (after generating and applying the real migration in task 1) — must report **no changes**.
3. `ruff format --check .` / `ruff check .` over the new Python.
4. Real HTTP: category CRUD (all four permission-gated verbs), `SET_NULL` on category delete, ticket-list filtering by category/priority (valid, malformed, absent), unfiltered list unaffected — `## Verification Steps`.
5. `npm run build`/`lint`/`format:check`/`check:rtl` for the frontend, including the new category selector/filters and the extended `Ticket` type.
6. An `en`/`ar` key-set comparison for `features/tickets/locales/` (a throwaway script, not a checked-in test) — confirms both files declare the same keys after this story's additions.

---

## Migration / Rollback

**One migration**, generated by task 1: `CreateModel` (`Category`) + `AddField` (`Ticket.category`, nullable). Depends on `0002_grant_ticket_permissions`.

**Rollback of the code:** revert the commits, then `python manage.py migrate tickets 0002` to unapply the new migration before removing it, if reverting only this story's migration (not the whole commit history).

**Half-applied states to avoid:**

- **`Ticket.category` added without `null=True`** — `makemigrations` would either refuse (`SET_NULL` requires nullable) or prompt for a one-off default interactively, breaking a non-interactive `makemigrations` run. Task 1's field declaration includes `null=True` from the start; do not add the field first and `null=True` later as a follow-up edit.
- **`CategoryViewSet` registered on the router without a `permission_map` entry for every action** — an unmapped action is authenticated-only, not forbidden (`HasPermission`'s own documented behaviour), which would let any signed-in user manage categories. Task 3's `permission_map` is fully populated; verify it stays that way if edited.
- **Task 9/10 (frontend) shipped without task 6 (`Ticket`/`TicketInput` type changes)** — `category`/`category_name` would be `undefined` at the type level everywhere they are read, surfacing as a `tsc` build failure, not a runtime bug — ship task 6 first or together with tasks 7-9.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration generated and applied cleanly:** `python manage.py makemigrations tickets` produces one file; `python manage.py migrate`; `python manage.py makemigrations tickets --check --dry-run` exits 0 with no output.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **Category CRUD, permission-gated.** With an agent token (`tickets.manage`): `POST /api/categories/` `{"name": "Billing"}` → `201`. `GET /api/categories/` → `200`, includes it. `PATCH /api/categories/<id>/` `{"name": "Billing & Payments"}` → `200`. With no token → `401` on all four; a token with no `tickets.manage` (e.g. a plain `tickets.view`-only role, if one exists, or an unauthenticated-but-valid-JWT user with an empty role) → `403` on create/update/delete, `200` on list/retrieve.
5. **A second category with the same name is rejected.** `POST /api/categories/` `{"name": "Billing & Payments"}` again → `400`, a validation error naming `name`, not a `500`.
6. **Create a ticket with a category, then delete the category — the ticket survives, uncategorized.** `POST /api/tickets/` with `"category": <id>` → `201`. `DELETE /api/categories/<id>/` → `204`. `GET /api/tickets/<ticket id>/` → `200`, `"category": null, "category_name": null` — not a `404`, not a `409`.
7. **Filtering by category and priority works, and rejects malformed input.** With two tickets in different categories: `GET /api/tickets/?category=<id>` → only that category's tickets. `GET /api/tickets/?priority=high` → only `high`-priority tickets. `GET /api/tickets/?category=notanumber` → `400`. `GET /api/tickets/?priority=not-a-real-priority` → `400`. `GET /api/tickets/` (no filters) → unfiltered, unchanged from before this story.
8. **The full bilingual UI walkthrough.** `npm run dev` with the backend up. Since this story ships no category-management screen, seed a category or two via `/admin/tickets/category/add/` (Django admin) first.
   - Open `/tickets/new` — the category selector shows "No category" plus every seeded category; leaving it unset and submitting creates a ticket with `category: null`.
   - Edit that ticket, pick a category, save — `GET`ting the ticket now shows it; the detail page (`/tickets/<id>`) shows the category's name.
   - Edit again, switch back to "No category," save — the ticket's category clears (confirms the explicit-`null` path, not just the create path).
   - On `/tickets`, use the category and priority filter dropdowns — the list narrows correctly; combining both narrows further; clearing back to "All categories"/"All priorities" restores the full list.
   - Switch to Arabic on both screens — labels translate, the filter dropdowns and selector read correctly in RTL.
9. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `Category(TimeStampedModel)` in `apps/tickets/models.py`, `name` unique, `ordering = ("name",)`.
- [ ] `Ticket.category` — nullable FK to `Category`, `on_delete=models.SET_NULL`, `related_name="tickets"`.
- [ ] One migration: `CreateModel(Category)` + `AddField(Ticket.category)`, depends on `0002_grant_ticket_permissions`. **No new permission-grant migration.**
- [ ] `CategorySerializer` (`id`, `name`, `created_at`, `updated_at`); `TicketSerializer` gains `category` (auto-derived nullable) and `category_name` (explicit, `allow_null=True`).
- [ ] `CategoryViewSet` — full CRUD, `permission_map` reuses `Permissions.TICKETS_VIEW`/`TICKETS_MANAGE`, no new constants; `ordering_fields`/`search_fields` set.
- [ ] `TicketViewSet.get_queryset` — optional `category`/`priority` filters, `400` on malformed-but-present values, no-op on absent values; `queryset` gains `select_related("category")`.
- [ ] `apps/tickets/urls.py` — `categories` registered on the same `SimpleRouter` as `tickets`.
- [ ] `apps/tickets/admin.py` — `CategoryAdmin` registered; `TicketAdmin.list_display`/`list_filter` gain `category`.
- [ ] `features/tickets/types/category.ts`, `api/getCategories.ts`, `api/useCategories.ts` — new files, mirroring `getCustomerOptions.ts`'s shape.
- [ ] `features/tickets/types/ticket.ts` — `Ticket`/`TicketInput` gain `category`/`category_name`.
- [ ] `TicketFormPage.tsx` — category `SelectField` between customer and priority, `CATEGORY_NONE` sentinel, gated on `categoriesQuery` alongside `customerOptionsQuery`.
- [ ] `TicketListPage.tsx` — `category_name` column (not sortable), category/priority filter `Select`s (plain, `LanguageSwitcher`-style, `"all"` sentinel), page resets on filter change.
- [ ] `TicketDetailPage.tsx` — category display line in the `<dl>` grid.
- [ ] `en.json`/`ar.json` — `fields.category`, `fields.noCategory`, and a new `filters` namespace, identical key sets in both languages.
- [ ] `CONVENTIONS.md` § 19 gains the equality-filter paragraph; § 23 gains the FK-deletion-behaviour and optional-filter paragraphs.
- [ ] `python manage.py test` reports **54** passing; `makemigrations tickets --check --dry-run` reports no changes; `ruff format --check .`, `ruff check .` exit 0.
- [ ] Verified by real HTTP: category CRUD across permission states (Step 4); duplicate-name rejection (Step 5); `SET_NULL` on category delete (Step 6); category/priority filtering, both valid and malformed (Step 7).
- [ ] The full bilingual UI walkthrough — create/edit/clear a ticket's category, filter the list by both category and priority, both languages (Step 8).
- [ ] `npm run lint`, `format:check`, `check:rtl`, `build` all exit 0.
- [ ] `.squad/plans/ticket-management/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** The remaining `ticket-management` stories are **TKT-3 (Assignment)** and **TKT-4 (Status & Escalation)**, each depending only on `TKT-1` (complete) and sequenceable in either order; **TKT-5 (Ticket History)** is the natural last piece. This story also unblocks **COMM-5 (Web Forms)**, which the communication-channels overview names as needing `TKT-2` in addition to `COMM-0`.
