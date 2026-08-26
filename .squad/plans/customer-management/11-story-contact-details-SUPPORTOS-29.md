# Story 11 — Contact Details (Story: SUPPORTOS-29)

## Prerequisites

- **Story 10 completed and committed** (`a53bf16`): `apps/customers/{models,serializers,views,urls,admin}.py`, migrations `0001_initial`/`0002_grant_customer_permissions`, `Permissions.CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE`, and the full `features/customers/` frontend slice (`types/customer.ts`, `api/`, `components/CustomerListPage.tsx` + `CustomerProfilePage.tsx` + `CustomerFormPage.tsx`, `locales/{en,ar}.json`). `CONVENTIONS.md` § 23 ("Feature module conventions") is the template this story follows.
- **Resolves Story 10's open forward decision.** [`00-overview.md`](00-overview.md) line 38 left open "whether `ContactDetail` supersedes story 10's primary `email`/`phone` fields or hangs beside them as additional channels." This story decides: **beside them.** `Customer.email`/`Customer.phone` stay the primary contact fields (unchanged, not touched by this story); `ContactDetail` adds *additional* channels — a second phone number, a WhatsApp identifier, a secondary email — that the two singular `Customer` columns cannot hold. Nothing in `apps/customers/models.py`'s existing `Customer` class changes.
- **No new permission constants.** The intake's task 1 says "Reuse `API`, `AUTHZ`." Verified: `ContactDetail` is part of the customer record, not a new permission domain, so this story reuses `Permissions.CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE` from `backend/apps/core/permissions.py` (lines 29–30) as-is. No grant migration is needed either — the three seeded roles (`admin`, `manager`, `agent`) already hold both strings via Story 10's `0002_grant_customer_permissions.py`.
- **Verified backend baseline:** `apps/customers/models.py` (51 lines) defines only `Customer`; `serializers.py` (52 lines) defines only `CustomerSerializer`; `views.py` (33 lines) defines only `CustomerViewSet`; `urls.py` (11 lines) registers one router entry (`"customers"`); `admin.py` (11 lines) registers only `CustomerAdmin`. This story adds `ContactDetail` alongside each, not in place of it.
- **Verified: this is the project's first FK relationship between two domain models.** `accounts.User.role` (`apps/accounts/models.py:106-109`) is the only precedent, and it uses `on_delete=PROTECT` because many `User` rows reference one `Role` and must not be silently orphaned. `ContactDetail.customer` is the opposite shape — one `Customer` owns many contacts with no independent existence — so this story uses `on_delete=CASCADE`. See `## Edge Cases`.
- **Verified: DRF auto-derives a `UniqueTogetherValidator` from a model's `UniqueConstraint` independent of whether the constrained fields are explicitly declared on the serializer** — unlike the single-field `UniqueValidator` gap `CONVENTIONS.md` § 23's last paragraph documents for `Customer.email`. Confirmed by inspecting `ModelSerializer.get_unique_together_validators()` (`rest_framework/serializers.py:1613-1653`, DRF 3.18.0, installed in `backend/.venv`) and reproducing it live: a serializer with an auto-generated FK field (`customer`) and a model-level `UniqueConstraint(fields=["customer", "channel", "value"])` picks up a `UniqueTogetherValidator(fields=('customer', 'channel', 'value'))` with **zero** explicit `validators=[...]` on the serializer. This story's `ContactDetailSerializer` therefore declares no fields at all beyond `Meta` — see task 2.
- **Verified: DRF's own Arabic translation catalog covers the unique-together message.** `rest_framework/locale/ar/LC_MESSAGES/django.mo` translates `UniqueTogetherValidator.message` ("The fields {field_names} must make a unique set.") — confirmed live with `django.utils.translation.activate('ar')`. A duplicate-contact submission is therefore already localised with no extra work, consistent with `CONVENTIONS.md` § 18's note that Django/DRF's own messages ship pre-compiled `.mo` files.
- **Verified: filtering a queryset by a non-numeric value for an integer FK raises a bare `ValueError`, not a Django/DRF validation error.** Reproduced live: `Customer.objects.filter(pk='abc')` raises `ValueError: Field 'id' expected a number but got 'abc'.` `apps/core/exceptions.py`'s `_to_drf_exception` (lines 50-59) only translates `Http404`, `DjangoPermissionDenied`, and `DjangoValidationError` — a bare `ValueError` falls through `drf_exception_handler` (which returns `None` for it) into `_internal_error_response`, an **unhandled 500**. This is why task 3's `get_queryset` explicitly catches the `int()` conversion. See `## Edge Cases`.
- **Verified: `python manage.py test` currently reports 54 passing**, matching Story 10's baseline exactly — confirming no drift since that story landed.

---

## Story Goal

