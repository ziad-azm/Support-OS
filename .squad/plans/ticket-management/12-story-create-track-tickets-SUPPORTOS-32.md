# Story 12 — Create & Track Tickets (Story: SUPPORTOS-32)

## Prerequisites

- **Story 10 (CUST-1) completed and committed** (`a53bf16`): `Customer` model, `BaseModelViewSet`/`BaseModelSerializer` established as the reuse points, `Permissions.CUSTOMERS_VIEW`/`CUSTOMERS_MANAGE` as the worked example for a feature's own grant migration, and the whole `features/customers/` frontend slice as the template `CONVENTIONS.md` § 23 documents.
- **Story 09 (AUTH-2) completed**: `HasPermission`, `permission_map`, the three seeded roles (`admin`, `manager`, `agent`).
- **Story 11 (CUST-2) is NOT a dependency of this story.** TKT-1's own intake lists only `CUST-1, AUTH-2`. This story does not read or touch `apps/customers/models.py::ContactDetail` or anything Story 11 added.
- **This story is what unblocks CUST-3 (SUPPORTOS-30, Interaction History), not the other way around.** CUST-3's intake lists `CUST-1, TKT-1, COMM-*` — it needs a real `Ticket` model to aggregate against, which does not exist until this story ships. `COMM-*` (a `Message` model) is still not planned; CUST-3 stays blocked until that lands too, but TKT-1 is the piece this session can unblock now.
- **Verified backend baseline:** `apps/tickets/` is untouched `startapp` scaffolding — `models.py`, `views.py` contain only `# Create your ... here.`, `admin.py` only `# Register your models here.`, `migrations/` holds only `__init__.py`. `apps.tickets` is already in `LOCAL_APPS` (`config/settings/base.py:55`) and `TicketsConfig.name` is already the correct dotted `apps.tickets` (`apps/tickets/apps.py`).
- **Verified: `python manage.py test` currently reports 54 passing** — the same baseline Story 11 left, confirming no drift.
- **Ticket-management is the second feature domain**, after customer-management. Two structural questions get answered here for the first time, both verified rather than assumed:

  **1. A second `DefaultRouter` mounted at the API root collides with the first one.** `apps/customers/urls.py` already mounts a `DefaultRouter` at `path("", include("apps.customers.urls"))` in `config/api_urls.py:14`, and Story 10's own plan recorded that this gives `DefaultRouter` an auto-generated API-root view at `/api/` (documented, accepted). Mounting a **second** `DefaultRouter` for tickets at the same empty prefix would register a second root view at the identical path — Django's URL resolver tries `urlpatterns` in order, so whichever `include()` appears first in `api_urls.py` wins `/api/` and the second router's root view becomes dead code, silently. This is real, structural ambiguity, not a hypothetical: both routers mount at `path("")` in the same `urlpatterns` list. **Fix: `apps/tickets/urls.py` uses `SimpleRouter`, not `DefaultRouter`.** `SimpleRouter` generates no root view at all, so there is nothing to collide with `apps.customers.urls`'s existing root. This is exactly the alternative Story 10's own plan named ("switch to `SimpleRouter` if the enveloped 404 at `/api/` is worth keeping") — here it is needed for router-collision reasons, not the 404 reason, but the fix is the same.
  - **2. `on_delete=PROTECT` on `Ticket.customer` reintroduces a real, unhandled-500 gap in `apps/core/exceptions.py`.** Story 10's own plan named this exact forward decision: *"When TKT-1 adds `Ticket.customer`, that FK's `on_delete` is what protects a customer with history — `PROTECT` there is worth more than a speculative flag here."* Verified live against this project's other `PROTECT` relation (`accounts.User.role`, the only precedent before this story):

    ```
    >>> role = Role.objects.get(slug='agent')  # has a user
    >>> role.delete()
    django.db.models.deletion.ProtectedError: ("Cannot delete some instances of
    model 'Role' because they are referenced through protected foreign keys:
    'User.role'.", {<User: agent@supportos.local>})
    ```

    `ProtectedError` is a subclass of Django's `IntegrityError`, **not** `django.core.exceptions.ValidationError`. `apps/core/exceptions.py::_to_drf_exception` (lines 50-59) translates exactly three exception types — `Http404`, `DjangoPermissionDenied`, `DjangoValidationError` — and `grep` confirms zero existing handling for `ProtectedError` anywhere in the file. An untranslated `ProtectedError` falls through `drf_exception_handler` (which returns `None` for an exception it does not recognise) into `_internal_error_response`, an **unhandled `internal_error` 500**. The moment this story's `Ticket.customer` uses `PROTECT`, `DELETE /api/customers/<id>/` on any customer with tickets — a call that already exists and already works today — starts 500ing instead of returning a clean error. Task 6 fixes this in the **shared** `apps/core/exceptions.py`, because the gap is domain-agnostic (the next `PROTECT` relation anywhere in the app would hit the same bug) and it is a regression in already-shipped `CustomerViewSet.destroy` behaviour, not just new ticket functionality.
