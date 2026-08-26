# Story 10 — Customer Profiles (Story: SUPPORTOS-28)

## Prerequisites

- **Story 09 completed:** [../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md](../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md). Verified landed and committed (`9a8cc4f`): `apps/core/permissions.py` (`Permissions`, `ALL_PERMISSIONS`, `permissions_for`, `HasPermission`), `accounts.Role` + `User.role`, `BaseModelViewSet` armed with `[IsAuthenticated, HasPermission]`, `/auth/me/` returning `role` + `permissions`, and `can()` / `<Can>` / `RequirePermission` on the frontend.
- **Stories 05–08 completed** — `I18N`, `UI`, `FORM`, and JWT auth. This story is the **first real consumer of all four foundations at once**, which is what the previous four stories' "known gap" notes were waiting for:

  | Foundation | Shipped in | Consumer count before this story |
  |---|---|---|
  | `BaseModelViewSet` + `permission_map` | 02 / 09 | **zero** |
  | `DataTable` + `useServerTable` | 06 | **zero** |
  | `useAppForm` + field components | 07 | one (`LoginPage`) |
  | `can()` / `<Can>` / `RequirePermission` | 09 | **zero** |

  Verified by grep: nothing subclasses `BaseModelViewSet`, nothing imports `DataTable`, and `<Can>`/`RequirePermission` have no call sites.
- Verified backend baseline: `apps/customers/` is untouched `startapp` scaffolding — `models.py` and `views.py` both contain only `# Create your ... here.`, and `migrations/` holds only `__init__.py`. `apps.customers` is already in `LOCAL_APPS` (`config/settings/base.py:50`) and `CustomersConfig.name` is already the correct dotted `apps.customers`.
- Verified: `config/api_urls.py` currently registers **no DRF router** — this story adds the first one.
- Verified: `Permissions` holds only `USERS_VIEW`, `USERS_MANAGE`, `ROLES_MANAGE`. This story adds the first *domain* permissions.
- Verified: `REST_FRAMEWORK["DEFAULT_FILTER_BACKENDS"]` contains **only** `OrderingFilter`. `django-filter` is **not** installed and this story does not install it — `rest_framework.filters.SearchFilter` is DRF core (verified importable, `search_param = "search"`).
- Verified: `LoginPage` is the only `useMutation` in the codebase and it performs **no cache invalidation**. This story establishes that convention.
- **The scope boundary that shapes the data model — read before task 1.** `SupportOs backlog.MD` **lines 280–287** give `ContactDetail` (multi-channel: email/phone/WhatsApp) to **CUST-2**; **lines 288–295** give the interaction timeline to **CUST-3**; **lines 296–303** give `Note` and `Attachment` to **CUST-4**. See `## Story Goal` for what that forces this story's `Customer` to contain — and, just as importantly, not contain.

---

## Story Goal

Give the project its first real domain record, and in doing so prove the four foundations compose.

1. A `Customer` model, its DRF CRUD endpoints through `BaseModelViewSet`, with `customers.view` / `customers.manage` enforced by the existing `HasPermission`.
2. Server-driven list, sort, and search over that endpoint.
3. A customer list screen built on `DataTable`, a profile screen, and a create/edit form built on `useAppForm` — all fully bilingual.
4. Route and control gating through `RequirePermission` and `<Can>`.
5. The **mutation-and-invalidation convention** every later feature copies.

### What `Customer` holds, and what it deliberately does not

Three sibling stories own most of what a "customer record" eventually contains, so this story's model is the identity core and nothing more:

| Field | Why it is here |
|---|---|
| `name` | The only required field. A record with no name is unusable in a list. |
| `email` | Unique-when-present. This is the dedup key that makes the intake's *"each customer has one record"* true, and the field COMM-* will match inbound messages against. |
| `phone` | Plain text, deliberately unvalidated beyond length — see the note below. |
| `company` | The single most common CRM grouping field, and the second most useful list column. |

**Not here, and why:**

- **No `notes` text field** — `Note` is a CUST-4 model. A `notes` column now would be dead weight the moment CUST-4 lands, and migrating text out of it into rows is worse than never adding it.
- **No `ContactDetail`, no channel typing, no secondary contacts** — CUST-2. `email`/`phone` above are the *primary* contact fields. **CUST-2 must decide** whether `ContactDetail` supersedes them or hangs beside them as additional channels; this story does not pre-empt that, and `## Edge Cases` records it as an open forward decision rather than a settled one.
- **No `is_active` / archive flag, no soft delete.** `destroy` is a real delete. When TKT-1 adds `Ticket.customer`, that FK's `on_delete` is what protects a customer with history — `PROTECT` there is worth more than a speculative flag here.
- **No phone-format validation.** International numbers, extensions, and WhatsApp identifiers make anything stricter than "a string with a length cap" actively wrong at this stage. CUST-2 owns channel-typed contacts and is where per-channel validation belongs.

### Two verified traps in the optional-field handling

These are the plan's central technical findings, both reproduced against this project's real stack rather than reasoned about.

**1. A unique nullable column collides on blank strings, not on NULLs.** Run against the project's own Postgres 17 database:

```
CREATE TEMP TABLE t (email varchar(254) UNIQUE);
INSERT INTO t VALUES (NULL), (NULL), (NULL);   -- 3 rows, no error
INSERT INTO t2 VALUES (''); INSERT INTO t2 VALUES ('');
  -> ERROR: duplicate key value violates unique constraint "t2_email_key"
     DETAIL: Key (email)=() already exists.
```

So `email` must be `null=True, blank=True` **and** blank input must be normalised to `None` before it reaches the database. Without that normalisation, **the second customer saved without an email is an IntegrityError** — a 500, not a validation message. Task 1's `validate_email` and task 2's serializer are both about this one failure.

**2. An absent optional field cannot clear a value.** Verified with DRF's own serializer against this project's version:

| Request | `validated_data` |
|---|---|
| PUT, `email` absent | `{'name': 'A'}` — **`email` missing entirely** |
| PUT, `email: null` | `{'name': 'A', 'email': None}` |
| PUT, `email: ''` | `{'name': 'A', 'email': ''}` — blank, **not** `None` |
| PATCH, `email` absent | `{'name': 'A'}` |

An absent key leaves the instance's existing value untouched. Meanwhile story 07's `optionalEmail()` transforms `''` → `undefined`, and `JSON.stringify` **drops undefined keys** — so a user who clears the email field on an edit form would silently fail to clear it. Task 5 adds `nullableString()` / `nullableEmail()` to the shared `schemas.ts` (transforming `''` → `null`, not `undefined`) precisely because every future feature with an optional database column hits this. The existing `optionalString`/`optionalEmail` stay untouched — they are correct for a field that is genuinely absent rather than nullable.

### Explicitly out of scope