1. A `ContactDetail` model — channel-typed (`email` / `phone` / `whatsapp`), related to `Customer`, full CRUD through `BaseModelViewSet`, gated by the **existing** `customers.view` / `customers.manage` permissions (no new permission strings).
2. An inline "contact channels" section on the customer profile screen (`CustomerProfilePage.tsx`) — add, edit, and remove contacts without leaving the page. **No new route.** The intake's task 2 says "manage contacts inline," which this story reads literally: no `/customers/:id/contacts` screen, no list-page column, no `DataTable`.
3. Per-channel value validation: an `email`-channel contact must be a valid email address (reusing `django.core.validators.validate_email`, matching how `Customer.email`'s format is enforced); `phone`/`whatsapp` stay plain text, same as `Customer.phone`.

### Explicitly out of scope

- **No change to `Customer.email`/`Customer.phone`.** They remain the primary contact fields; see `## Prerequisites`.
- **No new permission constants, no new grant migration.** `customers.view`/`customers.manage` already cover this sub-resource.
- **No dedicated `/customers/:id/contacts` route, no `DataTable`.** The UI is inline on the existing profile screen; the list is small enough (`page_size=100`, the server's max) to need no pagination controls.
- **No "primary contact" flag, no per-contact label/nickname field.** The intake asks for channel-typed contacts and CRUD, nothing else. A customer can hold any number of contacts per channel (e.g. two phone numbers); nothing here picks one as "the" number.
- **Case-insensitive email dedup.** The uniqueness constraint (`customer`, `channel`, `value`) is an exact string match — `A@x.com` and `a@x.com` are treated as different contacts. Accepted; see `## Edge Cases`.

---

## Context — Read These Files First

1. `backend/apps/customers/models.py` (51 lines) — `Customer`, including its `email`/`clean()` normalisation pattern (lines 24-26, 41-51) that `ContactDetailSerializer.validate` (task 2) follows for the `email`-channel case.
2. `backend/apps/customers/serializers.py` (52 lines) — `CustomerSerializer`, in particular the comment block on `email` (lines 16-33) explaining why an **explicitly declared** unique field needs its own `UniqueValidator`. `ContactDetailSerializer` does **not** hit this gap — see `## Prerequisites`' verified finding — so it declares no fields at all.
3. `backend/apps/customers/views.py` (33 lines) — `CustomerViewSet`'s `permission_map` (lines 19-26) and `queryset`/`serializer_class` shape. `ContactDetailViewSet` (task 3) copies the same `permission_map` values verbatim (same two permissions).
4. `backend/apps/customers/urls.py` (11 lines) — the single `DefaultRouter().register("customers", ...)` call. Task 3 adds a second `.register(...)` call to the same router instance.
5. `backend/apps/customers/admin.py` (11 lines) — `CustomerAdmin`'s `list_display`/`search_fields`/`readonly_fields` shape, which `ContactDetailAdmin` (task 4) follows.
6. `backend/apps/core/permissions.py` — `Permissions.CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE` (lines 29-30). No new constant is added.
7. `backend/apps/core/exceptions.py` — `envelope_exception_handler` (lines 25-47) and `_to_drf_exception` (lines 50-59). Confirms a raised `rest_framework.exceptions.ValidationError` becomes a `validation_error` envelope with `fields`, and that a bare `ValueError` does **not** — it becomes an unhandled `internal_error`. This is the reasoning behind task 3's `int()` guard.
8. `backend/apps/accounts/models.py` around lines 106-109 — `User.role`'s `ForeignKey(..., on_delete=PROTECT, related_name="users")`. Contrast with task 1's `on_delete=CASCADE` on `ContactDetail.customer` — read `## Edge Cases` for why the two differ.
9. `frontend/src/features/customers/types/customer.ts` (19 lines) — the `Customer`/`CustomerInput` mirror pattern task 5's `types/contactDetail.ts` follows, including the `as const` array idiom for a closed string set (`CONVENTIONS.md` § 3's `erasableSyntaxOnly` rule — no `enum`).
10. `frontend/src/features/customers/api/` — all nine files. `customerKeys.ts` (`featureKey('customers')`), `getCustomers.ts` (the `api.getPage` + query-params pattern), `useCustomerMutations.ts` (the prefix-invalidation convention task 5 **deliberately narrows** for this sub-resource — see `## Product rules`).
11. `frontend/src/features/customers/components/CustomerProfilePage.tsx` (97 lines) — the exact insertion point for task 7 is between the closing `</Card>` (line 88) and the closing `</QueryBoundary>` (line 90), inside the `(customer) => (...)` render prop. The component's `QueryBoundary`/`useConfirm`/`<Can permission="customers.manage">` patterns are what `ContactDetailsSection` (task 7) reuses.
12. `frontend/src/features/customers/components/CustomerFormPage.tsx` (137 lines) — the `useAppForm` + local `schema` + `applyServerErrors`/`isValidationError` + `useToast` pattern task 7's add/edit forms follow. Note `formErrors` state (line 91) and how it renders (lines 127-129).
13. `frontend/src/shared/validation/schemas.ts` — `requiredString`, `email`, `choice` (lines 11-13, 25-27, 64-66). Task 7 uses all three; it adds **no new helper** to this shared file (contrast Story 10, which added `nullableString`/`nullableEmail` here — this story's validation is feature-local, see `## Product rules`).
14. `frontend/src/shared/ui/form/SelectField.tsx` (all 68 lines) — the `Select`/`Controller` wiring task 7's channel dropdown uses. Note the docstring: `field.value`/`field.onChange` are wired explicitly, never `{...field}`.
15. `frontend/src/shared/lib/api/client.ts` — `api.getPage` (lines 162-173), which throws `invalid_envelope` if `meta.pagination` is missing. Confirms `ContactDetailViewSet` (a `ModelViewSet`, inheriting the project-wide `DefaultPageNumberPagination`) always returns a paginated envelope, so `getContactDetails` (task 5) can use `api.getPage` directly.
16. `frontend/src/shared/lib/api/queryKeys.ts` (13 lines) — `featureKey`'s `resource(resource, ...rest)` signature. Task 5 calls `customerKeys.resource('contacts', customerId)` — a new resource name under the **existing** `customers` feature key, not a new feature.
17. `frontend/src/shared/ui/confirm/useConfirm.ts` and its use in `CustomerProfilePage.tsx` (lines 30-39) — the confirm-then-mutate-then-done pattern task 7's remove action follows.
18. `CONVENTIONS.md` § 18 (bidi rule — wrap a Latin-script value in `dir="ltr"` inside Arabic text; a contact's `value` is exactly this case, every channel), § 20 (forms, the `custom` issue rule this story's channel-conditional validation relies on), § 22 (permission_map convention), and § 23 (feature module conventions — this story's two documented departures are in `## Product rules`).
19. `README.md` § Consuming the API from the frontend, lines 425-436 (query keys, mutations & invalidation). Task 8 appends a short exception to the invalidation paragraph.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **CRUD via base viewset / envelope / permissions; reuse `AUTHZ`.** | Intake, task 1 | `ContactDetailViewSet(BaseModelViewSet)` with the **same** `permission_map` values as `CustomerViewSet` — no new permission constants. |
| **Reuse `API`.** | Intake, task 1 constraints | Plain payloads; `EnvelopeJSONRenderer` + `DefaultPageNumberPagination` shape the response. `api.getPage`/`api.post`/`api.patch`/`api.delete`. |
| **Channel-typed: email / phone / WhatsApp.** | Intake, task 1 | `ContactDetail.Channel` (`TextChoices`): `EMAIL`, `PHONE`, `WHATSAPP`. |
| **Manage inline on the profile; reuse shared primitives + `FORM`.** | Intake, task 2 | `ContactDetailsSection` embedded directly in `CustomerProfilePage.tsx`. No new route, no `DataTable`. `useAppForm` + `SelectField`/`TextField`. |
| **Scoped invalidation, not prefix-wide — a deliberate, documented departure from `CONVENTIONS.md` § 23.** | This story's design | `CONVENTIONS.md` § 23 says every mutation invalidates `<feature>Keys.all` because a paginated list's page/sort position can shift. Contacts are neither paginated nor sorted against sibling data — a write for customer A never affects customer B's contacts or the customer list/detail queries. `useContactDetailMutations.ts` invalidates only `customerKeys.resource('contacts', customerId)`. Task 8 documents this exception in `README.md`. |
| **Validation is feature-local, not a new shared helper — a deliberate departure from Story 10's pattern.** | This story's design | Story 10 added `nullableString`/`nullableEmail` to the *shared* `schemas.ts` because a nullable-column pattern recurs across features. Per-channel conditional validation (email format required only when `channel === 'email'`) is specific to `ContactDetail` and has no second consumer yet — per `CONVENTIONS.md` § 8's "keep it in its feature until a second consumer appears," it stays in `ContactDetailsSection.tsx`. |
| Wire format is `snake_case` end to end. | § 12 | `ContactDetail`/`ContactDetailInput` TS types mirror the serializer verbatim. |
| Config from `ENV`; no new secrets, no new dependency. | § 17 | This story adds no environment variable and no package — `validate_email` is Django core, `UniqueConstraint` is Django core. |

---

## Backend Tasks

### 1 — The `ContactDetail` model

**File: `backend/apps/customers/models.py`** — append below `Customer`:

```python
class ContactDetail(TimeStampedModel):
    """A single additional contact channel for a customer — CUST-2.

    Additive to `Customer.email`/`Customer.phone`, not a replacement: those
    two stay the primary contact fields (Story 10's open forward decision,
    now resolved this way — see Story 11 `## Story Goal`). `ContactDetail`
    covers channels the two singular `Customer` columns cannot hold: a
    second phone number, a WhatsApp identifier, a secondary email.
    """

    class Channel(models.TextChoices):
        EMAIL = "email", _("Email")
        PHONE = "phone", _("Phone")
        WHATSAPP = "whatsapp", _("WhatsApp")

    # CASCADE, not PROTECT: contrast `accounts.User.role` (PROTECT, because
    # many users reference one role that must not vanish silently). A
    # contact has no existence independent of its customer — deleting the
    # customer should delete its contacts, not block on them.
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="contacts", verbose_name=_("customer")
    )
    channel = models.CharField(_("channel"), max_length=20, choices=Channel.choices)
    # One column for every channel's value, like `Customer.phone`: an email
    # address, a phone number, and a WhatsApp identifier are all "a string
    # with a length cap" at the model layer. Per-channel format validation
    # is the serializer's job (`ContactDetailSerializer.validate`) — DRF
    # does not call model `clean()`, and this model deliberately has none.
    value = models.CharField(_("value"), max_length=254)

    class Meta:
        verbose_name = _("contact detail")
        verbose_name_plural = _("contact details")
        ordering = ("customer", "channel", "id")
        constraints = [
            models.UniqueConstraint(
                fields=["customer", "channel", "value"],
                name="unique_customer_channel_value",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.get_channel_display()}: {self.value}"
```

`ordering = ("customer", "channel", "id")` — same reasoning as `Customer.Meta.ordering`: pagination requires a deterministic order or Django emits `UnorderedObjectListWarning`.

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations customers
```

Expect one new file (likely `apps/customers/migrations/0003_contactdetail.py` — confirm the actual name Django assigns and adjust `## Verification Steps` step 2 if it differs). **Commit it** — `MigrationStateTests.test_no_pending_migrations` fails the build otherwise, same as Story 10.

---

### 2 — Serializer

**File: `backend/apps/customers/serializers.py`** — add the `ContactDetail` import to the existing `from .models import Customer` line (alphabetised: `ContactDetail, Customer`) and append:

```python
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
```

(add these two imports above the existing `rest_framework`/`apps.core` imports, third-party block, alphabetised: `django` before `rest_framework`)

```python
class ContactDetailSerializer(BaseModelSerializer):
    """No fields declared beyond `Meta` — verified unnecessary. `customer` is
    a required FK the ModelSerializer auto-generates as `PrimaryKeyRelatedField`,
    and the (customer, channel, value) `UniqueConstraint` auto-derives a
    `UniqueTogetherValidator` with no `validators=[...]` needed, unlike the
    single-field gap `CustomerSerializer.email` works around. See Story 11
    `## Prerequisites` for the verified proof.
    """

    class Meta(BaseModelSerializer.Meta):
        model = ContactDetail
        fields = ("id", "customer", "channel", "value", "created_at", "updated_at")

    def validate(self, attrs):
        """Per-channel value format: an email-channel contact must parse as
        an email address. DRF does not call model `clean()`, and this model
        deliberately has none, so this is the one enforcement point.

        `channel`/`value` fall back to the existing instance's value on a
        PATCH that sends only the other one, so a partial update still
        validates the pair together.
        """
        channel = attrs.get("channel", getattr(self.instance, "channel", None))
        value = attrs.get("value", getattr(self.instance, "value", None))
        if channel == ContactDetail.Channel.EMAIL and value:
            try:
                validate_email(value)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"value": list(exc.messages)}) from exc
        return attrs

    def update(self, instance, validated_data):
        """Reassigning a contact to a different customer is not a supported
        operation — delete and recreate under the new customer instead.
        `customer` stays writable on create (it's how the contact is
        attached in the first place) but is ignored on every PATCH."""
        validated_data.pop("customer", None)
        return super().update(instance, validated_data)
```

---

### 3 — Viewset and routing

**File: `backend/apps/customers/views.py`** — add two imports at the top (`django.utils.translation` and `rest_framework.exceptions`, both third-party, `django` before `rest_framework`), extend the existing `from .models import Customer` and `from .serializers import CustomerSerializer` lines to include `ContactDetail`/`ContactDetailSerializer`, and append:

```python
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError
```

```python
class ContactDetailViewSet(BaseModelViewSet):
    """CRUD for a customer's contact channels. Reuses `customers.*` —
    CUST-2 is part of the customer record, not a separate permission domain
    (Story 11 `## Product rules`).
    """

    queryset = ContactDetail.objects.all()
    serializer_class = ContactDetailSerializer

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        customer_id = self.request.query_params.get("customer")
        if not customer_id:
            raise ValidationError({"customer": [_("This query parameter is required.")]})
        try:
            customer_id = int(customer_id)
        except ValueError:
            raise ValidationError({"customer": [_("Must be a valid customer id.")]}) from None
        return queryset.filter(customer_id=customer_id)
```

`list` requires `?customer=<id>` and rejects a missing or non-numeric value as a clean `validation_error` — **verified necessary**, not defensive: an unguarded `queryset.filter(customer_id="abc")` raises a bare `ValueError` at evaluation time, which `apps/core/exceptions.py`'s handler does not translate, producing an unhandled `internal_error` (500). See `## Prerequisites`' verified finding and `## Edge Cases`. `retrieve`/`update`/`partial_update`/`destroy` need no such guard — they resolve by `pk` in the URL, not by query param.

**File: `backend/apps/customers/urls.py`** — one more `.register()` call on the existing `router`:

```python
from .views import ContactDetailViewSet, CustomerViewSet

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")
router.register("contact-details", ContactDetailViewSet, basename="contact-detail")
```

Endpoints: `GET/POST /api/contact-details/` (list requires `?customer=<id>`), `GET/PATCH/DELETE /api/contact-details/<pk>/`. No change to `config/api_urls.py` — the existing `path("", include("apps.customers.urls"))` already covers both router registrations.

---

### 4 — Admin

**File: `backend/apps/customers/admin.py`** — replace the file:

```python
from django.contrib import admin

from .models import ContactDetail, Customer


class ContactDetailInline(admin.TabularInline):
    model = ContactDetail
    extra = 0
    fields = ("channel", "value", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "company", "created_at")
    search_fields = ("name", "email", "company")
    readonly_fields = ("created_at", "updated_at")
    inlines = (ContactDetailInline,)


@admin.register(ContactDetail)
class ContactDetailAdmin(admin.ModelAdmin):
    list_display = ("customer", "channel", "value", "created_at")
    list_filter = ("channel",)
    search_fields = ("value", "customer__name", "customer__email")
    readonly_fields = ("created_at", "updated_at")
```

---

## Frontend Tasks

### 5 — Types, API layer, and query keys

**Create file: `frontend/src/features/customers/types/contactDetail.ts`**

```ts
/** `as const` array, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`). */
export const CONTACT_CHANNELS = ['email', 'phone', 'whatsapp'] as const
export type ContactChannel = (typeof CONTACT_CHANNELS)[number]

/** Mirrors `apps.customers.serializers.ContactDetailSerializer` verbatim. */
export type ContactDetail = {
  id: number
  customer: number
  channel: ContactChannel
  value: string
  created_at: string
  updated_at: string
}

/** The create shape — `customer` attaches the contact; see `ContactDetailUpdateInput`. */
export type ContactDetailInput = {
  customer: number
  channel: ContactChannel
  value: string
}

/** The edit shape. `customer` is excluded: the serializer's `update()` ignores
 * it even if sent — see `backend/apps/customers/serializers.py`. */
export type ContactDetailUpdateInput = Pick<ContactDetailInput, 'channel' | 'value'>
```

**Create file: `frontend/src/features/customers/api/getContactDetails.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { ContactDetail } from '../types/contactDetail'

// `page_size: 100` (the server's max — `DRF_MAX_PAGE_SIZE`) requests every
// contact in one page. This list has no pagination UI (a handful of rows
// inline on the profile); the default page size (25) would silently hide a
// customer's later contacts with no "load more" control to reveal them.
export function getContactDetails(customerId: number): Promise<Page<ContactDetail>> {
  return api.getPage<ContactDetail>('/contact-details/', {
    params: { customer: customerId, page_size: 100 },
  })
}
```

**Create file: `frontend/src/features/customers/api/createContactDetail.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { ContactDetail, ContactDetailInput } from '../types/contactDetail'

export function createContactDetail(input: ContactDetailInput): Promise<ContactDetail> {
  return api.post<ContactDetail>('/contact-details/', input)
}
```

**Create file: `frontend/src/features/customers/api/updateContactDetail.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { ContactDetail, ContactDetailUpdateInput } from '../types/contactDetail'

export function updateContactDetail(
  id: number,
  input: ContactDetailUpdateInput,
): Promise<ContactDetail> {
  return api.patch<ContactDetail>(`/contact-details/${id}/`, input)
}
```

**Create file: `frontend/src/features/customers/api/deleteContactDetail.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export function deleteContactDetail(id: number): Promise<void> {
  return api.delete(`/contact-details/${id}/`)
}
```

**Create file: `frontend/src/features/customers/api/useContactDetails.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getContactDetails } from './getContactDetails'

export function useContactDetails(customerId: number) {
  return useQuery({
    queryKey: customerKeys.resource('contacts', customerId),
    queryFn: () => getContactDetails(customerId),
  })
}
```

**Create file: `frontend/src/features/customers/api/useContactDetailMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createContactDetail } from './createContactDetail'
import { customerKeys } from './customerKeys'
import { deleteContactDetail } from './deleteContactDetail'
import { updateContactDetail } from './updateContactDetail'
import type { ContactDetailInput, ContactDetailUpdateInput } from '../types/contactDetail'

/**
 * Scoped invalidation, narrower than `customerKeys.all` — a deliberate
 * departure from `useCustomerMutations.ts`. CONVENTIONS.md §23's prefix-wide
 * rule exists because a paginated/sorted list's page or sort position can
 * shift on a write; contacts are neither. A contact write for one customer
 * never affects another customer's contacts, or the customer list/detail
 * queries, so invalidating only this customer's `contacts` key is precise —
 * see Story 11 `## Product rules`.
 */
function useInvalidateContacts(customerId: number) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: customerKeys.resource('contacts', customerId) })
}

export function useCreateContactDetail(customerId: number) {
  const invalidate = useInvalidateContacts(customerId)
  return useMutation({
    mutationFn: (input: ContactDetailInput) => createContactDetail(input),
    onSuccess: invalidate,
  })
}

export function useUpdateContactDetail(customerId: number, id: number) {
  const invalidate = useInvalidateContacts(customerId)
  return useMutation({
    mutationFn: (input: ContactDetailUpdateInput) => updateContactDetail(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteContactDetail(customerId: number) {
  const invalidate = useInvalidateContacts(customerId)
  return useMutation({
    mutationFn: (id: number) => deleteContactDetail(id),
    onSuccess: invalidate,
  })
}
```

No `contactDetailKeys.ts` file — this sub-resource reuses the existing `customerKeys` (`featureKey('customers')`) with a new resource name, `'contacts'`, rather than introducing a second feature key (`## Product rules`).

---

### 6 — Locale additions

**File: `frontend/src/features/customers/locales/en.json`** — add a `contacts` key alongside the existing top-level keys (no new namespace, no `resources.ts` change):

```json
"contacts": {
  "title": "Contact channels",
  "empty": "No contact channels yet.",
  "fields": {
    "channel": "Channel",
    "value": "Value"
  },
  "channels": {
    "email": "Email",
    "phone": "Phone",
    "whatsapp": "WhatsApp"
  },
  "actions": {
    "add": "Add",
    "edit": "Edit",
    "remove": "Remove",
    "save": "Save",
    "cancel": "Cancel"
  },
  "delete": {
    "title": "Remove this contact channel?",
    "description": "This permanently removes the contact channel. This cannot be undone."
  },
  "created": "Contact channel added.",
  "updated": "Contact channel updated.",
  "deleted": "Contact channel removed."
}
```

**File: `frontend/src/features/customers/locales/ar.json`** — the same key set, translated (e.g. `"title": "قنوات التواصل"`, `"empty": "لا توجد قنوات تواصل بعد."`, `"channels": {"email": "البريد الإلكتروني", "phone": "الهاتف", "whatsapp": "واتساب"}` — translate every leaf; `## Verification Steps` step 4 checks the key sets match exactly).

---

### 7 — Inline contact management on the profile

**Create file: `frontend/src/features/customers/components/ContactDetailsSection.tsx`**

```tsx
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import * as z from 'zod'

import { choice, email, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Can } from '@/shared/auth'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { SelectField, TextField, useAppForm } from '@/shared/ui/form'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import {
  useCreateContactDetail,
  useDeleteContactDetail,
  useUpdateContactDetail,
} from '../api/useContactDetailMutations'
import { useContactDetails } from '../api/useContactDetails'
import { CONTACT_CHANNELS } from '../types/contactDetail'
import type { ContactDetail } from '../types/contactDetail'

// `value`'s format depends on `channel`: email-channel contacts must parse as
// an email address (mirrors `ContactDetailSerializer.validate` on the
// backend), phone/whatsapp stay plain text. `superRefine` re-raises `email()`'s
// OWN issue (code `invalid_format`, format `email`) at the `value` path
// instead of a hand-written message, so it still routes through the shared
// error map by code — verified against zod@4.4.3: `ctx.addIssue({...issue,
// path: ['value']})` preserves `code`/`format` and the map resolves
// `invalid_format.email` exactly as `email()`'s own callers do. See
// CONVENTIONS.md §20's "custom issue keeps its own message" rule — this is
// the sibling case, an issue with a STANDARD code re-pathed, not a literal.
const contactSchema = z
  .object({
    channel: choice(CONTACT_CHANNELS),
    value: requiredString(254),
  })
  .superRefine((data, ctx) => {
    if (data.channel === 'email') {
      const result = email().safeParse(data.value)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({ ...issue, path: ['value'] })
        }
      }
    }
  })

type ContactFormValues = z.output<typeof contactSchema>

function channelOptions(t: TFunction<'customers'>) {
  return CONTACT_CHANNELS.map((value) => ({ value, label: t(`contacts.channels.${value}`) }))
}

export function ContactDetailsSection({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const query = useContactDetails(customerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('contacts.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <QueryBoundary
          query={query}
          isEmpty={(page) => page.items.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('contacts.empty')}</p>}
        >
          {(page) => (
            <ul className="flex flex-col gap-2">
              {page.items.map((contact) => (
                <ContactDetailRow key={contact.id} customerId={customerId} contact={contact} />
              ))}
            </ul>
          )}
        </QueryBoundary>
        <Can permission="customers.manage">
          <ContactDetailAddForm customerId={customerId} />
        </Can>
      </CardContent>
    </Card>
  )
}

function ContactDetailRow({
  customerId,
  contact,
}: {
  customerId: number
  contact: ContactDetail
}) {
  const { t } = useTranslation('customers')
  const { confirm } = useConfirm()
  const [isEditing, setIsEditing] = useState(false)
  const deleteMutation = useDeleteContactDetail(customerId)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('contacts.delete.title'),
      description: t('contacts.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(contact.id)
  }

  if (isEditing) {
    return (
      <ContactDetailEditForm
        customerId={customerId}
        contact={contact}
        onDone={() => setIsEditing(false)}
      />
    )
  }

  return (
    <li className="flex items-center justify-between gap-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{t(`contacts.channels.${contact.channel}`)}</Badge>
        {/* Latin-script value (an email, a phone number) inside an Arabic
            document needs an explicit LTR wrap — CONVENTIONS.md §18. */}
        <span dir="ltr">{contact.value}</span>
      </div>
      <Can permission="customers.manage">
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            {t('contacts.actions.edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deleteMutation.isPending}
            onClick={() => void handleDelete()}
          >
            {t('contacts.actions.remove')}
          </Button>
        </div>
      </Can>
    </li>
  )
}

function ContactDetailAddForm({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema: contactSchema, defaultValues: { channel: 'email', value: '' } })
  const mutation = useCreateContactDetail(customerId)

  function onSubmit(values: ContactFormValues) {
    mutation.mutate(
      { customer: customerId, ...values },
      {
        onSuccess: () => {
          toast({ tone: 'success', message: t('contacts.created') })
          form.reset({ channel: 'email', value: '' })
          setFormErrors([])
        },
        onError: (error) => {
          if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
          // A non-validation failure is already toasted by the shared
          // mutation error handler — CONVENTIONS.md §21.
        },
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-3 border-t pt-4">
        <div className="flex gap-2">
          <SelectField
            control={form.control}
            name="channel"
            label={t('contacts.fields.channel')}
            options={channelOptions(t)}
          />
          <TextField control={form.control} name="value" label={t('contacts.fields.value')} />
        </div>
        {formErrors.length > 0 ? (
          <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending} className="self-start">
          {t('contacts.actions.add')}
        </Button>
      </form>
    </Form>
  )
}

function ContactDetailEditForm({
  customerId,
  contact,
  onDone,
}: {
  customerId: number
  contact: ContactDetail
  onDone: () => void
}) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({
    schema: contactSchema,
    defaultValues: { channel: contact.channel, value: contact.value },
  })
  const mutation = useUpdateContactDetail(customerId, contact.id)

  function onSubmit(values: ContactFormValues) {
    mutation.mutate(values, {
      onSuccess: () => {
        toast({ tone: 'success', message: t('contacts.updated') })
        onDone()
      },
      onError: (error) => {
        if (isValidationError(error)) setFormErrors(applyServerErrors(form, error))
      },
    })
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border p-2">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <SelectField
              control={form.control}
              name="channel"
              label={t('contacts.fields.channel')}
              options={channelOptions(t)}
            />
            <TextField control={form.control} name="value" label={t('contacts.fields.value')} />
          </div>
          {formErrors.length > 0 ? (
            <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
          ) : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {t('contacts.actions.save')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone}>
              {t('contacts.actions.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </li>
  )
}
```

**File: `frontend/src/features/customers/components/CustomerProfilePage.tsx`** — wrap the existing `<Card>` (lines 49-88) and a new `<ContactDetailsSection>` in a fragment inside the `(customer) => (...)` render prop (line 48), so both render as siblings once the customer has loaded:

```tsx
{(customer) => (
  <>
    <Card>
      {/* ...unchanged... */}
    </Card>
    <ContactDetailsSection customerId={customer.id} />
  </>
)}
```

Add `import { ContactDetailsSection } from './ContactDetailsSection'` to the top of the file.

---

## Documentation Tasks

### 8 — CONVENTIONS.md and README.md addenda

**File: `CONVENTIONS.md`** — append two short paragraphs to the end of `## 23. Feature module conventions` (after the existing final paragraph on the verified `UniqueValidator` trap), **not** a new numbered section — this is a refinement of the same feature-module template, not a new one:

1. **A child resource of an existing feature reuses the parent's permissions.** A sub-resource that is part of an existing domain record (e.g. `ContactDetail` on `Customer`) does not get its own permission constants — it is gated by the parent feature's existing `permission_map` values. Add a new constant only when the sub-resource is a genuinely separate authorization concern.
2. **A non-paginated, per-parent child resource may invalidate its own scoped query key instead of the whole feature prefix**, when a write cannot affect a sibling query's result set (no shared pagination, no shared sort). State the reasoning at the call site — this is a documented exception, not the default; the default (§23's own rule above) is still prefix-wide invalidation for anything paginated or sorted. `apps/customers/features/customers/api/useContactDetailMutations.ts` (Story 11, `CUST-2`) is the worked example.

**File: `README.md`** — append one sentence to the end of the **Mutations & invalidation** paragraph (after "...never by leaving the key out.", around line 436):

> **Exception:** a non-paginated child resource scoped to one parent (e.g. a customer's contact channels) may invalidate only its own scoped key instead of the whole feature prefix, when a write cannot affect a sibling query — see `frontend/src/features/customers/api/useContactDetailMutations.ts`.

No `.env.example` change, no new environment variable.

---

## Edge Cases & Failure Modes

- **`ContactDetail.customer` uses `CASCADE`, not `PROTECT`.** Deleting a `Customer` deletes every one of its contacts with no confirmation beyond the existing delete-customer confirm dialog (`CustomerProfilePage.tsx`'s `useConfirm()` call). This is correct — a contact has no meaning without its customer — and is the opposite of `accounts.User.role`'s `PROTECT`, where many rows share one referenced row that must not vanish silently. Do not copy `PROTECT` here.
- **A non-numeric or missing `?customer=` on `GET /api/contact-details/` must return `validation_error`, not `internal_error`.** Verified live: an unguarded `queryset.filter(customer_id="abc")` raises a bare `ValueError` that `apps/core/exceptions.py` does not translate, producing an unhandled 500. Task 3's `get_queryset` catches both the missing case and the non-numeric case explicitly. `## Verification Steps` exercises both.
- **A duplicate `(customer, channel, value)` is a `validation_error` on `non_field_errors`, not an `IntegrityError`.** The model's `UniqueConstraint` auto-derives a `UniqueTogetherValidator` — verified via live inspection of `ModelSerializer.get_unique_together_validators()`, no explicit `validators=[...]` needed. `applyServerErrors` already routes `non_field_errors` into its `unattached` return value (`error.nonFieldErrors`, seeded before the per-field loop in `shared/validation/serverErrors.ts`), so `ContactDetailAddForm`/`ContactDetailEditForm`'s existing `formErrors` rendering needs no special-casing for this error.
- **Two contacts with the same value on *different* channels are allowed** — the uniqueness constraint is on the `(customer, channel, value)` triple, so `phone: "0555"` and `whatsapp: "0555"` for the same customer coexist. This is intentional: the same number can be a phone and a separate WhatsApp entry.
- **Email dedup is case-sensitive.** `A@x.com` and `a@x.com` pass the uniqueness check as two distinct rows. Accepted — see `## Story Goal`'s out-of-scope list. A future story that wants case-insensitive dedup needs a normalising `clean()`/`validate()`, the same shape as `Customer.email`'s blank-normalisation.
- **Editing a contact's `channel` from `phone` to `email` re-validates `value` as an email address**, because `contactSchema`'s `superRefine` reads the submitted `channel`, not the row's previous one. A `value` that was valid as a phone number and invalid as an email is rejected client-side before any request is sent. The backend's `ContactDetailSerializer.validate` enforces the same rule server-side (using the submitted or, on a partial PATCH, the existing `channel`) as the authoritative check — CONVENTIONS.md §12: a frontend check is UX only.
- **`customer` sent on a PATCH is silently ignored, not rejected.** `ContactDetailSerializer.update` pops it from `validated_data` before saving. The frontend's `ContactDetailUpdateInput` type does not even include the field, so this is defence in depth against a hand-built request, not a path the UI can trigger.
- **`ContactDetailsSection` mounts a fresh `useAppForm` per edit.** `ContactDetailRow` swaps between a static row and `ContactDetailEditForm` by conditional render (not by hiding/showing the same mounted form), so `defaultValues` are read fresh from the clicked row's current data every time edit mode opens — no "stale defaults from a previous edit" risk, the same reasoning `CustomerFormPage` documents for its `defaultValues`-read-once-at-mount constraint.
- **`page_size=100` is a real cap, not just a default.** A customer with more than 100 contacts (unlikely, but not impossible from bulk imports the plan does not otherwise anticipate) would silently see only the first 100, with no pagination control to reveal the rest. Acceptable for this story's scope; a future story adding pagination to this list would need to add `DataTable` or hand-rolled "load more," neither of which exists here.
- **Arabic rendering.** Every value is wrapped `dir="ltr"` (§18's bidi rule) regardless of channel — a phone number and a WhatsApp identifier are Latin/digit runs exactly like an email address, so all three get the same treatment rather than special-casing only `email`.
- **A role without `customers.manage` sees the list but not the add form or the row-level edit/remove controls.** `<Can permission="customers.manage">` gates both, matching the identical gate already on `CustomerProfilePage`'s Edit/Delete buttons; the API enforces the same permission independently.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass; `MigrationStateTests.test_no_pending_migrations` catches a `ContactDetail` shipped without its migration.
2. `ruff format --check .` / `ruff check .` over the new Python.
3. `npm run build` — typechecks `ContactDetail`/`ContactDetailInput`/`ContactDetailUpdateInput`, the `contactSchema` + `useAppForm<typeof contactSchema>` instantiation (twice — add and edit forms), and every new `t('customers:contacts.…')` key through `CustomTypeOptions`.
4. `npm run lint` (`react/jsx-no-literals` over `ContactDetailsSection.tsx`), `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison for the `customers` namespace (now including `contacts.*`) — `## Verification Steps` step 4.
6. Real HTTP across permission states plus a real browser walkthrough in both languages — `## Verification Steps` 5–11.

---

## Migration / Rollback

**One migration, additive.** `customers/000N_contactdetail` (task 1) creates one table with a FK to `customers_customer` and a three-column unique constraint. **No change to any existing table**, no data migration (no new permissions to grant).

**Rollback of the code:** revert the commits. **No `npm install`, no `pip install`** — `validate_email` and `UniqueConstraint` are Django core.

**Rollback of the schema:**

```powershell
python manage.py migrate customers <the migration before this one>
```

Reverse drops the `contact_details` (or Django-named equivalent) table. Clean because nothing yet references `ContactDetail` — no other model's FK points at it.

**Half-applied states to avoid:**

- **Task 1's model without task 2's serializer overrides** → every `ContactDetail` write bypasses the email-format check (any string accepted for an email-channel contact) and a duplicate raises the DB's raw `IntegrityError` (500) instead of a clean `validation_error`, because `UniqueTogetherValidator` only exists once the serializer is generated against the constrained model — but the constraint itself is already enforced at the DB level the moment the migration applies. Ship model and serializer together.
- **Task 3's viewset without the `get_queryset` guard** → `GET /api/contact-details/` with no `?customer=` returns **every contact for every customer**, an information-scope bug, not a crash. `## Edge Cases` and `## Verification Steps` step 5 both check this explicitly.
- **Task 7 before task 5/6** → `ContactDetailsSection.tsx`'s imports (`../api/useContactDetails`, `../types/contactDetail`, and every `t('customers:contacts.…')` key) fail to resolve; the build fails on the import or on `tsc -b`'s namespace check, not silently.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migration applies forward, no reset:** `python manage.py migrate`; `python manage.py showmigrations customers` shows the new migration applied. Confirm its actual generated filename and note it if it differs from `0003_contactdetail.py`.
3. **Backend regression:** `python manage.py test` reports **54** passing.
4. **`en`/`ar` key sets match** for the `customers` namespace (now including the new `contacts.*` keys). Reuse Story 10's Node one-liner (`README.md`/Story 10 Verification Step 4) against `frontend/src/features/customers/locales/{en,ar}.json`. Both arrays empty.
5. **The required-filter guard works.** With a valid bearer token: `GET /api/contact-details/` (no query string) returns `validation_error` with `fields: {"customer": [...]}`, **not** an empty list and **not** every contact in the database. `GET /api/contact-details/?customer=abc` also returns `validation_error`, **not** `internal_error` — this is the verified `ValueError` trap from `## Prerequisites`. `GET /api/contact-details/?customer=999999` (a nonexistent id) returns `200` with an empty `items` array.
6. **Every action enforces its own permission**, using the three story-09/10 accounts (`admin@`, `mgr@`, `agent@`, password `Sup3rSecret!`) — same table shape as Story 10's Verification Step 7, applied to `/api/contact-details/`:

   | Request | no token | a role **without** `customers.manage` | `agent@` |
   |---|---|---|---|
   | `GET /api/contact-details/?customer=<id>` | 401 | 200 (has `customers.view`) | 200 |
   | `POST /api/contact-details/` | 401 | 403 | 201 |
   | `PATCH /api/contact-details/<id>/` | 401 | 403 | 200 |
   | `DELETE /api/contact-details/<id>/` | 401 | 403 | 204 |

7. **An email-channel contact validates its format.** `POST` `{"customer": <id>, "channel": "email", "value": "not-an-email"}` → `validation_error` with `fields: {"value": [...]}`. `POST` the same with a valid email → `201`.
8. **A phone/whatsapp contact accepts any non-empty text.** `POST` `{"customer": <id>, "channel": "phone", "value": "+1 555 0100 ext 4"}` → `201`.
9. **A duplicate `(customer, channel, value)` is a field-less validation error.** `POST` the same `{customer, channel, value}` triple twice → the second returns `validation_error` with `fields: {"non_field_errors": [...]}`, **not** `internal_error` and **not** a 201.
10. **Reassigning `customer` on PATCH is a no-op.** `PATCH /api/contact-details/<id>/` with `{"customer": <a-different-customer-id>, "value": "new value"}` → `200`, and `GET` the row back to confirm `customer` is **unchanged** while `value` updated.
11. **The full UI walkthrough, both languages.** `npm run dev` with the backend up, signed in as `agent@`:
    - Open a customer's profile: the new "Contact channels" card renders below the identity card, empty state if none exist.
    - Add an email contact, a phone contact, and a WhatsApp contact via the inline add form — each appears in the list **without a page reload**, and the add form resets and is ready for the next entry.
    - Try to add an invalid email — the field shows an inline error, no request-level toast noise beyond the shared one.
    - Try to add a duplicate `(channel, value)` — the form-level error area shows the server's message.
    - Edit a contact's value inline; save; confirm the row updates without navigating away.
    - Remove a contact via the confirm dialog; confirm it disappears from the list.
    - Switch to Arabic: labels translate, every contact value renders LTR-wrapped inside the RTL layout, the channel badges read correctly.
    - Sign in as an account **without** `customers.manage`: the list still renders (has `customers.view`), but the add form and every row's Edit/Remove controls are absent.
12. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `ContactDetail` extends `TimeStampedModel`, FK `customer` (`on_delete=CASCADE`, `related_name="contacts"`), `channel` (`TextChoices`: `email`/`phone`/`whatsapp`), `value` (`max_length=254`), `Meta.ordering`, and a `UniqueConstraint` on `(customer, channel, value)`.
- [ ] **No change to `Customer.email`/`Customer.phone`** — the open forward decision from Story 10 is resolved as "beside," not "supersedes."
- [ ] **No new permission constants, no new grant migration** — `ContactDetailViewSet.permission_map` reuses `Permissions.CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE` verbatim.
- [ ] Migration committed; `manage.py test` reports no pending migrations.
- [ ] `ContactDetailSerializer` declares no fields beyond `Meta`; `validate()` enforces email format only for the `email` channel; `update()` ignores an incoming `customer`.
- [ ] `ContactDetailViewSet.get_queryset()` requires `?customer=` on `list`, rejects a missing or non-numeric value as `validation_error` (never `internal_error`), and applies no filter for `retrieve`/`update`/`partial_update`/`destroy`.
- [ ] `router.register("contact-details", ContactDetailViewSet, basename="contact-detail")` added to the existing `customers/urls.py` router — no change to `config/api_urls.py`.
- [ ] `ContactDetailAdmin` registered, plus a `ContactDetailInline` on `CustomerAdmin`.
- [ ] `features/customers/types/contactDetail.ts`, five new `api/` files, `useContactDetails`, `useContactDetailMutations` (**scoped** invalidation, not `customerKeys.all`), and `contacts.*` keys in both locale files.
- [ ] `ContactDetailsSection` renders inline on `CustomerProfilePage` (no new route), gates add/edit/remove behind `<Can permission="customers.manage">`, and every contact value renders inside `dir="ltr"`.
- [ ] The add form resets after a successful submit; the edit form exits edit mode on success; remove goes through `useConfirm()`.
- [ ] Channel-conditional email validation reuses `email()`'s own issue via `superRefine`/`ctx.addIssue`, not a literal error string — verified against the installed zod version.
- [ ] `CONVENTIONS.md` § 23 gains the two child-resource paragraphs (no new numbered section); `README.md`'s Mutations & invalidation paragraph gains the scoped-invalidation exception sentence.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] Verified by real HTTP: all four verbs × three permission states (Verification Step 6); the required-filter guard (Step 5); email format, duplicate rejection, and PATCH-ignores-customer (Steps 7, 9, 10).
- [ ] Both languages walk through cleanly (Step 11).
- [ ] `.squad/plans/customer-management/00-overview.md` updated with this story's row.

**STOP HERE. Report to the user and wait for confirmation.** The next story numerically ready is **CUST-4 (Notes & Attachments)** — it depends only on `CUST-1`, unlike `CUST-3` (Interaction History), which additionally needs `TKT-1` and `COMM-*` and is not yet unblocked.