- **Verified: `SelectField`'s underlying `Select` requires a `string` value, which conflicts with the `positiveInt()` schema helper's `number` output.** `frontend/src/shared/ui/primitives/select.tsx:12-13` — `function Select({...props}: React.ComponentProps<typeof SelectPrimitive.Root>)`, i.e. Radix's `Select.Root`, whose `value`/`onValueChange` props are `string | undefined` / `(value: string) => void`. `positiveInt()` (`shared/validation/schemas.ts:58-61`) is `z.coerce.number().int().min(1)` — its **output** type is `number`, which cannot satisfy `Select`'s `value` prop without a cast, and no existing form combines `SelectField` with `positiveInt()` to have already worked this out (Story 10's only form has no `Select` field at all). Task 11's ticket form therefore keeps the `customer` field a **string** through the whole RHF/Zod layer (the selected customer's id, as text) and converts with `Number(...)` only when building the API payload — see `## Product rules`.
- **Verified: `ModelSerializer.get_unique_together_validators`/DRF's `SearchFilter`/`OrderingFilter` dotted-lookup behaviour are unaffected** — this story does not add a new unique constraint, and `search_fields`/`ordering_fields` with a `customer__name` lookup is standard, already-documented DRF behaviour (`OrderingFilter`/`SearchFilter` both build queryset expressions from whatever string is listed, including `__` lookups across a FK — no new verification needed beyond what Story 10/11 already established for the sibling fields).

---

## Story Goal

1. A `Ticket` model — `subject`, `description`, `customer` FK, `status` and `priority` placeholders — full CRUD through `BaseModelViewSet`, closed by new `tickets.view`/`tickets.manage` permissions.
2. A ticket list screen (`DataTable` + `useServerTable`, same shape as `CustomerListPage`) and a detail screen (`Card` + `QueryBoundary`, same shape as `CustomerProfilePage`).
3. A create/edit form via `FORM`, with a customer selector that reuses the **customer API** (the backend endpoint) directly — not the `customers` frontend feature's code, which `CONVENTIONS.md` § 15 forbids importing across features. See `## Product rules`.

### What `Ticket` holds, and what it deliberately does not

Four sibling stories in EPIC 4 own most of what a "ticket" eventually needs, so this story's model is the CRUD core plus two placeholder fields — nothing more:

| Field | Why it is here |
|---|---|
| `subject` | The short, required identifier of the issue — the list's primary column, same role `Customer.name` plays. |
| `description` | The issue detail. **Required**, not `blank=True`: a ticket exists to record an issue, and a title with no detail does not do that — contrast `Customer`'s optional `phone`/`company`, which are secondary contact fields, not the record's whole purpose. |
| `customer` | `ForeignKey(Customer, on_delete=PROTECT)`. **Required** — a ticket with no customer is meaningless. `PROTECT` is Story 10's own named forward decision for this exact field; see `## Prerequisites`. |
| `status` | A placeholder `TextChoices` (`open`/`in_progress`/`resolved`/`closed`, default `open`). Exists so **TKT-4** ("status enum with valid transitions") has a column to add transition rules to. This story enforces **no transition rules** — any status value is a valid PATCH — and ships **no status-changing UI** at all (see `## Story Goal`'s out-of-scope list): the field is read-only in the UI, always `open` on create. |
| `priority` | A placeholder `TextChoices` (`low`/`medium`/`high`/`urgent`, default `medium`). Unlike `status`, this **is** exposed in the create/edit form — no sibling story claims the create-time priority control specifically; TKT-2's own task is a `Category` **management** API and list **filters**, a different UI surface. |

**Not here, and why:**

- **No `Category` model, no priority management endpoints** — TKT-2. `priority` stays a fixed four-value enum with no admin-configurable set.
- **No `assigned_agent`** — TKT-3 ("Assignment API — `assigned_agent` + assign/reassign endpoint").
- **No status-transition validation, no escalation level/flag** — TKT-4 ("Status/escalation API — status enum with valid transitions + escalation level/flag"). This story's `status` field accepts any value via a plain PATCH; TKT-4 is what adds the guard rails and the dedicated "status control" UI action this story deliberately does not build (see below).
- **No `TicketActivity` log, no history endpoint** — TKT-5.
- **No `Message` FK** — COMM-0, which has not landed (`apps/communications/` is still pristine scaffolding, verified).

### Explicitly out of scope

- **A status-changing control in the UI.** TKT-4's own task list is "Status/escalation UI — Implement status control ... using shared confirm dialog." Building a bare status dropdown now would be immediately superseded by TKT-4's dedicated control. `status` is displayed (a `Badge`, read-only) on the list and detail screens, and is **not** a field in the create/edit form.
- **The customer selector is not a search-as-you-type combobox.** No `Command`/`Popover`/combobox primitive exists in `shared/ui/primitives/` (verified — the primitives directory has `select`, `dialog`, `dropdown-menu`, no `command`/`popover`). The selector is a plain `SelectField` populated by every customer up to the server's page cap (`page_size=100`), the same simplification Story 11 accepted for a customer's contact list. See `## Edge Cases` for the forward constraint.
- **No ticket categories, no assignment, no escalation, no activity history** — see the table above.
- **A dedicated 403 screen.** `RequirePermission` redirects to `/`, per Story 09.
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/ticket-management/SUPPORTOS-32/intake.md` — three task blocks, **no attachments, no acceptance criteria**. Done Criteria derive from the three **Outcome** lines.
2. `SupportOs backlog.MD` **lines 308-350** — all of EPIC 4. Read TKT-2 through TKT-5 before adding any field beyond the table above; **line 318**'s exact task wording ("subject, description, customer FK, timestamps, status, priority placeholders") is this story's field list verbatim.
3. `backend/apps/customers/models.py` — `Customer` (the FK target) and its `clean()`/`email` pattern, for contrast: `Ticket` has no comparable nullable-unique field, so it needs none of that normalisation.
4. `backend/apps/core/views.py` — `BaseModelViewSet` (lines 12-31): `permission_classes = [IsAuthenticated, HasPermission]`, `permission_map: dict[str, str] = {}`, and the "unmapped action is authenticated-only, not forbidden" rule task 3 must respect (map all six actions).
5. `backend/apps/core/exceptions.py` — **read the whole file** (100 lines). `envelope_exception_handler` (25-47), `_to_drf_exception` (50-59, the exact three-branch `isinstance` chain task 6 extends), `NON_FIELD_KEY` (line 22, already defined at module scope — task 6's new branch does not need to redefine it, `_normalise_fields` applies it automatically to a plain list `detail`).
6. `backend/apps/core/serializers.py` — `BaseModelSerializer` (20 lines): `class Meta(BaseModelSerializer.Meta)` inheritance requirement for `read_only_fields` to apply.
7. `backend/apps/core/permissions.py` — `Permissions` (currently `USERS_VIEW`, `USERS_MANAGE`, `ROLES_MANAGE`, `CUSTOMERS_VIEW`, `CUSTOMERS_MANAGE`), `ALL_PERMISSIONS` (reflection-derived, picks up new constants automatically), `HasPermission._required_permission`.
8. `backend/apps/accounts/migrations/0003_seed_roles.py` — the data-migration pattern task 5 copies exactly (`update_or_create` re-runnability, importing `Permissions` safely since `core/permissions.py` imports no models).
9. `backend/apps/customers/migrations/0002_grant_customer_permissions.py` — the **cross-app grant migration** worked example: `dependencies = [("customers", "0001_initial"), ("accounts", "0003_seed_roles")]`, set-union grant, set-difference revoke. Task 5 is the same shape for `tickets`.
10. `backend/apps/customers/urls.py` (11 lines) — the `DefaultRouter` this story does **not** copy; see `## Prerequisites`' router-collision finding. Task 3 uses `SimpleRouter` instead.
11. `backend/config/api_urls.py` (all 18 lines) — task 3 adds one `include()` **above** the catch-all `re_path`, which must stay last.
12. `backend/config/settings/base.py` — `LOCAL_APPS` (line 55, `apps.tickets` already present), `DEFAULT_FILTER_BACKENDS` (`OrderingFilter` + `SearchFilter`, already both present since Story 10 — task 3 needs **no settings change**).
13. `backend/apps/customers/admin.py` — `CustomerAdmin`'s `list_display`/`search_fields`/`readonly_fields` shape, which `TicketAdmin` (task 4) follows.
14. `frontend/src/features/customers/types/customer.ts` (19 lines) — the `Customer`/`CustomerInput` mirror pattern, and the `as const` array idiom (`CONVENTIONS.md` § 3) task 7's `TICKET_STATUSES`/`TICKET_PRIORITIES` and `frontend/src/features/customers/types/contactDetail.ts`'s `CONTACT_CHANNELS` both already use.
15. `frontend/src/features/customers/api/` (all files, especially `getCustomers.ts`, `customerKeys.ts`, `useCustomerMutations.ts`) — the per-resource file shape (`get<Thing>.ts`, `<feature>Keys.ts`, `use<Thing>`/`use<Things>`, `use<Thing>Mutations.ts`) task 7 mirrors for `tickets`.
16. `frontend/src/shared/lib/api/client.ts` — `api.getPage` (lines 162-173) and `api.patch`/`api.post`/`api.delete`. No new client method is needed.
17. `frontend/src/shared/ui/primitives/select.tsx` lines 8-13 — confirms `Select`'s `value`/`onValueChange` come from `SelectPrimitive.Root`, i.e. Radix, i.e. `string`-typed. This is the exact evidence behind `## Prerequisites`' `positiveInt()` finding.
18. `frontend/src/shared/validation/schemas.ts` — `requiredString`, `choice`, `positiveInt` (lines 11-13, 64-66, 58-61). Task 11 uses `requiredString` and `choice`; it does **not** use `positiveInt` for the customer field (see above) and adds **no new helper** here.
19. `frontend/src/shared/ui/form/SelectField.tsx` (68 lines) and `TextareaField.tsx` (41 lines) — `description` uses `TextareaField`; `priority` and the customer selector use `SelectField`. Both are first real consumers beyond `ContactDetailsSection.tsx`'s `channel` `SelectField` (Story 11).
20. `frontend/src/features/customers/components/CustomerListPage.tsx` (118 lines) — the exact list-screen shape (debounced search + `useServerTable` + `DataTable`) task 9 copies verbatim, swapping columns.
21. `frontend/src/features/customers/components/CustomerProfilePage.tsx` (101 lines, after Story 11) — the `QueryBoundary` + `Card` + `<Can permission="...">` Edit/Delete + `useConfirm` shape task 10 copies. **Do not** copy Story 11's `ContactDetailsSection` insertion — that is customer-specific.
22. `frontend/src/features/customers/components/CustomerFormPage.tsx` (137 lines) — the one-component-for-create-and-edit shape, `defaultValues`-read-once-at-mount constraint, `applyServerErrors`/`isValidationError`/`useToast` pattern task 11 copies.
23. `frontend/src/app/router.tsx` (all 81 lines) — the `customers/new` **before** `customers/:id` ordering rule; task 12 adds a second `RequirePermission` block the same shape, nested in the **same** `RequireAuth` element (siblings, not nested inside the customers block).
24. `frontend/src/app/RootLayout.tsx` (all 47 lines) — `useTranslation(['common', 'customers'])` and the single `<Can permission="customers.view">` nav link; task 12 adds `tickets` to the translation array and a second nav link.
25. `frontend/src/shared/i18n/resources.ts` (43 lines) — the two-imports-plus-one-entry-per-language registration pattern.
26. `frontend/src/README.md` line 24-28 (`## A feature never imports from another feature`) — the rule task 7's customer-options file resolves without breaking; task 13 appends the worked example.
27. `CONVENTIONS.md` § 15 (import conventions — the `no-restricted-imports` rule, `frontend/.oxlintrc.json:8-18`, verified to block **any** `@/features/*` import from another feature with zero exceptions besides `resources.ts`), § 22 (permission_map convention), and § 23 (feature module conventions — the template this story is the **second** consumer of, after Story 10/11).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **CRUD via base viewset / envelope / permissions.** | Intake, task 1 | `TicketViewSet(BaseModelViewSet)` with a full `permission_map`. |
| **`Ticket` fields exactly:** `subject`, `description`, `customer` FK, timestamps, `status`/`priority` placeholders. | Intake, task 1 | `backend/apps/tickets/models.py::Ticket` — no more, no fewer. |
| **List via the shared table pattern; reuse `UI`, `I18N`.** | Intake, task 2 | `DataTable` + `useServerTable`, `tickets` locale namespace. |
| **Create/edit via `FORM`; customer selector reuses the customer API.** | Intake, task 3 | `useAppForm` + `TextField`/`TextareaField`/`SelectField`. The selector calls `GET /customers/` directly from a `features/tickets/api/` file — **not** an import of `features/customers`, which `no-restricted-imports` (`.oxlintrc.json:8-18`) forbids outright. Two features consuming the same backend endpoint independently is not the code duplication § 15's rule warns against; it is the correct decoupling — each feature's `api/` layer owns exactly the shape it needs. Task 13 documents this explicitly since it is the first time two features touch the same endpoint. |
| **A `PROTECT` FK needs the shared exception handler to translate `ProtectedError`, or an existing endpoint (`Customer.destroy`) starts 500ing.** | This story's design, per Story 10's own forward note | `apps/core/exceptions.py::_to_drf_exception` gains a fourth branch (task 6), verified necessary against the project's other `PROTECT` relation. |
| **A `SelectField`-backed numeric id stays a string through the form, converted at the API-payload boundary.** | This story's design | `contactSchema`... err, `ticketSchema`'s `customer` field is `z.string().min(1)`, not `positiveInt()`; `toTicketInput()` does `Number(values.customer)`. See `## Prerequisites`' verified `Select`/`positiveInt()` type conflict. |
| **A second `DefaultRouter` cannot share the API root with the first.** | This story's design | `apps/tickets/urls.py` uses `SimpleRouter`. |
| Wire format is `snake_case` end to end. | § 12 | `Ticket`/`TicketInput` TS types mirror the serializer verbatim. |
| Config from `ENV`; no new secrets, no new dependency. | § 17 | No environment variable, no package — `SimpleRouter` and `ProtectedError` are both already-installed (DRF core / Django core). |

---

## Backend Tasks

### 1 — The `Ticket` model

**File: `backend/apps/tickets/models.py`** — replace the placeholder:

```python
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.customers.models import Customer


class Ticket(TimeStampedModel):
    """A support ticket — the core record EPIC 4's sibling stories extend.

    `status` and `priority` are deliberately minimal placeholders: TKT-2 owns
    real priority/category management, TKT-3 owns assignment, TKT-4 owns
    status-transition validation and escalation, TKT-5 owns activity history.
    None of that is pre-empted here. See Story 12 `## Story Goal`.
    """

    class Status(models.TextChoices):
        OPEN = "open", _("Open")
        IN_PROGRESS = "in_progress", _("In progress")
        RESOLVED = "resolved", _("Resolved")
        CLOSED = "closed", _("Closed")

    class Priority(models.TextChoices):
        LOW = "low", _("Low")
        MEDIUM = "medium", _("Medium")
        HIGH = "high", _("High")
        URGENT = "urgent", _("Urgent")

    subject = models.CharField(_("subject"), max_length=200)
    # Required, not blank=True: a ticket records an issue, and a title with
    # no detail does not do that. Contrast Customer.phone/company, which are
    # secondary contact fields, not the record's whole purpose.
    description = models.TextField(_("description"))
    # PROTECT, not CASCADE: Story 10's own forward note names this exact
    # decision — a customer with ticket history must not silently vanish.
    # `apps/core/exceptions.py` gains ProtectedError handling in task 6
    # because this makes DELETE /api/customers/<id>/ fail cleanly instead of
    # with an unhandled 500 the moment a customer has tickets.
    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, related_name="tickets", verbose_name=_("customer")
    )
    status = models.CharField(
        _("status"), max_length=20, choices=Status.choices, default=Status.OPEN
    )
    priority = models.CharField(
        _("priority"), max_length=20, choices=Priority.choices, default=Priority.MEDIUM
    )

    class Meta:
        verbose_name = _("ticket")
        verbose_name_plural = _("tickets")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.subject
```

`ordering = ("-created_at",)` — newest first, the opposite of `Customer.Meta.ordering`'s alphabetical `("name",)`; a ticket queue is read newest-first, a customer directory is read alphabetically. Still deterministic, so pagination stays stable — same reasoning as `Customer`'s ordering, different default direction.

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations tickets
```

Expect one file, `apps/tickets/migrations/0001_initial.py`. **Commit it** — `MigrationStateTests.test_no_pending_migrations` fails the build otherwise.

---

### 2 — Permissions and serializer

**File: `backend/apps/core/permissions.py`** — add two constants to `Permissions`:

```python
    TICKETS_VIEW = "tickets.view"
    TICKETS_MANAGE = "tickets.manage"
```

**Create file: `backend/apps/tickets/serializers.py`**

```python
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Ticket


class TicketSerializer(BaseModelSerializer):
    # Read-only convenience for the list/detail screens — without it, every
    # row would show a bare numeric customer id. Source traverses the FK;
    # the viewset's `select_related("customer")` (task 3) is what keeps this
    # from costing an extra query per row on `list`.
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta(BaseModelSerializer.Meta):
        model = Ticket
        fields = (
            "id",
            "subject",
            "description",
            "customer",
            "customer_name",
            "status",
            "priority",
            "created_at",
            "updated_at",
        )
```

No `validate()` override — unlike `CustomerSerializer.email`/`ContactDetailSerializer.value`, nothing here needs cross-field validation or blank-normalisation. `customer` is not explicitly declared, so `ModelSerializer` auto-generates it as a required `PrimaryKeyRelatedField(queryset=Ticket.customer.field.related_model.objects.all())` — existence-validated by DRF, no extra code needed.

---

### 3 — Viewset and routing

**Create file: `backend/apps/tickets/views.py`** — replacing the placeholder:

```python
from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Ticket
from .serializers import TicketSerializer


class TicketViewSet(BaseModelViewSet):
    """Ticket CRUD. The second consumer of `BaseModelViewSet`, after Customer."""

    queryset = Ticket.objects.select_related("customer").all()
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
    # like `CustomerViewSet`. `customer`/`customer_name` are deliberately
    # absent — see Story 12 `## Story Goal` for why that column is not
    # sortable, the same choice Story 10 made for `Customer.phone`.
    ordering_fields = ("subject", "status", "priority", "created_at")
    search_fields = ("subject", "description", "customer__name")
```

**All six actions are mapped deliberately** — an unmapped action grants rather than denies (§ 22), and leaving `destroy` unmapped would let any signed-in user delete a ticket.

**Create file: `backend/apps/tickets/urls.py`**

```python
from rest_framework.routers import SimpleRouter

from .views import TicketViewSet

app_name = "tickets"

# SimpleRouter, not DefaultRouter: apps.customers.urls already mounts a
# DefaultRouter at the same `path("")` prefix in config/api_urls.py, and its
# auto-generated API-root view already claims `/api/` (Story 10). A second
# DefaultRouter mounted at the same prefix would register a second, dead
# root view. SimpleRouter generates none — see Story 12 `## Prerequisites`.
router = SimpleRouter()
router.register("tickets", TicketViewSet, basename="ticket")

urlpatterns = router.urls
```

**File: `backend/config/api_urls.py`** — one more `include()`, above the catch-all:

```python
urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.customers.urls")),
    path("", include("apps.tickets.urls")),
    # Must stay last: turns an unmatched /api/ path into an enveloped 404
    # instead of Django's HTML 404 page.
    re_path(r"^", ApiNotFoundView.as_view()),
]
```

Endpoints: `GET/POST /api/tickets/`, `GET/PUT/PATCH/DELETE /api/tickets/<pk>/`.

---

### 4 — Admin

**File: `backend/apps/tickets/admin.py`** — replace the placeholder:

```python
from django.contrib import admin

from .models import Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "customer", "status", "priority", "created_at")
    list_filter = ("status", "priority")
    search_fields = ("subject", "description", "customer__name")
    readonly_fields = ("created_at", "updated_at")
```

---

### 5 — Grant the new permissions to the seeded roles

**Create file: `backend/apps/tickets/migrations/0002_grant_ticket_permissions.py`**

```python
from django.db import migrations

from apps.core.permissions import Permissions

# Same reasoning as customers/0002_grant_customer_permissions.py: agents work
# tickets day to day, managers need oversight, admin is explicit-by-grant
# (role-based, not automatic) — a superuser bypasses roles entirely
# (CONVENTIONS.md §22).
GRANTS = {
    "admin": [Permissions.TICKETS_VIEW, Permissions.TICKETS_MANAGE],
    "manager": [Permissions.TICKETS_VIEW, Permissions.TICKETS_MANAGE],
    "agent": [Permissions.TICKETS_VIEW, Permissions.TICKETS_MANAGE],
}


def grant(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
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
    dependencies = [
        ("tickets", "0001_initial"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

**Set union, not assignment** — same reason as Story 10's worked example: a plain assignment would wipe `customers.*` (and any other) grants already on these roles.

---

### 6 — Shared fix: `ProtectedError` in the exception handler

**File: `backend/apps/core/exceptions.py`** — add one import and one branch:

```python
from django.db.models import ProtectedError
```

(third-party import block, alphabetised with the existing `django.core.exceptions`/`django.http`/`django.utils.translation` imports)

```python
def _to_drf_exception(exc):
    """Translate Django's own exceptions into their DRF equivalents."""
    if isinstance(exc, Http404):
        return drf_exceptions.NotFound()
    if isinstance(exc, DjangoPermissionDenied):
        return drf_exceptions.PermissionDenied()
    if isinstance(exc, DjangoValidationError):
        detail = getattr(exc, "message_dict", None) or exc.messages
        return drf_exceptions.ValidationError(detail=detail)
    if isinstance(exc, ProtectedError):
        # Raised by Django's delete collector for an on_delete=PROTECT FK —
        # e.g. DELETE /api/customers/<id>/ on a customer with Ticket rows
        # (TKT-1, Story 12). Not a DjangoValidationError, so without this
        # branch it falls through to an unhandled 500. Verified live against
        # this project's other PROTECT relation (accounts.Role/User.role).
        # See Story 12 `## Prerequisites`.
        return drf_exceptions.ValidationError(detail=[str(PROTECTED_DELETE_MESSAGE)])
    return exc
```

Add the message constant beside the existing ones near the top of the file:

```python
PROTECTED_DELETE_MESSAGE = _(
    "This record cannot be deleted because other records still reference it."
)
```

**Deliberately generic wording**, not customer/ticket-specific — this handler is shared by every domain, and the next `PROTECT` relation (whatever it is) hits the same branch with no further change needed.

**A plain list `detail`, not a dict.** `envelope_exception_handler`'s `_normalise_fields` (line 62-66) wraps a non-dict `detail` as `{NON_FIELD_KEY: [...]}` automatically — no need to build that dict by hand, matching how the `DjangoValidationError` branch above it also passes `exc.messages` (a plain list in the common case) straight through.

---

## Frontend Tasks

### 7 — Types, API layer, and query keys

**Create file: `frontend/src/features/tickets/types/ticket.ts`**

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
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  updated_at: string
}

/** The write shape. `status` is excluded on purpose: this story ships no
 * status-changing UI (TKT-4 owns it) — the server default (`open`) is what
 * every created ticket gets, and there is no form field to send anything
 * else. */
export type TicketInput = {
  subject: string
  description: string
  customer: number
  priority: TicketPriority
}
```

**Create file: `frontend/src/features/tickets/types/customerOption.ts`**

```ts
/**
 * Minimal shape for the ticket form's customer selector. This feature calls
 * `/customers/` directly (see `../api/getCustomerOptions.ts`) rather than
 * importing `@/features/customers` — `no-restricted-imports`
 * (`frontend/.oxlintrc.json`) forbids any `@/features/*` import from
 * another feature. See CONVENTIONS.md §15 and Story 12 `## Product rules`.
 */
export type CustomerOption = {
  id: number
  name: string
}
```

**Create file: `frontend/src/features/tickets/api/ticketKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const ticketKeys = featureKey('tickets')
```

**Create file: `frontend/src/features/tickets/api/getTickets.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Ticket } from '../types/ticket'

export type TicketListParams = ServerTableParams & { search?: string }

export function getTickets(params: TicketListParams): Promise<Page<Ticket>> {
  return api.getPage<Ticket>('/tickets/', { params })
}
```

**Create file: `frontend/src/features/tickets/api/getTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Ticket } from '../types/ticket'

export function getTicket(id: number): Promise<Ticket> {
  return api.get<Ticket>(`/tickets/${id}/`)
}
```

**Create file: `frontend/src/features/tickets/api/createTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Ticket, TicketInput } from '../types/ticket'