- **`ContactDetail` and multi-channel contacts → CUST-2.**
- **The interaction timeline → CUST-3.** No activity feed on the profile.
- **`Note` / `Attachment` and file upload → CUST-4.** The API layer sends `application/json` only (`shared/lib/api/client.ts:16`); multipart is a parser change on both sides.
- **Tickets on the profile → TKT-\*.**
- **Customer merge / dedup tooling.** The unique `email` prevents the common duplicate; a merge UI is its own story.
- **Bulk actions, CSV import/export → reports/admin epics.**
- **Column-level filtering** (`django-filter`). Search + ordering is what `DataTable` supports today; a filter UI is a `UI` extension, not a customer story.
- **Soft delete / archive**, per the reasoning above.
- **A dedicated 403 screen.** `RequirePermission` redirects to `/`, as story 09 established.
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/customer-management/SUPPORTOS-28/intake.md` — three task blocks, **no attachments, no acceptance criteria**. Done Criteria derive from the three **Outcome** lines and the **Constraints** lines (*"reuse `AUTHZ`, `API`"*, *"reuse `UI` table/states, `I18N`"*, *"reuse `FORM`, shared fields"*).
2. `SupportOs backlog.MD` **lines 264–303** — all of EPIC 3. Read CUST-2/3/4 before adding any field to `Customer`.
3. `backend/apps/core/views.py` — `BaseModelViewSet` (lines 10–33 after story 09). Read its docstring: `permission_classes = [IsAuthenticated, HasPermission]`, `permission_map: dict[str, str] = {}`, and the rule that an **unmapped action is authenticated-only, not forbidden** — which is why task 2 must map every action it wants gated.
4. `backend/apps/core/permissions.py` — `Permissions` (the three existing constants), `ALL_PERMISSIONS` (derived by reflection over `vars(Permissions)`, so a new constant is picked up automatically), and `HasPermission._required_permission` (action key first, then lowercased HTTP method).
5. `backend/apps/core/models.py` — `TimeStampedModel` (all 15 lines): `created_at` (`auto_now_add`, `db_index=True`), `updated_at` (`auto_now`), `abstract = True`, `get_latest_by = "created_at"`.
6. `backend/apps/core/serializers.py` — `BaseModelSerializer` (all 20 lines). Its docstring carries the exact `class Meta(BaseModelSerializer.Meta)` inheritance requirement task 2 must follow, or `read_only_fields` silently does not apply.
7. `backend/apps/core/pagination.py` — `DefaultPageNumberPagination` (all 38 lines). `page_size_query_param = "page_size"`, `max_page_size` from `DRF_MAX_PAGE_SIZE`, and `get_paginated_response` putting the block under `meta.pagination` with keys `count`/`page`/`page_size`/`num_pages`/`next`/`previous` — the exact shape `DataTablePagination` reads.
8. `backend/apps/accounts/migrations/0003_seed_roles.py` — the data-migration pattern task 3 copies, including the `update_or_create` re-runnability and the `from apps.core.permissions import Permissions` import that is safe because `core/permissions.py` imports no models.
9. `backend/config/settings/base.py` — `LOCAL_APPS` (line 50, `apps.customers` already present), `DEFAULT_FILTER_BACKENDS` (lines 226–228, `OrderingFilter` only — task 2 adds `SearchFilter` beside it), and the `DEFAULT_PERMISSION_CLASSES` block (still `AllowAny`; task 2 does **not** touch it).
10. `backend/config/api_urls.py` — all 11 lines. Task 2 adds a router **above** the catch-all `re_path`, which must stay last.
11. `frontend/src/shared/ui/data-table/types.ts` — `ColumnDef<T>`: `id` (which **doubles as the `?ordering=` field name**, so it must match the serializer field exactly), `header` (already translated), `cell`, `sortable?`, `align?`.
12. `frontend/src/shared/ui/data-table/useServerTable.ts` — returns `{ page, sort, params, setPage, setSort }`; `params` is `{page, page_size?, ordering?}`. Note `setSort` resets `page` to 1 — do not re-implement that.
13. `frontend/src/shared/ui/data-table/DataTable.tsx` — the full props contract (lines 24–34) and the docstring explaining why it does **not** wrap `QueryBoundary` (a `<div>` is invalid inside `<tbody>`). It renders its own loading/empty/error rows, so the list screen must **not** wrap it in `QueryBoundary`.
14. `frontend/src/shared/ui/data-table/DataTablePagination.tsx` — reads `pagination.previous`/`next` for disabled state, and uses `t('table.*')` keys that already exist in both `common.json` files. No new table copy is needed.
15. `frontend/src/features/health/api/` — all three files. The reference feature shape: `get<Thing>.ts` (a thin `api.*` call), `<thing>Keys.ts` (`featureKey('feature')`), `use<Thing>.ts` (the `useQuery` wrapper). Task 6 follows it exactly.
16. `frontend/src/features/auth/components/LoginPage.tsx` — the only existing form. Task 8 follows its `useAppForm` + `Form` + `TextField` + `applyServerErrors` shape; the difference is that a customer mutation must also **invalidate**, which login does not.
17. `frontend/src/shared/validation/schemas.ts` — `requiredString`, `optionalString`, `email`, `optionalEmail`, `positiveInt`, `choice`, `requiredBoolean`. Read `optionalString`/`optionalEmail` and note both transform to `undefined`; task 5 adds the `null`-transforming pair beside them and does not change these.
18. `frontend/src/app/router.tsx` — all 41 lines, the three-child tree story 08 built. Task 9 nests the customer routes under the existing `RequireAuth` element.
19. `frontend/src/app/RootLayout.tsx` — all 39 lines. The header has **no nav yet**; task 9 adds the first, gated by `<Can>`.
20. `CONVENTIONS.md` — § 0 (check for an existing implementation first), § 4, § 11, § 12 (snake_case end to end), § 16, § 18, § 19, § 20, § 21, and **all of § 22** (the `permission_map` convention and the grant-on-omission rule).
21. `README.md` § Consuming the API from the frontend (lines 395–427). **Query keys** are documented (line 425); **invalidation after a mutation is not.** Task 10 adds it.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **CRUD via base viewset / envelope / permissions.** | Intake, task 1 | `CustomerViewSet(BaseModelViewSet)` with a full `permission_map`. No `permission_classes` override, no hand-built envelope. |
| **Reuse `AUTHZ`; no ad-hoc checks.** | Intake, task 1 constraints | `customers.view` / `customers.manage` in `Permissions`, granted to roles by data migration. The viewset never reads `request.user.role`. |
| **Reuse `API`.** | Intake, task 1 constraints | Plain payloads returned; `EnvelopeJSONRenderer` and `DefaultPageNumberPagination` do the shaping. `api.getPage`/`api.get`/`api.post`/`api.patch`/`api.delete` on the client. |
| **List via the shared table pattern.** | Intake, task 2 | `DataTable` + `useServerTable`. `ColumnDef.id` matches the serializer field so `?ordering=` works. |
| **Reuse `UI` states.** | Intake, task 2 constraints | `DataTable`'s built-in rows for loading/empty/error; `QueryBoundary` for the profile (which is not a table). |
| **Reuse `I18N`; no hardcoded strings.** | Intake, task 2 constraints + § 18 | A `customers` namespace registered in `resources.ts`, `en` and `ar` in step. `react/jsx-no-literals` plus Verification Step 12's grep. |
| **Form via `FORM` (RHF + Zod), i18n messages.** | Intake, task 3 | `useAppForm` + `TextField`; messages from the story-07 error map, never a literal in a schema. |
| **Reuse shared fields.** | Intake, task 3 constraints | `TextField` only — this story adds no new field component. The two new *schema* helpers go in the shared `schemas.ts`, not in the feature. |
| **Wire format is `snake_case` end to end.** | § 12 | `Customer` TS type mirrors the serializer verbatim; `applyServerErrors` needs no name mapping. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | **This story adds no environment variable and no new dependency** — `SearchFilter` is DRF core. |

---

## Backend Tasks

### 1 — The `Customer` model

**File: `backend/apps/customers/models.py`** — replace the placeholder.

```python
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class Customer(TimeStampedModel):
    """A customer record — the identity core everything else attaches to.

    Deliberately minimal. `ContactDetail` (multi-channel contacts) is CUST-2,
    the interaction timeline is CUST-3, and `Note`/`Attachment` are CUST-4;
    none of them are pre-empted here. See Story 10 `## Story Goal`.
    """

    name = models.CharField(_("name"), max_length=200)
    # Unique WHEN PRESENT: this is the dedup key behind "each customer has one
    # record", and what COMM-* will match inbound messages against.
    #
    # `null=True` is load-bearing, not stylistic. Postgres allows any number of
    # NULLs in a unique column but rejects a second blank string — verified
    # against this project's database. Blank input is normalised to NULL in
    # `clean()` and again in the serializer, because a `""` reaching this
    # column is an IntegrityError (a 500), not a validation message.
    email = models.EmailField(_("email address"), max_length=254, unique=True, null=True, blank=True)
    # Plain text on purpose: international formats, extensions, and WhatsApp
    # identifiers make anything stricter actively wrong. Per-channel validation
    # belongs to CUST-2.
    phone = models.CharField(_("phone"), max_length=40, blank=True)
    company = models.CharField(_("company"), max_length=200, blank=True)

    class Meta:
        verbose_name = _("customer")
        verbose_name_plural = _("customers")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        """Normalise blank email to NULL.

        Guards the admin and any `full_clean()` caller. The serializer repeats
        this for the API path, because DRF does not call model `clean()` — the
        same split CONVENTIONS.md §22 records for `Role.clean()`.
        """
        super().clean()
        if not self.email:
            self.email = None