export function createTicket(input: TicketInput): Promise<Ticket> {
  return api.post<Ticket>('/tickets/', input)
}
```

**Create file: `frontend/src/features/tickets/api/updateTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Ticket, TicketInput } from '../types/ticket'

// PATCH, not PUT — CONVENTIONS.md §23: DRF drops an absent optional field
// from `validated_data` on either verb, so PUT cannot clear a value by
// omission. This form always sends every field it owns, so the distinction
// is mostly moot here, but PATCH is the project's one edit verb regardless.
export function updateTicket(id: number, input: TicketInput): Promise<Ticket> {
  return api.patch<Ticket>(`/tickets/${id}/`, input)
}
```

**Create file: `frontend/src/features/tickets/api/deleteTicket.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export function deleteTicket(id: number): Promise<void> {
  return api.delete(`/tickets/${id}/`)
}
```

**Create file: `frontend/src/features/tickets/api/useTickets.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getTickets } from './getTickets'
import type { TicketListParams } from './getTickets'
import { ticketKeys } from './ticketKeys'

export function useTickets(params: TicketListParams) {
  return useQuery({
    queryKey: ticketKeys.resource('list', params),
    queryFn: () => getTickets(params),
  })
}
```

**Create file: `frontend/src/features/tickets/api/useTicket.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getTicket } from './getTicket'
import { ticketKeys } from './ticketKeys'

export function useTicket(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ticketKeys.resource('detail', id),
    queryFn: () => getTicket(id),
    enabled: options?.enabled,
  })
}
```

**Create file: `frontend/src/features/tickets/api/useTicketMutations.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createTicket } from './createTicket'
import { deleteTicket } from './deleteTicket'
import { ticketKeys } from './ticketKeys'
import { updateTicket } from './updateTicket'
import type { TicketInput } from '../types/ticket'

/**
 * Prefix-wide invalidation, per CONVENTIONS.md §23 — unlike Story 11's
 * ContactDetail (a non-paginated per-customer sub-resource), the ticket list
 * IS paginated/sorted, so a create/edit/delete can change which rows land on
 * which page. This is the default rule, not the exception.
 */
export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TicketInput) => createTicket(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useUpdateTicket(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TicketInput) => updateTicket(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useDeleteTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTicket(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}
```

**Create file: `frontend/src/features/tickets/api/getCustomerOptions.ts`**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { CustomerOption } from '../types/customerOption'

// page_size: 100 (the server's max, DRF_MAX_PAGE_SIZE) — no search-as-you-type
// combobox primitive exists yet, so the selector lists every customer up to
// the server's page cap, the same simplification Story 11 accepted for a
// customer's contact list. See `## Edge Cases` for the forward constraint.
export function getCustomerOptions(): Promise<Page<CustomerOption>> {
  return api.getPage<CustomerOption>('/customers/', {
    params: { page_size: 100, ordering: 'name' },
  })
}
```

**Create file: `frontend/src/features/tickets/api/useCustomerOptions.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getCustomerOptions } from './getCustomerOptions'
import { ticketKeys } from './ticketKeys'

/**
 * Cached under `ticketKeys`, not `customerKeys` — this feature cannot import
 * `@/features/customers` (CONVENTIONS.md §15), so it has no access to that
 * feature's cache namespace either. The data is fetched independently from
 * whatever the customers feature has cached; a small, accepted duplication
 * that is the direct cost of the enforced feature boundary, not an oversight.
 */
export function useCustomerOptions() {
  return useQuery({
    queryKey: ticketKeys.resource('customerOptions'),
    queryFn: getCustomerOptions,
  })
}
```

---

### 8 — Locale namespace

**Create file: `frontend/src/features/tickets/locales/en.json`**

```json
{
  "title": "Tickets",
  "new": "New ticket",
  "edit": "Edit ticket",
  "search": "Search tickets",
  "searchPlaceholder": "Subject, description, or customer",
  "empty": "No tickets yet",
  "emptyDescription": "Create the first ticket to get started.",
  "noSearchResults": "No tickets match that search.",
  "fields": {
    "subject": "Subject",
    "description": "Description",
    "customer": "Customer",
    "status": "Status",
    "priority": "Priority",
    "createdAt": "Created"
  },
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
  "actions": {
    "save": "Save",
    "delete": "Delete",
    "backToList": "Back to tickets"
  },
  "delete": {
    "title": "Delete this ticket?",
    "description": "This permanently removes the ticket. This cannot be undone."
  },
  "created": "Ticket created.",
  "updated": "Ticket updated.",
  "deleted": "Ticket deleted.",
  "notFound": "That ticket could not be found."
}
```

**Create `frontend/src/features/tickets/locales/ar.json`** with the identical key set, translated.

**File: `frontend/src/shared/i18n/resources.ts`** — register the namespace, following the existing `auth`/`customers`/`health` pattern: two imports plus one entry per language.

---

### 9 — The list screen

**Create file: `frontend/src/features/tickets/components/TicketListPage.tsx`** — copy `CustomerListPage.tsx`'s structure exactly (debounced search, `useServerTable`, `DataTable`, not wrapped in `QueryBoundary`), with these columns:

| `id` | header | sortable | notes |
|---|---|---|---|
| `subject` | `t('fields.subject')` | yes | `cell` renders `<Link to={\`/tickets/${row.id}\`}>{row.subject}</Link>` |
| `customer_name` | `t('fields.customer')` | **no** | not in `ordering_fields` — same choice as `Customer.phone` in Story 10's list. `cell` renders `row.customer_name` |
| `status` | `t('fields.status')` | yes | `cell` renders `<Badge variant="secondary">{t(\`statuses.${row.status}\`)}</Badge>` |
| `priority` | `t('fields.priority')` | yes | `cell` renders `<Badge variant="secondary">{t(\`priorities.${row.priority}\`)}</Badge>` |
| `created_at` | `t('fields.createdAt')` | yes | `useFormatters().date(row.created_at)` |

`caption={t('title')}`. `empty` prop distinguishes `noSearchResults` from `empty`/`emptyDescription`, same as `CustomerListPage`. `<Can permission="tickets.manage">` wraps the "New ticket" button. Import `Badge` from `@/shared/ui/primitives/badge`.

---

### 10 — The detail screen

**Create file: `frontend/src/features/tickets/components/TicketDetailPage.tsx`** — copy `CustomerProfilePage.tsx`'s structure: `useParams()` → `Number(id)`, guard `Number.isNaN`, `useTicket(id, { enabled: isValidId })` inside `QueryBoundary`, a `Card` showing:

- `subject` as the `CardTitle`.
- A `dl` grid: customer (`<Link to={\`/customers/${ticket.customer}\`}>{ticket.customer_name}</Link>` — a real cross-link, safe because it is a route path, not a cross-feature **import**), status (`Badge`, read-only — no control), priority (`Badge`), created/updated (`useFormatters().date`).
- `description` rendered as a `<p className="whitespace-pre-wrap">` below the grid (not inside a `dt`/`dd` pair — it can be long).
- `<Can permission="tickets.manage">` around Edit (link to `/tickets/${id}/edit`) and Delete (same `useConfirm()` + `useDeleteTicket()` + `navigate('/tickets')` shape as `CustomerProfilePage`).
- A back link to `/tickets`.

---

### 11 — The create/edit form

**Create file: `frontend/src/features/tickets/components/TicketFormPage.tsx`** — one component for both create and edit, following `CustomerFormPage.tsx`'s shape:

```tsx
const ticketSchema = z.object({
  subject: requiredString(200),
  description: requiredString(5000),
  // Kept as a string, not `positiveInt()` — Select's value/onValueChange are
  // string-typed (Radix), and RHF's field.value must match. Converted to a
  // number only in `toTicketInput`. See Story 12 `## Prerequisites`.
  customer: z.string().min(1),
  priority: choice(TICKET_PRIORITIES),
})