```

`ordering = ("name",)` gives the list a stable default order, which pagination requires — an unordered queryset paginates non-deterministically and Django emits `UnorderedObjectListWarning`.

**`phone` and `company` are `blank=True` with no `null=True`.** They are not unique, so the blank-string collision does not apply, and Django's convention is to avoid nullable `CharField`s where `""` is a fine empty value. `email` is the one exception, forced by the unique constraint.

**File: `backend/apps/customers/admin.py`**

```python
from django.contrib import admin

from .models import Customer


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "company", "created_at")
    search_fields = ("name", "email", "company")
    readonly_fields = ("created_at", "updated_at")
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations customers
```

Expect one file, `apps/customers/migrations/0001_initial.py`. **Commit it** — `MigrationStateTests.test_no_pending_migrations` (`config/tests/test_settings.py:104`) fails the build otherwise.

---

### 2 — Permissions, serializer, viewset, routing

**File: `backend/apps/core/permissions.py`** — add two constants to `Permissions`. `ALL_PERMISSIONS` is derived by reflection over `vars(Permissions)`, so it picks them up with no further change:

```python
    CUSTOMERS_VIEW = "customers.view"
    CUSTOMERS_MANAGE = "customers.manage"
```

**Create file: `backend/apps/customers/serializers.py`**

```python
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Customer


class CustomerSerializer(BaseModelSerializer):
    # allow_blank AND allow_null: the client may send "", null, or omit the
    # key entirely, and all three must mean "no email". Without allow_blank a
    # cleared field is a validation error; without the normalisation below a
    # "" reaches a unique column and becomes an IntegrityError. See Story 10
    # `## Story Goal` for the verified failure.
    email = serializers.EmailField(
        max_length=254, required=False, allow_blank=True, allow_null=True
    )

    class Meta(BaseModelSerializer.Meta):
        model = Customer
        fields = ("id", "name", "email", "phone", "company", "created_at", "updated_at")

    def validate_email(self, value):
        """Blank -> None, so the unique constraint sees NULL.

        DRF does not call model `clean()`, so this cannot be left to the model.
        """
        return value or None
```

`class Meta(BaseModelSerializer.Meta)` — inheriting is required for `read_only_fields = ("id", "created_at", "updated_at")` to apply, exactly as that base's docstring says.

**The unique-email error is already a clean field error.** DRF's `ModelSerializer` derives a `UniqueValidator` from the model's `unique=True`, so a duplicate email returns `validation_error` with `fields: {"email": [...]}` — which `applyServerErrors` attaches to the right input with no extra work. Verified by construction; Verification Step 8 exercises it.

**Create file: `backend/apps/customers/views.py`** — replacing the placeholder.

```python
from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(BaseModelViewSet):
    """Customer CRUD. The first consumer of `BaseModelViewSet`.

    Every action is mapped: an unmapped action would fall through to
    authenticated-only, which for a write endpoint is not what we want. See
    CONVENTIONS.md §22.
    """

    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
    }

    # `ordering_fields` is what makes `?ordering=` real for these columns —
    # OrderingFilter ignores any field not listed. Each name here must match a
    # `ColumnDef.id` on the frontend.
    ordering_fields = ("name", "email", "company", "created_at")
    search_fields = ("name", "email", "company")
```

**All six actions are mapped deliberately.** § 22's grant-on-omission rule means a missing entry is authenticated-only; leaving `destroy` unmapped would let any signed-in user delete a customer. Verification Step 7 checks each action separately for exactly this reason.

**File: `backend/config/settings/base.py`** — add `SearchFilter` beside the existing `OrderingFilter`:

```python
    # OrderingFilter is what makes the frontend's `?ordering=field` contract
    # real; SearchFilter does the same for `?search=`. Both are inert until a
    # view declares `ordering_fields` / `search_fields`, so adding them
    # globally changes nothing for existing views. DRF core — no new package.
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
```

Verified: `rest_framework.filters.SearchFilter` imports cleanly on the installed DRF and its query parameter is `search`. **`DEFAULT_PERMISSION_CLASSES` stays `AllowAny`** — § 13 records why, and `BaseModelViewSet` is what closes this endpoint.

**Create file: `backend/apps/customers/urls.py`**

```python
from rest_framework.routers import DefaultRouter

from .views import CustomerViewSet

app_name = "customers"

router = DefaultRouter()
router.register("customers", CustomerViewSet, basename="customer")