type FormValues = z.output<typeof ticketSchema>

function toTicketInput(values: FormValues): TicketInput {
  return {
    subject: values.subject,
    description: values.description,
    customer: Number(values.customer),
    priority: values.priority,
  }
}

function toDefaults(ticket: Ticket): FormValues {
  return {
    subject: ticket.subject,
    description: ticket.description,
    customer: String(ticket.customer),
    priority: ticket.priority,
  }
}
```

`description`'s `requiredString(5000)` cap is a **frontend-only** ceiling — `Ticket.description` is a plain `TextField()` with no `max_length` in the database. 5000 is a practical sanity bound, not a mirror of a backend constraint; document this in a comment so a future reader does not assume the two are meant to match.

Mode from the route: `/tickets/new` → create, `/tickets/:id/edit` → edit (same `idParam !== undefined` pattern as `CustomerFormPage`). In edit mode, load with `useTicket(id)` and render `<Loading />` until it resolves — `useAppForm`'s `defaultValues` are read once at mount.

Fields, in order: `TextField` (subject), `TextareaField` (description), `SelectField` (customer — options from `useCustomerOptions()`, mapped `{ value: String(c.id), label: c.name }`; render nothing / a disabled `SelectField` until the query resolves, since there is no `defaultValue` to select against an empty option list), `SelectField` (priority — options `TICKET_PRIORITIES.map((value) => ({ value, label: t(\`priorities.${value}\`) }))`).

Submit → `useCreateTicket()` / `useUpdateTicket(id)`; `onError` → `isValidationError(error)` → `applyServerErrors(form, error)`; `onSuccess` → toast `t('created')`/`t('updated')`, then `navigate` to the ticket detail page.

**No `status` field anywhere in this form** — see `## Story Goal`'s out-of-scope list. A created ticket is always `open` (the model's default); editing never touches it here.

---

### 12 — Routes and navigation

**File: `frontend/src/app/router.tsx`** — add a second `RequirePermission` block as a **sibling** of the existing `customers` one, inside the same `RequireAuth` element:

```tsx
          {
            element: <RequirePermission permission="tickets.view" />,
            children: [
              { path: 'tickets', lazy: /* TicketListPage */ },
              // Before `tickets/:id`, same reason as `customers/new`.
              { path: 'tickets/new', lazy: /* TicketFormPage */ },
              { path: 'tickets/:id', lazy: /* TicketDetailPage */ },
              { path: 'tickets/:id/edit', lazy: /* TicketFormPage */ },
            ],
          },
```

`tickets/new` **before** `tickets/:id`, same reasoning `customers/new` already documents.

**File: `frontend/src/app/RootLayout.tsx`** — `useTranslation(['common', 'customers', 'tickets'])`, and a second nav link beside the existing one:

```tsx
            <Can permission="tickets.view">
              <Button asChild variant="ghost" size="sm">
                <Link to="/tickets">{t('tickets:title')}</Link>
              </Button>
            </Can>
```

---

## Documentation Tasks

### 13 — Conventions and READMEs

**File: `CONVENTIONS.md`** — append to the end of `## 23. Feature module conventions` (after Story 11's two paragraphs):

1. **A `PROTECT` foreign key needs the shared exception handler to translate `ProtectedError`.** `apps/core/exceptions.py::_to_drf_exception` only translates the exception types it explicitly lists; a new `on_delete=PROTECT` relation is not automatically safe. Verify the referenced model's `destroy` endpoint against a row that is actually protected before shipping the new FK — `Ticket.customer` (Story 12, `TKT-1`) is the worked example, verified live against `accounts.Role`/`User.role`, the only precedent before it.
2. **Two features may independently call the same backend endpoint.** This is not the code duplication `frontend/src/README.md`'s "a feature never imports from another feature" rule targets — each feature's `api/` layer owns exactly the shape it needs (a full CRUD+search client in `customers`, a minimal id+name selector in `tickets`), and the alternative (importing across `features/`) is what `no-restricted-imports` forbids outright. `frontend/src/features/tickets/api/getCustomerOptions.ts` is the worked example.

**File: `frontend/src/README.md`** — append one sentence to `## A feature never imports from another feature` (after "...a design smell to fix, not to work around."):

> **Exception in spirit, not in mechanism:** two features may still each call the same *backend* endpoint independently, each with its own minimal local type — that is not the same thing as one feature importing another's frontend code, and is not a violation of this rule. See `frontend/src/features/tickets/api/getCustomerOptions.ts`.

No `.env.example` change, no new environment variable.

---

## Edge Cases & Failure Modes

- **Deleting a customer with tickets now fails cleanly instead of 500ing.** Verified live (see `## Prerequisites`): `ProtectedError` is not a `DjangoValidationError`, and was entirely unhandled before task 6. `DELETE /api/customers/<id>/` on a customer with at least one ticket now returns `validation_error` with `fields: {"non_field_errors": [...]}`, not `internal_error`. `## Verification Steps` checks both the protected and unprotected cases explicitly.
- **A second `DefaultRouter` would have silently shadowed part of `apps.customers.urls`'s root view.** Avoided by using `SimpleRouter` for tickets — see `## Prerequisites`. If a future story adds a third domain router, the same choice applies unless the existing customers root is deliberately retired.
- **No status-transition validation.** Any `status` value is accepted by a raw `PATCH /api/tickets/<id>/` — there is no illegal-transition error yet, because TKT-4 owns that. The UI never exposes a way to trigger this (no status field in the form), so it is reachable only via a hand-built request until TKT-4 lands.
- **`customer` on `Ticket` is reassignable, unlike `ContactDetail.customer` in Story 11.** No special `update()` override blocks it — a ticket's customer is a correctable fact (unlike a contact's ownership, which Story 11 pinned deliberately), and nothing currently depends on it being immutable. If a future story adds ticket history keyed by customer, this may need revisiting.
- **The customer selector lists up to 100 customers, unpaginated, with no search.** Verified consequence of `page_size=100` and no combobox primitive existing (same trade-off Story 11 accepted for a contact list, at a different scale — this list is every customer in the system, not one customer's contacts). Once the customer base exceeds 100, the selector silently omits the rest with no way to reach them from ticket creation. A future story adding a real combobox primitive to `shared/ui/primitives/` is the fix; not built here.
- **The customer options query is a separate, redundant fetch from the customers feature's own cache.** `useCustomerOptions` lives under `ticketKeys`, not `customerKeys` — deliberate, since `tickets` cannot import `customers`' query keys either (§ 15). Visiting the customer list and then opening the ticket form re-fetches the same underlying data under a different cache key. Accepted; documented in task 7 and task 13.
- **`description` has no backend length cap but a 5000-character frontend one.** A value between "very long" and the practical UI ceiling is rejected client-side with no server-side backstop at that exact boundary — acceptable, since the model itself imposes no limit and 5000 is a UX guard, not a data-integrity one.
- **Arabic rendering.** `status`/`priority` badges translate via `t(\`statuses.${value}\`)`/`t(\`priorities.${value}\`)`; `created_at` goes through `useFormatters().date` (Western digits, pinned per § 18); the customer link on the detail page carries the customer's `name`, which may itself contain a Latin run needing its own `dir="ltr"` wrap in the rare case a customer name is Latin-script inside an Arabic sentence — not specifically handled here, consistent with `CustomerProfilePage` not handling it for its own `customer.name` display either.
- **A role without `tickets.manage` sees the list and detail but not New/Edit/Delete.** `<Can permission="tickets.manage">` gates all three, matching the identical `customers.manage` gate pattern; the API enforces the same permission independently.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is added.

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass. `MigrationStateTests.test_no_pending_migrations` catches a `Ticket` shipped without its migration; `ApiCatchAllTests` is the guard on the new `SimpleRouter` not shadowing the catch-all.
2. `ruff format --check .` / `ruff check .` over the new Python, including `apps/core/exceptions.py`.
3. `npm run build` — typechecks `Ticket`/`TicketInput`/`CustomerOption`, every `ColumnDef<Ticket>`, the `useAppForm<typeof ticketSchema>` instantiation, and every new `t('tickets:…')` key through `CustomTypeOptions`.
4. `npm run lint` — in particular, confirms `getCustomerOptions.ts` does **not** trip `no-restricted-imports` (it imports only `@/shared/*` and its own feature's relative paths).
5. `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison for the new `tickets` namespace — `## Verification Steps`.
7. Real HTTP across three role accounts plus a real browser walkthrough in both languages, including the `ProtectedError` fix — `## Verification Steps`.

---

## Migration / Rollback

**Two migrations, both additive.** `tickets/0001_initial` creates one table; `tickets/0002_grant_ticket_permissions` updates three existing `Role` rows. **No change to any existing table's schema.** The `apps/core/exceptions.py` change (task 6) is a code-only change with no migration of its own.

**Rollback of the code:** revert the commits. **No `npm install`, no `pip install`** — `SimpleRouter` and `ProtectedError` are both already-installed.

**Rollback of the schema:**

```powershell
python manage.py migrate tickets zero
```

`0002`'s reverse removes only the two `tickets.*` strings via set difference; `0001`'s reverse drops the table. Both are clean because nothing references `Ticket` yet — the moment COMM-0 adds `Message.ticket`, dropping this table becomes `PROTECT`-blocked and the reverse needs the messages removed first (the same shape `Ticket.customer` itself now imposes on `Customer`).

**Half-applied states to avoid:**

- **Task 1's `PROTECT` FK without task 6's exception-handler fix.** The moment any ticket exists, `DELETE /api/customers/<id>/` for that customer 500s. Ship them together — this is the most important pairing in this story.
- **Task 2's permission constants without task 5's grant.** Every ticket endpoint returns 403 for every non-superuser; the UI hides everything, and it looks like a broken feature rather than an unfinished one.
- **Task 3's `TicketViewSet` with `DefaultRouter` instead of `SimpleRouter`.** `GET /api/` silently stops returning the customers router's root view (or returns tickets', depending on `include()` order) — a confusing, hard-to-notice regression. Use `SimpleRouter`, verified in `## Prerequisites`.
- **Task 11 before task 7/8** — every `t('tickets:…')` key and every `../api/`/`../types/` import fails to resolve; the build fails on the import, not the route.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Migrations apply forward, no reset:** `python manage.py migrate`; `python manage.py showmigrations tickets` shows `0001` and `0002` applied.
3. **The grant landed additively:**

   ```powershell
   python manage.py shell -c "from apps.accounts.models import Role; [print(r.slug, sorted(r.permissions)) for r in Role.objects.all()]"
   ```

   Every role holds its prior `customers.*` permissions **plus** the two new `tickets.*`.
4. **`en`/`ar` key sets match** for the new `tickets` namespace — reuse Story 10's Node one-liner against `frontend/src/features/tickets/locales/{en,ar}.json`. Both arrays empty.
5. **Backend regression:** `python manage.py test` reports **54** passing.
6. **Every action enforces its own permission**, using `admin@supportos.local`/`mgr@supportos.local`/`agent@supportos.local` (password `Sup3rSecret!`), same table shape as Story 10's Verification Step 7, applied to `/api/tickets/`.
7. **A ticket CRUD-round-trips.** `POST /api/tickets/` with `{"subject": "...", "description": "...", "customer": <id>, "priority": "high"}` → `201`, `status` comes back `"open"`. `PATCH` the same ticket's `subject`/`priority` → `200`, reflects the change. `DELETE` it → `204`.
8. **`customer_name` is populated and requires no extra query per row** — `GET /api/tickets/` with several tickets returns `customer_name` on every row; confirm `select_related("customer")` is present in `TicketViewSet.queryset` (code inspection, or `django-debug-toolbar`/query count if available — otherwise confirm by reading `views.py`).
9. **The `ProtectedError` fix, both directions:**
   - Create a customer with **no** tickets; `DELETE /api/customers/<id>/` → `204` (unchanged behaviour).
   - Create a customer, then a ticket referencing it; `DELETE /api/customers/<id>/` → `validation_error` with `fields: {"non_field_errors": [...]}`, **not** `internal_error`. Delete the ticket first, then the customer succeeds.
10. **Ordering and search behave per the declared fields.** `?ordering=subject`, `?ordering=-priority`, `?ordering=created_at` each change order; `?ordering=customer_name` is **ignored** (not in `ordering_fields`). `?search=` against a subject fragment, a description fragment, and a customer-name fragment each narrow the set.
11. **The full UI walkthrough, both languages.** `npm run dev` with the backend up, signed in as `agent@`:
    - `/tickets` lists rows; sortable headers work; the customer column shows a name, not an id.
    - "New ticket" opens the form; the customer `Select` is populated from every existing customer; submitting without a customer selected shows a validation error on that field, not a silent no-op.
    - Create a ticket; land on its detail page; the list shows it without a manual refresh.
    - Edit the ticket's subject/description/priority/customer; confirm the change on the detail page.
    - Delete a ticket via the confirm dialog; confirm it leaves the list.
    - Switch to Arabic: labels, status/priority badges, and dates all localise; RTL layout is correct.
    - Sign in as an account **without** `tickets.manage`: New/Edit/Delete are all absent, but the list and detail remain visible (has `tickets.view`).
12. **No hardcoded strings, no ad-hoc role checks, no forbidden cross-feature import.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\tickets\**\*.tsx -Pattern "'[A-Z][a-z]{3,}"
    Select-String -Path src\features\tickets\**\*.tsx,src\features\tickets\**\*.ts -Pattern "user\.role|is_staff|permissions\.includes"
    Select-String -Path src\features\tickets\**\*.tsx,src\features\tickets\**\*.ts -Pattern "@/features/customers"
    ```

    The first must return only non-user-facing hits; the second and third must return **nothing**.
13. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `tickets.Ticket` extends `TimeStampedModel` with `subject`, `description` (required), `customer` (**`ForeignKey(Customer, on_delete=PROTECT)`**), `status`/`priority` (`TextChoices` placeholders, defaults `open`/`medium`), `Meta.ordering = ("-created_at",)`.
- [ ] **No `Category`, no `assigned_agent`, no escalation fields, no activity log, no `Message` FK** — TKT-2/3/4/5/COMM-0 boundaries respected.
- [ ] `apps/tickets/migrations/0001_initial.py` and `0002_grant_ticket_permissions.py` committed; `manage.py test` reports no pending migrations.
- [ ] `Permissions` gains `TICKETS_VIEW`/`TICKETS_MANAGE`; grant migration is cross-app, set-union, depends on `("tickets", "0001_initial")` and `("accounts", "0003_seed_roles")`.
- [ ] `TicketSerializer` adds a read-only `customer_name`; `TicketViewSet` maps all six actions and uses `.select_related("customer")`.
- [ ] `apps/tickets/urls.py` uses **`SimpleRouter`**, not `DefaultRouter` — verified reasoning in `## Prerequisites`.
- [ ] `apps/core/exceptions.py` translates `ProtectedError` into a clean `validation_error`; verified against both a protected and an unprotected customer delete (Verification Step 9).
- [ ] `features/tickets/` contains `types/` (`ticket.ts`, `customerOption.ts`), `api/` (keys, five ticket call modules, two customer-option modules, `useTickets`, `useTicket`, `useTicketMutations`, `useCustomerOptions`), `components/` (list, detail, form), `locales/{en,ar}.json` registered in `resources.ts`.
- [ ] `getCustomerOptions.ts` calls `/customers/` directly and contains **zero** `@/features/customers` imports (Verification Step 12).
- [ ] The ticket form's `customer` field is a **string** in the schema/RHF layer, converted with `Number(...)` only in `toTicketInput` — no `positiveInt()` on a `Select`-backed field.
- [ ] **No `status` field anywhere in the create/edit form** — status is read-only (`Badge`) on list/detail, always `open` on create.
- [ ] The list uses `DataTable` + `useServerTable`, is not wrapped in `QueryBoundary`, and the `customer_name` column is **not** sortable.
- [ ] The detail page gates Edit/Delete behind `<Can permission="tickets.manage">`; Delete goes through `useConfirm()`.
- [ ] Routes nested inside `RequireAuth` → `RequirePermission permission="tickets.view"`, with `tickets/new` declared before `tickets/:id`; `RootLayout` gains a second nav link.
- [ ] `CONVENTIONS.md` § 23 gains the two new paragraphs (`ProtectedError` handling, cross-feature endpoint reuse); `frontend/src/README.md`'s "never imports from another feature" section gains the one-sentence exception.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] Verified by real HTTP: all four verbs × three permission states (Step 6); CRUD round-trip (Step 7); the `ProtectedError` fix in both directions (Step 9); ordering/search (Step 10).
- [ ] Both languages walk through cleanly (Step 11).
- [ ] `.squad/plans/ticket-management/00-overview.md` filled in and `.squad/plans/00-index.md` updated.

**STOP HERE. Report to the user and wait for confirmation.** This story unblocks **CUST-3 (Interaction History, SUPPORTOS-30)** partially — CUST-3 also needs `COMM-*` (a `Message` model), which is still unplanned. The next ready story in ticket-management is **TKT-2 (Categories & Priorities)** or **TKT-3 (Assignment)** — both depend only on this story; TKT-5 (Ticket History) is the natural predecessor for a reusable activity-log pattern other epics could reuse, if that ordering is preferred instead.