urlpatterns = router.urls
```

**File: `backend/config/api_urls.py`** — one `include()`, above the catch-all:

```python
urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.customers.urls")),
    # Must stay last: turns an unmatched /api/ path into an enveloped 404
    # instead of Django's HTML 404 page.
    re_path(r"^", ApiNotFoundView.as_view()),
]
```

`path("", ...)` because the router already contributes the `customers/` segment. Endpoints: `GET/POST /api/customers/`, `GET/PUT/PATCH/DELETE /api/customers/<pk>/`.

**`DefaultRouter` also generates an API-root view at the include's prefix.** With `path("")` that root lands on `/api/`, where the catch-all `re_path` would otherwise have answered. It is harmless — it renders through `EnvelopeJSONRenderer` like everything else — but note it, because `GET /api/` changes from an enveloped 404 to a route listing. If that is unwanted, use `SimpleRouter` instead, which generates no root view. **Verification Step 6 checks what `GET /api/` actually returns** and the decision is recorded there rather than assumed.

---

### 3 — Grant the new permissions to the seeded roles

The permission strings exist in code and the roles exist as rows, so the grant is **data**. This is the first feature story to need one, and the pattern every later feature copies.

**Create file: `backend/apps/customers/migrations/0002_grant_customer_permissions.py`**

```python
from django.db import migrations

from apps.core.permissions import Permissions

# Who gets what. Agents work customers day to day, so they get full manage;
# managers see everything. Admin already holds every permission by role, and
# a superuser bypasses roles entirely (CONVENTIONS.md §22).
GRANTS = {
    "admin": [Permissions.CUSTOMERS_VIEW, Permissions.CUSTOMERS_MANAGE],
    "manager": [Permissions.CUSTOMERS_VIEW, Permissions.CUSTOMERS_MANAGE],
    "agent": [Permissions.CUSTOMERS_VIEW, Permissions.CUSTOMERS_MANAGE],
}


def grant(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            # A deployment that renamed or removed a seeded role is not an
            # error here — SEC-1 owns role administration.
            continue
        role.permissions = sorted(set(role.permissions) | set(permissions))
        role.save(update_fields=["permissions"])


def revoke(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) - set(permissions))
        role.save(update_fields=["permissions"])


class Migration(migrations.Migration):
    # Cross-app: the rows live in `accounts`, the grant belongs to the feature.
    # Naming `accounts.0003_seed_roles` guarantees the roles exist first.
    dependencies = [
        ("customers", "0001_initial"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

**A set union, not an assignment.** Replacing `role.permissions` wholesale would wipe grants made by other feature stories or by an admin — this migration must be additive and re-runnable, the same property `0003_seed_roles` has via `update_or_create`.

**Why this lives in `customers`, not `accounts`.** The grant is part of shipping the customer feature; keeping it here means the feature's migration history tells the whole story, and `accounts` does not accumulate a migration per downstream feature. The cross-app `dependencies` entry is what makes it safe. `CONVENTIONS.md` § 22 gains this as a stated rule in task 10.

**All three roles get manage.** With no `ContactDetail` or ticket history yet there is no meaningful read-only customer workflow, and a role that can view but not create cannot do the intake's *"create and view customer profiles"*. When SEC-2's permission UI lands, narrowing `agent` is a data change requiring no code.

---

## Frontend Tasks

### 4 — Types, API layer, and query keys

**Create file: `frontend/src/features/customers/types/customer.ts`**

```ts
/** Mirrors `apps.customers.serializers.CustomerSerializer` verbatim —
 * snake_case, per CONVENTIONS.md §12. */
export type Customer = {
  id: number
  name: string
  email: string | null
  phone: string
  company: string
  created_at: string
  updated_at: string
}

/** The write shape. `id` and the timestamps are read-only server-side. */
export type CustomerInput = {
  name: string
  email: string | null
  phone: string
  company: string
}
```

`email: string | null` — the model is nullable, so the type must be too. `phone`/`company` are `string` because they are `blank=True` without `null=True` and always serialise as `""` at worst.

**Create file: `frontend/src/features/customers/api/customerKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const customerKeys = featureKey('customers')
```

**Create file: `frontend/src/features/customers/api/getCustomers.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

export type CustomerListParams = ServerTableParams & { search?: string }

// Trailing slash required: Django's APPEND_SLASH would otherwise 301 the call.
export function getCustomers(params: CustomerListParams): Promise<Page<Customer>> {
  return api.getPage<Customer>('/customers/', { params })
}
```

Add `import type { Customer } from '../types/customer'`.

**Create file: `frontend/src/features/customers/api/getCustomer.ts`**

```ts
export function getCustomer(id: number): Promise<Customer> {
  return api.get<Customer>(`/customers/${id}/`)
}
```

**Create files: `createCustomer.ts`, `updateCustomer.ts`, `deleteCustomer.ts`**

```ts
export function createCustomer(input: CustomerInput): Promise<Customer> {
  return api.post<Customer>('/customers/', input)
}

// PATCH, not PUT. Verified: DRF drops an absent optional field from
// `validated_data`, so a full-update PUT cannot clear a value by omission —
// and PATCH's "only what I sent" semantics are what an edit form actually
// means. Clearing is done by sending `null` explicitly (see task 5).
export function updateCustomer(id: number, input: CustomerInput): Promise<Customer> {
  return api.patch<Customer>(`/customers/${id}/`, input)
}

export function deleteCustomer(id: number): Promise<void> {
  return api.delete(`/customers/${id}/`)
}
```

**Create file: `frontend/src/features/customers/api/useCustomers.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getCustomers } from './getCustomers'
import type { CustomerListParams } from './getCustomers'
import { customerKeys } from './customerKeys'

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    // `params` is in the key: a different page/sort/search is a different
    // cache entry, and `useServerTable` memoises the object so this is stable.
    queryKey: customerKeys.resource('list', params),
    queryFn: () => getCustomers(params),
  })
}
```

**Create file: `frontend/src/features/customers/api/useCustomer.ts`**

```ts
export function useCustomer(id: number) {
  return useQuery({
    queryKey: customerKeys.resource('detail', id),
    queryFn: () => getCustomer(id),
  })
}
```

**Create file: `frontend/src/features/customers/api/useCustomerMutations.ts`** — the convention this story establishes:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createCustomer } from './createCustomer'
import { deleteCustomer } from './deleteCustomer'
import { updateCustomer } from './updateCustomer'
import { customerKeys } from './customerKeys'
import type { CustomerInput } from '../types/customer'

/**
 * Every customer write invalidates the whole `customers` key prefix.
 *
 * Prefix-wide, not surgical: a create changes which rows land on which page,
 * an edit can change the sort position, and a delete shifts every subsequent
 * page. Invalidating one page's key would leave the others stale. This is
 * what `featureKey`'s `all` exists for — see README § Consuming the API.
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) => createCustomer(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useUpdateCustomer(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) => updateCustomer(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}
```

---

### 5 — Two shared schema helpers

**File: `frontend/src/shared/validation/schemas.ts`** — add beside the existing helpers. These belong in `shared/`, not in the feature: every future feature with a nullable database column needs exactly this.

```ts
/**
 * Optional text for a NULLABLE database column. Transforms '' to `null`, not
 * `undefined` — an undefined key is dropped by `JSON.stringify`, and DRF
 * treats an absent field as "leave unchanged", so a cleared input would
 * silently fail to clear. Verified; see CONVENTIONS.md §20.
 *
 * Use `optionalString` instead when the field is genuinely absent rather than
 * null (a query parameter, a partial payload you build by hand).
 */
export function nullableString(max = 255) {
  return z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
}

/** Nullable email. Same '' -> null rule as `nullableString`. */
export function nullableEmail() {
  return z
    .union([z.literal(''), z.email().max(254)])
    .transform((value) => (value === '' ? null : value))
}
```

**Neither is `.optional()`.** The form always holds the key and always sends it; the value is `null` when cleared. That is what makes clearing work, and it is the whole difference from `optionalString`/`optionalEmail`, which stay exactly as story 07 wrote them.

---

### 6 — Locale namespace

**Create file: `frontend/src/features/customers/locales/en.json`**

```json
{
  "title": "Customers",
  "new": "New customer",
  "edit": "Edit customer",
  "search": "Search customers",
  "searchPlaceholder": "Name, email, or company",
  "empty": "No customers yet",
  "emptyDescription": "Create the first customer to get started.",
  "noSearchResults": "No customers match that search.",
  "fields": {
    "name": "Name",
    "email": "Email",
    "phone": "Phone",
    "company": "Company",
    "createdAt": "Created"
  },
  "actions": {
    "save": "Save",
    "delete": "Delete",
    "backToList": "Back to customers"
  },
  "delete": {
    "title": "Delete this customer?",
    "description": "This permanently removes the customer record. This cannot be undone."
  },
  "created": "Customer created.",
  "updated": "Customer updated.",
  "deleted": "Customer deleted.",
  "notFound": "That customer could not be found."
}
```

**Create `frontend/src/features/customers/locales/ar.json`** with the identical key set, translated.

**File: `frontend/src/shared/i18n/resources.ts`** — register the namespace, following the existing `auth`/`health` pattern: two imports plus one entry per language. `AppResources` derives from the `en` map, so every `t('customers:…')` key becomes compile-checked.

---

### 7 — The list screen

**Create file: `frontend/src/features/customers/components/CustomerListPage.tsx`**

Composition, in order:

- `useServerTable({ initialSort: { field: 'name', direction: 'asc' } })` for page/sort state.
- A debounced search input (`Input` from `shared/ui/primitives/input`), local `useState` for the raw value plus a 300 ms debounce before it enters the query params. **Changing the search must reset the page to 1** — `useServerTable` does that for sort but not for search, so the component calls `setPage(1)` when the debounced value changes.
- `useCustomers({ ...params, ...(search ? { search } : {}) })`.
- `<DataTable>` with these columns — every `id` matches a `ordering_fields` entry from task 2:

  | `id` | header | sortable | notes |
  |---|---|---|---|
  | `name` | `t('customers:fields.name')` | yes | `cell` renders a `<Link to={\`/customers/${row.id}\`}>` |
  | `email` | `t('customers:fields.email')` | yes | `row.email ?? '—'` |
  | `phone` | `t('customers:fields.phone')` | **no** | not in `ordering_fields` |
  | `company` | `t('customers:fields.company')` | yes | |
  | `created_at` | `t('customers:fields.createdAt')` | yes | `useFormatters().date(row.created_at)` |

- `caption={t('customers:title')}` — `DataTable` requires it for screen readers.
- `empty` prop: when a search is active pass `<Empty title={t('customers:noSearchResults')} />`; otherwise `<Empty title={t('customers:empty')} description={t('customers:emptyDescription')} />`. The two are different situations and one message for both is wrong.
- A `<Can permission="customers.manage">` wrapping the "New customer" button.

**Do not wrap `DataTable` in `QueryBoundary`.** Its docstring explains why — `QueryBoundary`'s branches return a `<div>`, which the browser hoists out of `<tbody>`. `DataTable` renders loading/empty/error as table rows itself.

**`created_at` goes through `useFormatters().date`**, never `toLocaleString` — § 18.

---

### 8 — The profile screen and the form

**Create file: `frontend/src/features/customers/components/CustomerProfilePage.tsx`**

- `useParams()` → `Number(id)`; guard `Number.isNaN` and render `<Empty title={t('customers:notFound')} />` rather than firing a request for `/customers/NaN/`.
- `useCustomer(id)` inside `<QueryBoundary>` — this is not a table, so `QueryBoundary` is correct here.
- A `Card` showing name, email, phone, company, and the formatted `created_at`.
- `<Can permission="customers.manage">` around an **Edit** link and a **Delete** button. Delete goes through `useConfirm()` (story 06) with `t('customers:delete.title')` / `t('customers:delete.description')` and `destructive: true`, then `useDeleteCustomer()`, then `navigate('/customers')`.
- A back link to `/customers`.

**Create file: `frontend/src/features/customers/components/CustomerFormPage.tsx`** — one component for both create and edit, following § 20's worked example.

```tsx
const schema = z.object({
  name: requiredString(200),
  email: nullableEmail(),
  phone: nullableString(40),
  company: nullableString(200),
})
```

- `phone`/`company` use `nullableString` even though the columns are `blank=True` not `null=True`: DRF's `CharField` rejects `null` unless `allow_null=True`, so **task 2's serializer must accept it or these must be `optionalString`**. Resolve it the simple way — declare `phone` and `company` in the serializer with `required=False, allow_blank=True` (the `ModelSerializer` default for `blank=True`) and use **`optionalString`** for them in the schema, reserving `nullableString`/`nullableEmail` for genuinely nullable columns. **Only `email` is nullable here.** Read `## Edge Cases` before changing this.
- Mode from the route: `/customers/new` → create, `/customers/:id/edit` → edit. In edit mode, load with `useCustomer(id)` and pass `defaultValues` from it; render `<Loading />` until it resolves, because `useAppForm`'s `defaultValues` are read once at mount.
- Submit → `useCreateCustomer()` / `useUpdateCustomer(id)`; `onError` → `isValidationError(error)` → `applyServerErrors(form, error)`; `onSuccess` → toast `t('customers:created')` / `t('customers:updated')` then `navigate` to the profile.
- Four `<TextField>`s. `email` gets `type="email"`.

**A duplicate email arrives as a field error, not a toast.** The serializer's model-derived `UniqueValidator` returns `validation_error` with `fields: {"email": [...]}`, which `applyServerErrors` attaches to the email input. Verification Step 8 checks this end to end.

---

### 9 — Routes and navigation

**File: `frontend/src/app/router.tsx`** — nest four routes inside the existing `RequireAuth` element, gated as a group:

```tsx
      {
        element: <RequireAuth />,
        children: [
          { index: true, lazy: /* HealthPage, unchanged */ },
          {
            element: <RequirePermission permission="customers.view" />,
            children: [
              { path: 'customers', lazy: /* CustomerListPage */ },
              { path: 'customers/new', lazy: /* CustomerFormPage */ },
              { path: 'customers/:id', lazy: /* CustomerProfilePage */ },
              { path: 'customers/:id/edit', lazy: /* CustomerFormPage */ },
            ],
          },
        ],
      },
```

`RequirePermission` nested **inside** `RequireAuth`, per story 09's documented arrangement. The gate is `customers.view`; `customers.manage` is enforced per-control by `<Can>` and, authoritatively, by the API.

**`customers/new` must be declared before `customers/:id`** — otherwise `:id` matches the literal `new` and the profile page requests `/customers/new/`.

**File: `frontend/src/app/RootLayout.tsx`** — add the first nav, beside the app name:

```tsx
          <nav className="flex items-center gap-1">
            <Can permission="customers.view">
              <Button asChild variant="ghost" size="sm">
                <Link to="/customers">{t('customers:title')}</Link>
              </Button>
            </Can>
          </nav>
```

`useTranslation(['common', 'customers'])` so both namespaces resolve. `Button asChild` wrapping a `Link` keeps the styling without nesting an anchor in a button.

---

## Documentation Tasks

### 10 — Conventions and README

**File: `CONVENTIONS.md`** — append `## 23. Feature module conventions`, leaving §0–§22 unrenumbered. It covers what this story establishes as the template every later feature copies:

1. **The backend shape of a feature**: `models.py` (extends `TimeStampedModel`), `serializers.py` (extends `BaseModelSerializer` with `class Meta(BaseModelSerializer.Meta)`), `views.py` (extends `BaseModelViewSet` with a **fully populated** `permission_map`), `urls.py` (a `DefaultRouter`), and one `include()` line in `config/api_urls.py`.
2. **A feature story grants its own permissions**, via a cross-app data migration in the *feature* app depending on `("accounts", "0003_seed_roles")` — with the set-union rule so it never wipes another story's grants. Add the permission constants to `apps/core/permissions.py` in the same change.
3. **`ordering_fields` and `search_fields` are the contract with `DataTable`** — a `ColumnDef.id` marked `sortable` must appear in `ordering_fields`, or the column silently does nothing.
4. **The frontend shape of a feature**: `types/`, `api/` (one file per call, plus `<feature>Keys.ts`, plus `use*` hooks), `components/`, `locales/{en,ar}.json` registered in `resources.ts`.
5. **Every mutation invalidates its feature's key prefix** (`featureKey(...).all`), not an individual page key — with the reason (a write reshuffles pagination and sort position).
6. **PATCH for edits, not PUT** — with the verified reason: DRF drops an absent optional field from `validated_data`, so PUT cannot clear a value by omission.
7. **`nullableString`/`nullableEmail` vs `optionalString`/`optionalEmail`** — which to reach for, and the `JSON.stringify`-drops-undefined reason the pair exists.
8. **A unique nullable column needs blank→NULL normalisation in both the model's `clean()` and the serializer** — with the verified Postgres behaviour (many NULLs fine, a second `""` is an IntegrityError) and the reminder that DRF does not call model `clean()`.

**File: `README.md`** — extend § Consuming the API from the frontend (after the **Query keys** paragraph at line 425) with a short **Mutations & invalidation** paragraph stating the prefix-invalidation rule and the PATCH-for-edit rule. Add nothing to § Environment variables — this story adds no variable.

**File: `frontend/src/README.md`** — the § Where new code goes list already covers this layout; add one line to § Forms & validation naming the `nullableString`/`nullableEmail` pair and when to prefer them.

---

## Edge Cases & Failure Modes

- **A second customer with no email is an IntegrityError, not a validation error, unless blank is normalised.** Verified against this project's Postgres: a unique column takes any number of NULLs but rejects a second `''`. Both `Customer.clean()` and `CustomerSerializer.validate_email` normalise, because DRF does not call model `clean()` and the admin does not go through the serializer. Removing either one leaves a 500 on a path the other does not cover.
- **An absent optional field cannot clear a value.** Verified: DRF omits it from `validated_data` entirely, so the instance keeps its old value. This is why edits use **PATCH** and why the form sends `email: null` rather than dropping the key. Switching `updateCustomer` to `api.put` silently reintroduces the bug — the request succeeds and the field is simply unchanged.
- **`nullableString` on a non-nullable column is a validation error.** `phone` and `company` are `blank=True` without `null=True`, so DRF's `CharField` rejects `null` unless told otherwise. The plan uses `optionalString` for those two and `nullableEmail` only for `email`. If a later story makes `phone` nullable, the schema helper and the serializer must change together.
- **`ColumnDef.id` is the `?ordering=` field name.** A `sortable: true` column whose `id` is not in `ordering_fields` produces a header that toggles `aria-sort` and changes nothing else — a silent no-op, because `OrderingFilter` drops unlisted fields. `phone` is deliberately non-sortable for this reason.
- **An unordered queryset paginates non-deterministically.** `Customer.Meta.ordering = ("name",)` is what prevents rows appearing on two pages or none; Django warns with `UnorderedObjectListWarning` if it is removed.
- **`DataTable` must not be wrapped in `QueryBoundary`.** `QueryBoundary`'s non-success branches return a `<div>`; a `<div>` inside `<tbody>` is invalid HTML and the browser hoists it out of the table, so the states render in the wrong place. `DataTable` renders them as `<TableRow><TableCell colSpan>` itself. Its own docstring says so.
- **Search must reset the page.** `useServerTable.setSort` resets to page 1 but nothing resets on a search change — page 3 of an unfiltered list is meaningless once a filter narrows the set to four rows, and the request returns an empty page. The list component calls `setPage(1)` when the debounced search changes.
- **`customers/new` before `customers/:id` in the route list.** Otherwise `:id` matches `"new"`, `Number("new")` is `NaN`, and the profile page fires `/customers/NaN/`. The profile also guards `Number.isNaN` independently, because a hand-typed URL can produce it too.
- **`useAppForm` reads `defaultValues` once, at mount.** In edit mode the form must not render until `useCustomer` resolves, or it mounts with empty defaults and silently blanks every field the user does not touch. Render `<Loading />` until the query succeeds.
- **A duplicate email is a field error, not a toast.** DRF's `ModelSerializer` derives a `UniqueValidator` from `unique=True`, producing `validation_error` with `fields: {"email": [...]}` — which `applyServerErrors` attaches to the input. The shared `MutationCache.onError` also toasts it (§ 21's documented rough edge), so the user sees both. Accepted, unchanged.
- **`DefaultRouter` adds an API-root view at `/api/`.** With `path("", include(...))` the router's root lands where the catch-all `re_path` previously returned an enveloped 404. Harmless — it renders through `EnvelopeJSONRenderer` — but it *is* a behaviour change to a URL that existing tests touch. Verification Step 6 checks it explicitly; switch to `SimpleRouter` if the enveloped 404 at `/api/` is worth keeping.
- **`ApiCatchAllTests` asserts on unmatched `/api/` paths.** Those tests use `/api/nope/` and `/api/deep/nested/path/`, which the router does not claim, so they still pass — but the router is registered *before* the catch-all, so any future router prefix that overlaps a test path would break them. Verification Step 5 is the check.
- **A role without the permission gets 403 on write and a hidden button — which must agree.** `<Can permission="customers.manage">` hides the control and the API returns `permission_denied` if it is called anyway. They agree because both read the same string; § 22's superuser rule is what keeps them agreeing for an account with no role.
- **`delete` returns 204 with an empty body.** `EnvelopeJSONRenderer` special-cases 204 to `b""` and `api.delete` returns early when `response.data` is falsy — verified in both files. So `deleteCustomer` needs no special handling, but a future change making `destroy` return 200 with a body would need the envelope.
- **The cross-app grant migration must not overwrite.** `role.permissions = sorted(set(existing) | set(new))`. A plain assignment would wipe `users.view` from `manager` and every grant a later story adds. It is also what makes the migration safe to re-run.
- **`ALL_PERMISSIONS` is reflection over `vars(Permissions)`** — adding a constant is enough, but adding a *non-string* class attribute to `Permissions` would be picked up as a permission. The comprehension filters on `isinstance(value, str)`; keep it that way.
- **The grant migration runs before an admin can see the permission.** `Role.clean()` rejects a permission string not in `ALL_PERMISSIONS`, so applying the migration on a deployment whose code predates task 2's constants fails validation on the next admin save. Ship the code and the migration together — they are one change.
- **Query cache is not permission-aware.** Unchanged from § 22's forward constraint: if a role loses `customers.view` mid-session, cached list results persist until refetched. Still not reachable without SEC-1.
- **Arabic list rendering.** Numbers go through `useFormatters` (Western digits, pinned per § 18), the table's chevrons already swap by direction (`DataTablePagination`), and `text-end` is the only alignment used. `npm run check:rtl` covers the class-level rule; Verification Step 11 is the visual check.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass. `MigrationStateTests.test_no_pending_migrations` catches a model shipped without its migration, and `ApiCatchAllTests` is the guard on the new router not shadowing the catch-all.
2. `ruff format --check .` / `ruff check .` over the new Python.
3. `npm run build` — typechecks the `Customer`/`CustomerInput` mirrors, every `ColumnDef<Customer>`, the `useAppForm<typeof schema>` instantiation, and every new `t('customers:…')` key through `CustomTypeOptions`.
4. `npm run lint` (`react/jsx-no-literals` over four new components), `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison — Verification Step 4.
6. Real HTTP across three role accounts plus a real browser walkthrough in both languages — Verification Steps 5–12. The story's actual claim is that four independent foundations compose; only driving it end to end shows that.

---

## Migration / Rollback

**Two migrations, both additive.** `customers/0001_initial` creates one table; `customers/0002_grant_customer_permissions` updates three existing `Role` rows. **No reset, no data loss, no schema change to an existing table.**

**Rollback of the code:** revert the commits. **No `npm install` and no `pip install`** — this story adds no dependency (`SearchFilter` is DRF core).

**Rollback of the schema:**

```powershell
python manage.py migrate customers zero
```

`0002`'s reverse (`revoke`) removes only the two `customers.*` strings via set difference, leaving every other grant intact; `0001`'s reverse drops the table. Both are clean because nothing references `Customer` yet — the moment TKT-1 adds `Ticket.customer`, dropping this table becomes a `PROTECT`-blocked operation and the reverse needs the tickets removed first.

**Half-applied states to avoid:**

- **Task 2's permission constants without task 3's grant** → every customer endpoint returns 403 for every non-superuser, and the UI hides everything. The API works, and it looks like a broken feature. Ship them together.
- **Task 3's grant without task 2's constants** → `Role.clean()` rejects the unknown string on the next admin save of any granted role. The migration itself succeeds (it does not call `full_clean()`), so this surfaces later and confusingly.
- **Task 5's schema helpers before task 2's serializer accepts `null`** → clearing an email returns `validation_error` on `email`, which looks like the form's fault.
- **Task 7 before task 6** → every `t('customers:…')` key fails `tsc -b`, because `AppResources` has no `customers` namespace.
- **Task 9's routes before tasks 7/8** → the lazy imports resolve to modules that do not exist; the build fails on the import, not the route.
- **`SearchFilter` added to settings but `search_fields` not declared** → harmless and inert, which is the point: it changes nothing for `HealthView` or any existing view.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migrations apply forward, no reset:** `python manage.py migrate`; `python manage.py showmigrations customers` shows `0001` and `0002` applied.
3. **The grant landed additively, without wiping story 09's:**

   ```powershell
   python manage.py shell -c "from apps.accounts.models import Role; [print(r.slug, sorted(r.permissions)) for r in Role.objects.all()]"
   ```

   Every role must still hold its story-09 permissions **plus** the two `customers.*`. `manager` must still have `users.view`.
4. **`en` and `ar` key sets match** for the new namespace. From `frontend/`:

   ```powershell
   node -e "const a=require('./src/features/customers/locales/en.json'),b=require('./src/features/customers/locales/ar.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?f(v,p+k+'.'):[p+k]);const A=f(a).sort(),B=f(b).sort();console.log('missing in ar:',A.filter(k=>!B.includes(k)));console.log('extra in ar:',B.filter(k=>!A.includes(k)))"
   ```

   Both arrays empty.
5. **Backend regression:** `python manage.py test` reports **54** passing — `ApiCatchAllTests` in particular, which proves the new router did not shadow the catch-all.
6. **`GET /api/` — decide and record what it now returns.** With the server running, `curl.exe -s http://127.0.0.1:8000/api/`. With `DefaultRouter` this is the router root (an envelope containing the route map); it was previously an enveloped 404. Confirm it is still a valid envelope. If the 404 is worth keeping, switch `customers/urls.py` to `SimpleRouter` and re-run.
7. **Every action enforces its own permission.** Using the three story-09 accounts (`admin@`, `mgr@`, `agent@`, password `Sup3rSecret!`) plus no token, check each verb:

   | Request | no token | a role **without** `customers.manage` | `agent@` |
   |---|---|---|---|
   | `GET /api/customers/` | 401 `not_authenticated` | 200 (has `customers.view`) | 200 |
   | `POST /api/customers/` | 401 | 403 `permission_denied` | 201 |
   | `PATCH /api/customers/<id>/` | 401 | 403 | 200 |
   | `DELETE /api/customers/<id>/` | 401 | 403 | 204 |

   For the middle column, temporarily strip `customers.manage` from one role in Django admin (or the shell), run the four requests, then restore it. **Testing `destroy` specifically matters** — an unmapped action would have returned 204 to anyone signed in.
8. **A duplicate email is a field error.** `POST` two customers with the same email:

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/customers/ -H "Content-Type: application/json" -H "Authorization: Bearer $t" -d '{\"name\":\"A\",\"email\":\"dupe@example.com\"}'
   curl.exe -s -X POST http://127.0.0.1:8000/api/customers/ -H "Content-Type: application/json" -H "Authorization: Bearer $t" -d '{\"name\":\"B\",\"email\":\"dupe@example.com\"}'
   ```

   The second returns `validation_error` with `fields: {"email": [...]}` — **not** `internal_error`.
9. **Two customers with no email both save.** `POST` `{"name":"NoEmail1"}` then `{"name":"NoEmail2"}` — both **201**, and both come back with `"email": null`. If the second is a 500, the blank→NULL normalisation is missing. Then `POST` `{"name":"Blank","email":""}` and confirm it also returns `"email": null`.
10. **Clearing an email actually clears it.** `PATCH` a customer that has an email with `{"email": null}`; `GET` it back and confirm `"email": null`. Then repeat with `{"email": ""}` — same result.
11. **Ordering and search do what the columns claim.** `?ordering=name`, `?ordering=-name`, `?ordering=company`, `?ordering=created_at` each change the order; `?ordering=phone` is **ignored** (not in `ordering_fields`) rather than erroring. `?search=` against a name fragment, an email fragment, and a company fragment each narrow the set. Confirm `meta.pagination` is present and correct on every list response.
12. **The full UI walkthrough, both languages.** `npm run dev` with the backend up, signed in as `agent@`:
    - `/customers` lists rows; each sortable header toggles asc → desc → default and the row order changes; the pagination buttons enable/disable at the boundaries.
    - Search narrows the list **and resets to page 1** (go to page 2 first, then type).
    - "New customer" creates one, toasts, and lands on the profile. **The list shows it without a manual refresh** — the invalidation check.
    - Edit changes a field and the list reflects it. Clear the email, save, reopen the form: still empty.
    - Delete asks for confirmation, then returns to the list without the row.
    - Switch to Arabic: every string is translated, `dir="rtl"`, the pagination chevrons point the other way, dates are Western digits, and no layout is mirrored wrongly.
    - Sign in as an account **without** `customers.manage`: the "New customer" button, Edit, and Delete are all absent. Sign in as one **without** `customers.view`: `/customers` redirects to `/` and the nav link is absent.
13. **No hardcoded strings, no ad-hoc role checks.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\customers\**\*.tsx -Pattern "'[A-Z][a-z]{3,}"
    Select-String -Path src\features\customers\**\*.tsx,src\features\customers\**\*.ts -Pattern "user\.role|is_staff|permissions\.includes"
    ```

    The first must return only non-user-facing hits; the second must return **nothing** — a feature gates through `can()`/`<Can>`, never by reading the role.
14. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `customers.Customer` extends `TimeStampedModel` with `name`, `email` (**`unique=True, null=True, blank=True`**), `phone`, `company`, and `Meta.ordering = ("name",)`; `clean()` normalises blank email to `None`.
- [ ] **No `notes` field, no `ContactDetail`, no `is_active`** — CUST-2/CUST-4 boundaries respected.
- [ ] `apps/customers/migrations/0001_initial.py` committed; `manage.py test` reports no pending migrations.
- [ ] `Permissions` gains `CUSTOMERS_VIEW` and `CUSTOMERS_MANAGE`; `ALL_PERMISSIONS` picks them up with no other change.
- [ ] `customers/0002_grant_customer_permissions.py` is a **cross-app** data migration depending on `("accounts", "0003_seed_roles")`, grants by **set union** (never assignment), and reverses by set difference. Story 09's grants survive it (Verification Step 3).
- [ ] `CustomerSerializer` extends `BaseModelSerializer` with `class Meta(BaseModelSerializer.Meta)`; `email` is `required=False, allow_blank=True, allow_null=True` and `validate_email` returns `value or None`.
- [ ] `CustomerViewSet` extends `BaseModelViewSet` with **all six actions mapped**, plus `ordering_fields` and `search_fields`. No `permission_classes` override.
- [ ] `SearchFilter` added to `DEFAULT_FILTER_BACKENDS` beside `OrderingFilter`; **no new package** in `requirements.txt`; `DEFAULT_PERMISSION_CLASSES` **unchanged** (`AllowAny`).
- [ ] `config/api_urls.py` registers the router **above** the catch-all `re_path`, which is still last; `ApiCatchAllTests` still passes; `GET /api/` returns a valid envelope and its new content is recorded (Verification Step 6).
- [ ] `features/customers/` contains `types/customer.ts`, `api/` (keys, five call modules, `useCustomers`, `useCustomer`, `useCustomerMutations`), `components/` (list, profile, form), and `locales/{en,ar}.json` registered in `resources.ts`.
- [ ] `Customer` TS type mirrors the serializer verbatim, with `email: string | null`.
- [ ] Edits use **`api.patch`**, not `api.put` — with the verified reason in a comment.
- [ ] **Every mutation invalidates `customerKeys.all`**, not an individual page key; a create appears in the list with no manual refresh (Verification Step 12).
- [ ] `nullableString` and `nullableEmail` added to the **shared** `schemas.ts` (transforming `''` → `null`); `optionalString`/`optionalEmail` **unchanged**; only `email` uses the nullable pair in this feature.
- [ ] The list screen uses `DataTable` + `useServerTable`, is **not** wrapped in `QueryBoundary`, passes a `caption`, resets to page 1 on a search change, and distinguishes "no customers" from "no search results".
- [ ] Every `sortable` column's `id` appears in `ordering_fields`; `phone` is not sortable.
- [ ] The profile uses `QueryBoundary`, guards `Number.isNaN` on the route param, and gates Edit/Delete behind `<Can permission="customers.manage">`; Delete goes through `useConfirm()`.
- [ ] The form serves create and edit from one component, renders `<Loading />` until `useCustomer` resolves in edit mode, and routes a duplicate-email `validation_error` onto the email input via `applyServerErrors`.
- [ ] Routes are nested inside `RequireAuth` → `RequirePermission permission="customers.view"`, with `customers/new` declared **before** `customers/:id`.
- [ ] `RootLayout` gains the first nav link, gated by `<Can permission="customers.view">` — the first production call site of `<Can>`.
- [ ] Verified by real HTTP: all four verbs × three permission states behave per Verification Step 7's table, **including `DELETE`**.
- [ ] Verified: two email-less customers both save (Step 9); a duplicate email is a field error not a 500 (Step 8); clearing an email persists (Step 10); `?ordering=phone` is ignored rather than an error (Step 11).
- [ ] Both languages walk through cleanly, RTL included (Step 12).
- [ ] `CONVENTIONS.md` gains `## 23. Feature module conventions` — **appended, §0–§22 unrenumbered** — covering the backend and frontend feature shapes, the cross-app grant-migration rule, the `ordering_fields`/`ColumnDef.id` contract, prefix invalidation, PATCH-for-edit, the nullable-vs-optional helper choice, and the unique-nullable-column normalisation.
- [ ] `README.md` § Consuming the API gains a **Mutations & invalidation** paragraph; § Environment variables **unchanged**. `frontend/src/README.md` § Forms & validation names the new helper pair.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/customer-management/00-overview.md` filled in and `00-index.md` updated.

**STOP HERE. Report to the user and wait for confirmation. This is the first feature story — expect the four foundations to need small adjustments where they first meet real data, and report any that surfaced. The next story is CUST-2 (Contact Details), which must decide whether `ContactDetail` supersedes this story's primary `email`/`phone` fields or hangs beside them.**
