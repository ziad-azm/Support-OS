# Story 87 — Multi-Department (Story: SUPPORTOS-112)

## Prerequisites

- **SEC-4 completed:** [../security-administration/53-story-system-configuration-SUPPORTOS-75.md](../security-administration/53-story-system-configuration-SUPPORTOS-75.md). It shipped `apps/organization/` end to end — the `OrganizationSettings` singleton (`backend/apps/organization/models.py:15-99`), `OrganizationSettingsSerializer`, `SettingsView` (`GET`/`PATCH /api/settings/`), `OrganizationSettingsAdmin`, `Permissions.SETTINGS_MANAGE` and its `admin`-only grant migration (`apps/organization/migrations/0002_grant_settings_permission.py`), plus the frontend `features/organization/` module and its `/settings` screen. **This story is the one that makes SEC-4's own forward note come true.** `OrganizationSettings`' docstring (lines 28-33) states the current design in its own words: *"`departments`/`branches` are `JSONField(default=list)` string lists, not separate `Department`/`Branch` tables… Nothing else in this codebase references an individual department or branch yet."* Tasks 1-3 replace the `departments` half of that with a real table; the `branches` JSON list is left **exactly as it is** for ORG-2 to do the same to.
- **TKT-2 completed:** [../ticket-management/18-story-ticket-categorization-priority-SUPPORTOS-38.md](../ticket-management/18-story-ticket-categorization-priority-SUPPORTOS-38.md). `Category` (`backend/apps/tickets/models.py:8-23`), `Ticket.category` (`:65-72`, the project's first nullable `SET_NULL` FK), `CategoryViewSet` (`backend/apps/tickets/views.py:28-49`), and the frontend `CategoryListPage`/`CategoryFormPage` pair are the **structural template** this story's `Department` copies, on both sides. Read that story before starting: nearly every shape below is already justified there.
- **TKT-3 completed:** [../ticket-management/22-story-ticket-assignment-SUPPORTOS-44.md](../ticket-management/22-story-ticket-assignment-SUPPORTOS-44.md). `Ticket.assigned_agent` (`:74-83`) and `apps/tickets/assignment.py` are read but **not modified** — see `## Story Goal`'s scope boundary on auto-assignment.
- **SEC-1 completed:** [../security-administration/48-story-users-roles-admin-SUPPORTOS-72.md](../security-administration/48-story-users-roles-admin-SUPPORTOS-72.md). `UserViewSet` (`backend/apps/accounts/views.py:154-272`), `UserAdminSerializer` (`backend/apps/accounts/serializers.py:106-168`), `UserListPage.tsx`/`UserFormPage.tsx`. Tasks 8-10 and 23 extend all four; none of their existing behaviour changes.
- **RPT-1 completed:** [../reports-analytics/56-story-ticket-volume-reports-SUPPORTOS-97.md](../reports-analytics/56-story-ticket-volume-reports-SUPPORTOS-97.md). `DIMENSION_FIELDS`/`parse_dimension` (`backend/apps/reports/tickets.py:35-62`) and `BaseReportView` (`backend/apps/reports/views.py:41-60`) are what task 14 extends with a fifth dimension and a scope filter.
- Verified: **`departments` has no consumer anywhere except the settings screen itself.** `grep -rn "department" backend/apps frontend/src` returns hits in exactly four places — `apps/organization/{models,serializers}.py`, `apps/organization/migrations/000{1,2}`, `features/organization/{components/SettingsPage.tsx,types/settings.ts,locales/*.json}`. No ticket, user, report, or portal code reads it. Dropping the JSON field (task 3) therefore breaks nothing beyond the four files tasks 3 and 22 already edit.
- Verified: **this project has no `django-filter`.** `grep -rn "DjangoFilterBackend\|filterset_fields" backend/` returns nothing; `DEFAULT_FILTER_BACKENDS` (`backend/config/settings/base.py:249-259`) is `OrderingFilter` + `SearchFilter` only. Every domain filter today is hand-parsed in `get_queryset` — `TicketViewSet.get_queryset` (`backend/apps/tickets/views.py:102-141`) parses `?category=`, `?priority=`, `?status=`, `?assigned_to_me=` by hand, each raising a DRF `ValidationError` on a present-but-malformed value. Task 5's `apps/core/scoping.py` is the **generalization of that existing hand-parsed shape**, not a new dependency (CONVENTIONS.md §0/§17).
- Verified: **no migration-graph cycle.** `apps/organization/migrations/0002_grant_settings_permission.py` depends on `("accounts", "0003_seed_roles")`; tasks 8 and 11 add `accounts/0013` and `tickets/0008` depending on `("organization", "0003_department")`. `0003 > 0002` and `0013 > 0003`, so the graph stays acyclic. At the *model* level there is no import either way: `User.department`/`Ticket.department` use the string reference `"organization.Department"`, and `apps/organization/models.py` imports nothing from `accounts` or `tickets`.
- Verified: **`no-restricted-imports` forbids `features/accounts` and `features/tickets` from importing `features/organization`** (`frontend/.oxlintrc.json` lines 8-18; the only overrides are `**/app/**` and `shared/i18n/resources.ts`). Three features need the same department options list, so it goes in `src/shared/departments/` (task 16) — the resolution §15 names explicitly (*"Move shared code to src/shared/"*), following `src/shared/auth/`'s own precedent as a shared domain folder with types, a query key, and a fetcher.
- Verified: `Permissions` (`backend/apps/core/permissions.py:18-42`) has **no** department constant today, and `ALL_PERMISSIONS` (`:45-49`) is derived by reflection over that class — adding two constants automatically makes them grantable through SEC-2's role editor with no second edit.

---

## Story Goal

Turn "department" from a free-text string in a JSON blob into a first-class row that agents and tickets point at, and ship the one reusable filter mechanism ORG-2's `Branch` will reuse verbatim.

1. **`Department` is a table.** `apps.organization.Department` (`name` unique, optional `description`) replaces `OrganizationSettings.departments`, with a data migration that promotes every existing string in that list into a row so no configured department is lost.
2. **Agents and tickets link to it.** `accounts.User.department` and `tickets.Ticket.department` — both nullable `SET_NULL` FKs, both surfaced read-and-write on their existing admin/serializer/form paths. **Nullable, not required**: every row that exists today has no department, and a required column would need a fabricated default for all of them.
3. **One scoping mechanism, not three.** `apps/core/scoping.py` defines `ScopeFilter`, `apply_scope_filters()`, and `ScopedQuerysetMixin`. `TicketViewSet`, `UserViewSet`, and the RPT-1 report views all consume that one module. ORG-2 adds `ScopeFilter(param="branch", field="branch")` to the same tuples and writes no new filter code.
4. **Scoped queues and reports.** A department filter on the ticket list, a new `/tickets/department` queue showing the caller's own department's tickets, a `department` column on the users list, and a fifth `department` dimension plus a `?department=` filter on the RPT-1 volume/breakdown reports.
5. **A management screen.** `/settings/departments` — list, create, rename, delete — gated by two new permissions (`departments.view`, `departments.manage`), granted `admin`→both, `manager`/`agent`→view.

### Explicitly not in scope

- **Auto-assignment does not become department-aware.** `apps/tickets/assignment.py::assignable_agents`, `apps/sla/tasks.py::auto_assign_ticket`, and `AssignmentRule` are read but **not modified**. The intake says "linking agents/tickets", not "route by department"; making `AssignmentRule` department-matching is a change to SLA-2's rule engine, with its own `Strategy`/round-robin semantics to re-decide, and belongs in its own story.
- **Only the two RPT-1 reports gain `?department=`.** `SlaTrendReportView`, `SlaBreachRateReportView`, `AgentPerformanceReportView`, both CSAT views, and `DashboardKpiReportView` keep exactly today's behaviour. Their querysets live in four other modules (`apps/reports/{sla,agents,dashboard}.py`, and CSAT reaches a ticket through `Feedback.ticket`), and each needs its own traversal — that is this story's *pattern* applied five more times, not new mechanism. Recorded as a follow-up in the feature overview.
- **`OrganizationSettings.branches` is untouched.** It stays a `JSONField` string list, still validated by `_validate_string_list`, still edited by `SettingsPage`'s `StringListField`. ORG-2 promotes it, reusing tasks 1-3 as its own template.
- **No `Customer.department`.** The intake links *agents and tickets*. ORG-2's intake is the one that says "associating users/customers/tickets".

---

## Context — Read These Files First

1. `backend/apps/organization/models.py:1-99` — whole file. `_validate_string_list` (8-12), the `OrganizationSettings` docstring's own "not separate `Department`/`Branch` tables" note (28-33), `departments` (42) and `branches` (43), `clean()` (63-84, where line 71 is the `departments` check task 3 deletes and line 72 the `branches` check that stays), the singleton `save`/`delete`/`load` (86-99, untouched).
2. `backend/apps/tickets/models.py:8-23` — `Category`. Task 1's `Department` copies this shape verbatim: `name = CharField(max_length=100, unique=True)`, `Meta.ordering = ("name",)`, `__str__` returning the name.
3. `backend/apps/tickets/models.py:60-83` — `Ticket.category` (65-72) and `Ticket.assigned_agent` (74-83), including their long comments justifying `SET_NULL` over `PROTECT`/`CASCADE`. Task 11's `Ticket.department` is the same call for the same reason; quote the reasoning, do not re-derive it.
4. `backend/apps/tickets/views.py:51-141` — `TicketViewSet`. `permission_map` (57-82), `ordering_fields`/`search_fields` (89-90, and the comment at 84-88 on why joined display columns are absent), and above all `get_queryset` (102-141): four hand-parsed optional filters, each 400ing on a present-but-malformed value. Task 5 generalizes this; task 13 makes this viewset the first consumer.
5. `backend/apps/core/views.py:12-62` — `BaseModelViewSet` (12-31) and `CustomerScopedModelViewSet` (34-62). The latter is the **existing** scoping base and its docstring calls itself *"the mechanism the intake's 'scoping rule… reused by all portal stories' refers to"*. Task 5's module is the second, query-param-driven half of the same idea — read `customer_field` (55) and `get_queryset` (57-62) before writing it, and keep the two distinct: `CustomerScopedModelViewSet` scopes by **who is calling**, `ScopedQuerysetMixin` scopes by **what the caller asked for**.
6. `backend/apps/core/permissions.py:18-49` — the `Permissions` class and the reflective `ALL_PERMISSIONS`. Task 4 adds two constants here; nothing else is needed to make them grantable.
7. `backend/apps/organization/migrations/0002_grant_settings_permission.py:1-40` — the exact grant/revoke-by-set-union migration shape task 4 copies, including its `dependencies` on `("accounts", "0003_seed_roles")`.
8. `backend/apps/accounts/migrations/0003_seed_roles.py:9-31` — the three seeded role slugs (`admin`, `manager`, `agent`) task 4's `GRANTS` dict keys on.
9. `backend/apps/organization/serializers.py:9-61` — `OrganizationSettingsSerializer`. `Meta.fields` (19-29, line 23 is the `"departments"` entry task 3 removes), `_validate_string_list` (31-36, kept), `validate_departments` (38-39, removed), `validate_branches` (41-42, kept).
10. `backend/apps/organization/views.py:11-32` and `backend/apps/organization/urls.py:1-9` — `SettingsView` (unchanged) and the plain `path()`-only urlconf task 6 converts into `router.urls + [path("settings/", …)]`.
11. `backend/apps/tickets/urls.py:1-19` — the **`SimpleRouter`, not `DefaultRouter`** rule and the comment explaining it (`apps.customers.urls` already owns the API-root view at the same prefix). Task 6's router must be a `SimpleRouter` for exactly this reason.
12. `backend/apps/accounts/serializers.py:83-103` — `UserSerializer` (`/auth/me/`), especially the nested `role = RoleSerializer(read_only=True)` at 88 and `Meta.fields` at 94. `RoleSerializer` itself is at 22-27 — a **narrow, two-field, read-only mirror** distinct from `RoleAdminSerializer`. Task 9's `DepartmentBriefSerializer` copies that precedent exactly.
13. `backend/apps/accounts/serializers.py:106-168` — `UserAdminSerializer`. `role_name` (128) and its comment on the dotted-source + `allow_null=True` pattern, `Meta.fields` (132-144), `read_only_fields` (145), and `create()` (147-168, **unchanged** — `department` is an ordinary writable field and needs no special handling there).
14. `backend/apps/accounts/views.py:154-216` — `UserViewSet`. It has **no `queryset` class attribute** and its `get_queryset` (190-199) does not call `super()` — task 10 changes both, and that is the one non-obvious edit in this story. Read the `customer_profile__isnull=True` staff-only filter's comment carefully; it must survive verbatim.
15. `backend/apps/tickets/serializers.py:14-74` — `TicketSerializer`. `category`/`category_name` (20-26) is the exact pair task 12 clones, `immutable_fields` (43) is **not** extended (a ticket may be moved between departments — that is the point), and `read_only_fields` (69-74) is unchanged.
16. `backend/apps/reports/tickets.py:28-62` — `DIRECT_CHANNEL`, `DIMENSION_FIELDS` (35-40), and `parse_dimension` (43-62). Task 14 adds one key to the dict; `parse_dimension` needs no edit — it validates against the dict's keys.
17. `backend/apps/reports/views.py:41-135` — `BaseReportView` (41-60) and the two RPT-1 views (62-135). Note that each `get_report` builds its **own** `Ticket.objects…` queryset — that is where task 14's scope filter goes, not in the base.
18. `frontend/src/features/tickets/components/CategoryListPage.tsx:1-103` and `CategoryFormPage.tsx:1-125` — full files. Tasks 18 and 19 are these two, with `category`→`department` and one extra optional `description` field. Copy them; do not invent a new list/form shape.
19. `frontend/src/features/tickets/api/useCategories.ts`, `getCategories.ts`, `useCategoryList.ts`, `getCategoryList.ts`, `useCategoryMutations.ts`, `ticketKeys.ts` — the six-file API shape tasks 16 and 17 split across `shared/departments/` and `features/organization/api/`. `getCategories.ts`'s `page_size: 100, ordering: 'name'` options-fetch comment applies verbatim to `getDepartments.ts`.
20. `frontend/src/features/tickets/components/TicketListPage.tsx:44-131` — the `'all'` sentinel `Select` filters, the `useEffect` that resets to page 1 on any filter change (63-66), and the `...(categoryFilter !== 'all' ? { category: categoryFilter } : {})` spread (70-76). Task 26 adds a third `Select` in the same shape.
21. `frontend/src/features/tickets/components/MyTicketsPage.tsx:1-152` — full file. Task 27's `DepartmentQueuePage` is this file with `assigned_to_me: 'true'` swapped for `department: String(user.department.id)` and a no-department empty state.
22. `frontend/src/features/accounts/components/UserFormPage.tsx:26-58` — `ROLE_NONE` (29) and `useRoleOptions` (46-54). Task 23's department select copies both, including the "Radix `Select.Item` requires a non-empty value" reason.
23. `frontend/src/shared/auth/types.ts:1-30` — `AuthRole`/`AuthUser`. Task 29 adds `AuthDepartment` and one field, mirroring task 9's serializer change.
24. `frontend/src/app/router.tsx` — the `RequirePermission` route groups, especially the `settings.manage` group (~478-546) where task 20's three routes go, and the `tickets.view` group (~148-200) where task 27's queue route goes (before `tickets/:id`, same reason as `tickets/my-tickets`).
25. `frontend/src/app/Sidebar.tsx:120-127` (`showAdministration`) and the Administration `NavSection` below it — task 21. Also the Support `NavSection` (the `/tickets` + `/tickets/my-tickets` block) for task 27's queue link.
26. `frontend/src/features/organization/components/SettingsPage.tsx:1-230` — the `schema` (23-48), `toDefaults` (51-59), and the `StringListField` (72-135) plus its two `FormField` call sites (~190-215). Task 22 removes the `departments` third of this and leaves `branches` untouched.
27. `frontend/src/features/reports/types/report.ts:20-27` and `components/TicketReportsPage.tsx:71-100` — `REPORT_DIMENSIONS` and `labelForDimensionValue`. Task 28 adds `'department'` to both.
28. `CONVENTIONS.md` §15 (238-249, the import boundary that forces task 16 into `shared/`), §22 (787-902, the permission vocabulary/mapping split task 4 obeys), §23 (903-1030, the feature-module template and the "a feature story grants its own permissions" rule), and §32 (2143-2194, the last existing section — task 15 appends §33 after it).

---

## Product rules (from story)

| Rule | Current behaviour | New behaviour | Enforcement point |
|---|---|---|---|
| **A department is a record, not a string.** | `OrganizationSettings.departments: list[str]`, editable only as free text on `/settings`. | `organization.Department` rows with a unique name, full CRUD at `/api/departments/`. | Tasks 1-3, 6. The JSON column is **removed**, not left as a shadow copy — two sources of truth for the same list is the bug this story exists to prevent. |
| **Agents belong to a department.** | Nothing links a `User` to a department. | `User.department` (nullable FK), settable on the SEC-1 user form, shown as a column on the users list, exposed on `/auth/me/`. | Tasks 8-10, 23, 29. |
| **Tickets belong to a department.** | Nothing links a `Ticket` to a department. | `Ticket.department` (nullable FK), settable on the ticket create/edit form, shown on the list, filterable. | Tasks 11-13, 25-26. |
| **One filter mechanism, reused.** | Four hand-rolled `if param:` blocks inside `TicketViewSet.get_queryset`. | `apps/core/scoping.py` — declared as data (`scope_filters = (ScopeFilter(param="department", field="department"),)`), applied by one shared function. | Task 5. ORG-2 adds one tuple entry per viewset and writes no parsing code. |
| **`?department=none` means "unassigned", not "invalid".** | n/a | `?department=<id>` filters by id; `?department=none` filters `department__isnull=True`; anything else is a **400**, never a silently-unfiltered list. | `apply_scope_filters` (task 5), matching `TicketViewSet`'s existing `?assigned_to_me=` contract (`views.py:130-139`) exactly. |
| **Reading the department list is not an admin privilege; changing it is.** | `settings.manage` (admin only) gates the whole settings blob. | `departments.view` → `admin`, `manager`, `agent` (an agent must be able to populate the ticket form's picker). `departments.manage` → `admin` only. | Task 4's grant migration. `settings.manage` is **not** reused — an agent filling in a ticket's department must not thereby be able to rewrite the org's SLA defaults. |
| **Deleting a department must not delete its tickets or its agents.** | n/a | `on_delete=SET_NULL` on both FKs — the ticket becomes department-less, the agent becomes department-less, nothing cascades and nothing is blocked. | Tasks 8, 11. Same call, same reasoning, as `Ticket.category` (`models.py:60-64`). |
| **A ticket can change department after creation.** | n/a | `department` is an ordinary writable serializer field — deliberately **not** added to `TicketSerializer.immutable_fields`. | Task 12. Contrast `customer` (43), which is immutable because changing it moves the ticket's whole history into another customer's portal visibility; a department carries no such row-level visibility today. |
| **The backend enforces this even if the frontend is bypassed.** | — | Every `?department=` value is parsed and validated server-side; the frontend's `'all'` sentinel and hidden buttons are UX only. | `apply_scope_filters`, `DepartmentViewSet.permission_map`. |

---

## Backend Tasks

### 1 — The `Department` model

**File: `backend/apps/organization/models.py`** — add below `_validate_string_list` and **above** `OrganizationSettings` (so the file reads structure-first):

```python
class Department(TimeStampedModel):
    """A functional unit — ORG-1. Agents (`accounts.User.department`) and
    tickets (`tickets.Ticket.department`) point at one; both FKs are
    nullable `SET_NULL`, so deleting a department leaves both intact and
    merely unassigned.

    Replaces `OrganizationSettings.departments`, the `JSONField` string
    list SEC-4 shipped as a deliberate placeholder — that field's own
    docstring named the condition for promoting it: "Nothing else in this
    codebase references an individual department or branch yet." This
    story is the story that makes something reference one.

    Shaped exactly like `tickets.Category` (apps/tickets/models.py:8-23):
    a unique name, alphabetical default ordering, `__str__` returning the
    name. `description` is the one addition — a department is an org-chart
    unit an admin may need to annotate ("Tier 2 escalations, EMEA hours"),
    which `Role.description` (apps/accounts/models.py:55) already
    establishes the shape for.

    `OrganizationSettings.branches` is deliberately NOT promoted here —
    ORG-2 does that, reusing this model and this story's migrations as its
    template.
    """

    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.CharField(_("description"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("department")
        verbose_name_plural = _("departments")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name
```

**Generate the migration — this run must produce `CreateModel` ONLY.** Do not touch `OrganizationSettings.departments` yet; task 3 removes it in a separate, later migration so the data migration in task 2 can still read the column.

```powershell
cd backend
python manage.py makemigrations organization
```

Expect exactly one file: `apps/organization/migrations/0003_department.py`, one `CreateModel` operation, `dependencies = [("organization", "0002_grant_settings_permission")]`.

---

### 2 — Data migration: promote every configured department string into a row

**Create file: `backend/apps/organization/migrations/0004_migrate_settings_departments.py`** (hand-written, not generated):

```python
from django.db import migrations


def promote(apps, schema_editor):
    """Every distinct, non-blank string in the one `OrganizationSettings`
    row's `departments` list becomes a `Department` row.

    `get_or_create` on `name`, not `bulk_create`: the JSON list has no
    uniqueness guarantee (`_validate_string_list` only checks "non-empty
    string"), so a settings blob containing "Support" twice must produce
    one row, not an IntegrityError that aborts the whole migration.

    `.first()`, not `OrganizationSettings.load()`: a historical model has
    no custom manager or classmethod, and on a database where the settings
    row was never created there is simply nothing to promote.
    """
    OrganizationSettings = apps.get_model("organization", "OrganizationSettings")
    Department = apps.get_model("organization", "Department")
    settings_row = OrganizationSettings.objects.first()
    if settings_row is None:
        return
    for raw in settings_row.departments or []:
        name = (raw or "").strip()
        if name:
            Department.objects.get_or_create(name=name)


def demote(apps, schema_editor):
    """Writes the rows back into the JSON list so `0003_department`'s own
    reverse (`DeleteModel`) does not lose an admin's configuration.

    Django unapplies in reverse dependency order, so `0005`'s RemoveField
    is reversed — re-adding the `departments` column, empty — BEFORE this
    runs. That is what makes writing the column here possible at all. See
    `## Migration / Rollback`.
    """
    OrganizationSettings = apps.get_model("organization", "OrganizationSettings")
    Department = apps.get_model("organization", "Department")
    settings_row = OrganizationSettings.objects.first()
    if settings_row is None:
        return
    settings_row.departments = list(
        Department.objects.order_by("name").values_list("name", flat=True)
    )
    settings_row.save(update_fields=["departments", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [("organization", "0003_department")]

    operations = [migrations.RunPython(promote, demote)]
```

---

### 3 — Drop `OrganizationSettings.departments`

**File: `backend/apps/organization/models.py`:**

- Delete the `departments` field (line 42).
- Delete line 71 (`_validate_string_list(self.departments, "departments")`) from `clean()`. **Leave line 72's `branches` check.**
- Rewrite the docstring paragraph at lines 28-33 to:

```
    `branches` is a `JSONField(default=list)` string list, not a separate
    `Branch` table — the same "a list of strings that doesn't need its own
    table today" call `Role.permissions` (apps/accounts/models.py:56) made,
    and the same call this model made for `departments` until ORG-1
    (Story 87) promoted that half to the real `Department` model above.
    ORG-2 does the same to `branches`.
```

**File: `backend/apps/organization/serializers.py`:**

- Remove `"departments",` from `Meta.fields` (line 23).
- Remove `validate_departments` (lines 38-39). **Keep** `_validate_string_list` (31-36) and `validate_branches` (41-42).
- Update the class docstring's `validate_departments`/`validate_branches` reference to name only `validate_branches`.

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations organization
```

Expect `apps/organization/migrations/0005_remove_organizationsettings_departments.py`, one `RemoveField`. **Confirm its `dependencies` name `0004_migrate_settings_departments`** — if Django picked `0003` instead, the data migration could be ordered after the column drop on a fresh deploy and every configured department would be silently lost. Add the dependency by hand if it is absent.

---

### 4 — Two permission constants and their grant migration

**File: `backend/apps/core/permissions.py`** — add to `Permissions` (18-42), after `SETTINGS_MANAGE` (37):

```python
    SETTINGS_MANAGE = "settings.manage"
    DEPARTMENTS_VIEW = "departments.view"
    DEPARTMENTS_MANAGE = "departments.manage"
```

`ALL_PERMISSIONS` (45-49) picks both up by reflection — **no second edit**, and SEC-2's role editor offers them immediately.

**Create file: `backend/apps/organization/migrations/0006_grant_department_permissions.py`** — copy `0002_grant_settings_permission.py` verbatim, changing only the header comment, `GRANTS`, and `dependencies`:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# Split, unlike SETTINGS_MANAGE's admin-only grant: reading the department
# list is what populates the ticket form's picker and the ticket list's
# filter, so an agent needs it. Changing the list is org configuration and
# stays with `admin`, alongside ROLES_MANAGE/SETTINGS_MANAGE. Reusing
# SETTINGS_MANAGE for the read would have handed every agent the power to
# rewrite the org's SLA defaults. See the plan's `## Product rules`.
GRANTS = {
    "admin": [Permissions.DEPARTMENTS_VIEW, Permissions.DEPARTMENTS_MANAGE],
    "manager": [Permissions.DEPARTMENTS_VIEW],
    "agent": [Permissions.DEPARTMENTS_VIEW],
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
        ("organization", "0005_remove_organizationsettings_departments"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

Set union, never assignment — so it never wipes a grant another story made, and re-running is safe (§23).

---

### 5 — `apps/core/scoping.py`: the reusable scoping/filter mechanism

This is the 🔑 deliverable the intake marks as *"reused by branch + reports"*. Keep it **generic over a field name** — nothing in it may mention "department".

**Create file: `backend/apps/core/scoping.py`:**

```python
"""Query-param scoping — ORG-1's reusable filter mechanism.

The second scoping primitive in this codebase, and deliberately NOT a
replacement for the first. `CustomerScopedModelViewSet` (`.views`) scopes
by WHO IS CALLING: a portal customer sees their own rows, always, with no
way to ask for anyone else's. This module scopes by WHAT THE CALLER ASKED
FOR: an optional `?<param>=` narrowing an already-authorized list. Neither
is a security boundary the other can stand in for.

Generalizes the four hand-parsed filters already inside
`TicketViewSet.get_queryset` (apps/tickets/views.py:102-141) — same
contract, one implementation:

* absent or empty  -> no filtering at all (a list must still work unfiltered)
* a numeric id     -> `filter(<field>_id=<id>)`
* the literal
  `"none"`         -> `filter(<field>__isnull=True)` — rows with no scope
* anything else    -> DRF `ValidationError` (400). NEVER a silent no-op:
                      a typo'd filter that quietly returns everything is
                      the harder bug to find.

ORG-2's `Branch` adds `ScopeFilter(param="branch", field="branch")` to a
viewset's `scope_filters` and writes no parsing code of its own. Adding a
`__contains`/date/enum scope later means adding a field to `ScopeFilter`,
not a second module.
"""

from dataclasses import dataclass

from django.db.models import QuerySet
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

# The sentinel for "rows with no value in this scope". A string, not an
# empty param: `?department=` (empty) already means "no filter" above, and
# the two must not collide. Mirrors the frontend's own `'all'`/`'none'`
# Select sentinels (CONVENTIONS.md §19), which exist for the same
# "Radix Select.Item cannot have an empty value" reason.
UNSCOPED = "none"


@dataclass(frozen=True)
class ScopeFilter:
    """`param` is the query-string key; `field` is the FK's attribute name
    on the model (NOT `<field>_id` — the `_id`/`__isnull` suffixes are
    appended here so a declaration reads like the model field it names).
    """

    param: str
    field: str


def apply_scope_filters(queryset: QuerySet, query_params, scopes) -> QuerySet:
    """Applies every scope in `scopes` that the caller actually sent.

    A plain function, not a method, so the report views — plain `APIView`s
    with no queryset of their own until `get_report` builds one — can reuse
    it without inheriting anything. `ScopedQuerysetMixin` below is a thin
    wrapper for the viewset case.
    """
    for scope in scopes:
        raw = query_params.get(scope.param)
        if not raw:
            continue
        if raw == UNSCOPED:
            queryset = queryset.filter(**{f"{scope.field}__isnull": True})
            continue
        try:
            value = int(raw)
        except (TypeError, ValueError):
            raise ValidationError(
                {scope.param: [_('Must be a numeric id or "%(none)s".') % {"none": UNSCOPED}]}
            ) from None
        queryset = queryset.filter(**{f"{scope.field}_id": value})
    return queryset


class ScopedQuerysetMixin:
    """Mix in BEFORE `BaseModelViewSet` in the bases list, so this
    `get_queryset` runs first and a subclass's own override reaches it
    through `super()`:

        class TicketViewSet(ScopedQuerysetMixin, BaseModelViewSet):
            scope_filters = (ScopeFilter(param="department", field="department"),)

    The viewset must also have a real `queryset` class attribute —
    `ModelViewSet.get_queryset`, which `super()` eventually reaches,
    asserts on it.

    Only `list` is scoped by default. A detail route must NOT be — a 404
    that depends on a query param the client did not intend as a scope is
    an unpleasant surprise, and `retrieve` on an authorized row is not a
    listing question. Override `scoped_actions` to widen it deliberately.

    Declares NO `permission_map` — per `HasPermission`'s grant-on-omission
    rule (`apps/core/permissions.py:80-90`), every subclass must still
    declare its own, exactly as `CustomerScopedModelViewSet` already
    documents for its own subclasses.
    """

    scope_filters: tuple[ScopeFilter, ...] = ()
    scoped_actions: tuple[str, ...] = ("list",)

    def get_queryset(self):
        queryset = super().get_queryset()
        if getattr(self, "action", None) not in self.scoped_actions:
            return queryset
        return apply_scope_filters(queryset, self.request.query_params, self.scope_filters)
```

---

### 6 — `DepartmentSerializer`, `DepartmentViewSet`, and the router

**File: `backend/apps/organization/serializers.py`** — add above `OrganizationSettingsSerializer`, and extend the import to `from .models import Department, OrganizationSettings`:

```python
class DepartmentSerializer(BaseModelSerializer):
    """CRUD over `Department` — ORG-1's management screen. Shaped exactly
    like `CategorySerializer` (apps/tickets/serializers.py:7-11): the model
    field's own `unique=True` is what DRF derives the uniqueness validator
    from, so no hand-declared `UniqueValidator` is needed here (contrast
    `CustomerSerializer.email`, which overrides the generated field and
    therefore must declare one — apps/customers/serializers.py:36-43).
    """

    class Meta(BaseModelSerializer.Meta):
        model = Department
        fields = ("id", "name", "description", "created_at", "updated_at")
```

**File: `backend/apps/organization/views.py`** — add above `SettingsView`; extend the imports with `from apps.core.views import BaseModelViewSet`, `from .models import Department, OrganizationSettings`, and `from .serializers import DepartmentSerializer, OrganizationSettingsSerializer`:

```python
class DepartmentViewSet(BaseModelViewSet):
    """Department CRUD — ORG-1. The first `ModelViewSet` in this app
    (`SettingsView` is a singleton `APIView`), so the first place
    `apps.organization` needs a router at all — see `urls.py`.

    Two permissions, not one: `departments.view` reaches every staff role
    because the ticket form's picker and the ticket list's filter both need
    the list; `departments.manage` is admin-only. See migration
    `0006_grant_department_permissions`.
    """

    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    permission_map = {
        "list": Permissions.DEPARTMENTS_VIEW,
        "retrieve": Permissions.DEPARTMENTS_VIEW,
        "create": Permissions.DEPARTMENTS_MANAGE,
        "update": Permissions.DEPARTMENTS_MANAGE,
        "partial_update": Permissions.DEPARTMENTS_MANAGE,
        "destroy": Permissions.DEPARTMENTS_MANAGE,
    }

    # Each name must match a `ColumnDef.id` on `DepartmentListPage` (§23).
    ordering_fields = ("name", "created_at")
    search_fields = ("name", "description")
```

**File: `backend/apps/organization/urls.py`** — replace the whole file:

```python
from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import DepartmentViewSet, SettingsView

app_name = "organization"

# SimpleRouter, not DefaultRouter: `apps.customers.urls` already mounts a
# DefaultRouter at the same `path("")` prefix in config/api_urls.py and its
# auto-generated API-root view already claims `/api/`. The same rule
# `apps/tickets/urls.py:7-12` records.
router = SimpleRouter()
router.register("departments", DepartmentViewSet, basename="department")

urlpatterns = router.urls + [
    path("settings/", SettingsView.as_view(), name="settings"),
]
```

**No change to `backend/config/api_urls.py`** — `path("", include("apps.organization.urls"))` (line 14) already mounts this app, so `/api/departments/` appears with no edit there.

---

### 7 — Django admin

**File: `backend/apps/organization/admin.py`** — add above `OrganizationSettingsAdmin`; extend the import to `from .models import Department, OrganizationSettings`:

```python
@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    """Ordinary `ModelAdmin` — unlike `OrganizationSettingsAdmin` below,
    `Department` is a normal multi-row model. Coexists with
    `DepartmentViewSet`/`/settings/departments` the same way
    `RoleAdmin`/`UserAdmin` coexist with SEC-1's frontend: a manual
    fallback, not the primary path.
    """

    list_display = ("name", "description", "created_at")
    search_fields = ("name", "description")
    readonly_fields = ("created_at", "updated_at")
```

---

### 8 — `User.department`

**File: `backend/apps/accounts/models.py`** — add to `User` (89-133) immediately after the `role` FK (105-112):

```python
    # SET_NULL, not PROTECT: contrast `role` directly above, where deleting
    # a role people still hold must fail loudly because it silently strips
    # access. A department is an org-chart label — deleting one should
    # leave every agent's account and permissions untouched, just
    # unassigned. Same call, same reasoning, as `Ticket.category`
    # (apps/tickets/models.py:60-64). Nullable because every account that
    # exists today has no department and a required column would need a
    # fabricated default for all of them. String reference, not an import:
    # `apps.organization` must stay free of any `accounts` dependency so
    # the migration graph has no cycle (ORG-1 `## Prerequisites`).
    department = models.ForeignKey(
        "organization.Department",
        verbose_name=_("department"),
        related_name="users",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations accounts
```

Expect `apps/accounts/migrations/0013_user_department.py` (next after `0012_alter_auditlog_action.py`), one `AddField`, with `("organization", "0003_department")` in its `dependencies`. **If that dependency is absent, add it by hand** — without it, a fresh `migrate` can order `accounts/0013` before the `Department` table exists.

**File: `backend/apps/accounts/admin.py`** — add `"department"` to `UserAdmin.list_display` and to the fieldset that already contains `role`. If the class already declares `list_select_related`, add `"department"` there too; do not introduce the attribute if it is absent.

---

### 9 — `department` on both user serializers

**File: `backend/apps/accounts/serializers.py`:**

Add `from apps.organization.models import Department` to the first-party imports (ruff's isort keeps `apps.*` grouped), then add beside `RoleSerializer` (22-27):

```python
class DepartmentBriefSerializer(serializers.ModelSerializer):
    """The `/auth/me/` shape of a department — id and name only.

    A narrow, read-only mirror distinct from
    `apps.organization.serializers.DepartmentSerializer` (which carries
    `description` and the timestamps for the management screen), exactly
    as `RoleSerializer` above is distinct from `RoleAdminSerializer`. The
    session payload should carry the caller's department, not a record of
    it.
    """

    class Meta:
        model = Department
        fields = ("id", "name")
```

In `UserSerializer` (83-103) — add the nested field beside `role` (88) and extend `Meta.fields`/`read_only_fields` (94-95):

```python
    role = RoleSerializer(read_only=True)
    department = DepartmentBriefSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_staff",
            "role",
            "department",
            "permissions",
        )
        read_only_fields = ("id", "is_staff", "role", "department", "permissions")
```

Read-only here for the same reason `role` is: `/auth/me/` reports the session, it does not edit it. `MeView` (`apps/accounts/views.py:144-151`) needs no change.

In `UserAdminSerializer` (106-168) — add the display field beside `role_name` (128) and two entries to `Meta.fields` (132-144):

```python
    role_name = serializers.CharField(source="role.name", read_only=True, allow_null=True)
    # Same dotted-source + `allow_null=True` pattern as `role_name` above —
    # `allow_null` is what makes this return `None` instead of erroring when
    # the user has no department. `department` itself needs no explicit
    # declaration: DRF derives `required=False, allow_null=True` from the
    # model FK's own `null=True, blank=True`.
    department_name = serializers.CharField(
        source="department.name", read_only=True, allow_null=True
    )
```

`fields` becomes `(… "role", "role_name", "department", "department_name", "date_joined", "last_login")`. **`read_only_fields` (145) is unchanged** — `department` is writable, which is the whole point. **`create()` (147-168) is unchanged** — `department` arrives in `validated_data` and `create_user(**extra_fields)` sets it like any other field.

---

### 10 — `UserViewSet` gains the scoping mixin

**File: `backend/apps/accounts/views.py`** — this class has **no `queryset` attribute** and its `get_queryset` does not call `super()`. Both must change, or `ScopedQuerysetMixin.get_queryset`'s `super().get_queryset()` never runs.

Change the class statement (154) and add a `queryset` attribute beside `serializer_class` (176):

```python
class UserViewSet(ScopedQuerysetMixin, BaseModelViewSet):
    ...
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    # Now a real class attribute (SEC-1 had none): `ScopedQuerysetMixin`
    # reaches the base implementation through `super().get_queryset()`,
    # and `ModelViewSet.get_queryset` asserts without one.
    queryset = User.objects.select_related("role", "department")
    serializer_class = UserAdminSerializer

    scope_filters = (ScopeFilter(param="department", field="department"),)
```

Rewrite `get_queryset` (190-199), **keeping its existing docstring/comment verbatim** and changing only the return statement:

```python
    def get_queryset(self):
        # Staff identities only. ... (existing comment, unchanged)
        return super().get_queryset().filter(customer_profile__isnull=True)
```

Add to the imports: `from apps.core.scoping import ScopeFilter, ScopedQuerysetMixin`.

`ordering_fields` (187) is **unchanged** — `department_name` is a joined display column, exactly like `role_name`, which is likewise absent.

---

### 11 — `Ticket.department`

**File: `backend/apps/tickets/models.py`** — add to `Ticket` immediately after `assigned_agent` (74-83) and before `status` (84):

```python
    # SET_NULL, nullable — the same call `category` (lines 60-72) and
    # `assigned_agent` (74-83) above already make, for the same reason:
    # deleting a department must neither delete its tickets (CASCADE) nor
    # block the deletion (PROTECT); the ticket simply becomes
    # department-less. Unlike `assigned_agent` this is NOT action-only: it
    # is written through `TicketSerializer` on ordinary create/update,
    # because moving a ticket between departments is routine triage, not a
    # privileged state change. String reference, not an import — see
    # `accounts.User.department`.
    department = models.ForeignKey(
        "organization.Department",
        verbose_name=_("department"),
        related_name="tickets",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations tickets
```

Expect `apps/tickets/migrations/0008_ticket_department.py` (next after `0007_feedback.py`), one `AddField`, with `("organization", "0003_department")` in `dependencies` — **add it by hand if absent**, same reason as task 8.

**File: `backend/apps/tickets/admin.py`** — add `"department"` to `TicketAdmin.list_display`, and to `list_filter` if that attribute already exists on the class.

---

### 12 — `TicketSerializer` department fields

**File: `backend/apps/tickets/serializers.py`** — add beside `category_name` (26):

```python
    # Same verified dotted-source + `allow_null=True` pattern as
    # `category_name` above. `department` itself needs no declaration —
    # DRF derives `required=False, allow_null=True` from the model field.
    department_name = serializers.CharField(
        source="department.name", read_only=True, allow_null=True
    )
```

Add `"department",` and `"department_name",` to `Meta.fields` (47-68), immediately after `"category_name"`.

**`immutable_fields` (43) stays `("customer",)`** — a ticket may be re-routed to a different department; that is the feature. **`read_only_fields` (69-74) is unchanged.**

---

### 13 — `TicketViewSet` gains the scoping mixin

**File: `backend/apps/tickets/views.py`:**

- Import: `from apps.core.scoping import ScopeFilter, ScopedQuerysetMixin`.
- Class statement (51): `class TicketViewSet(ScopedQuerysetMixin, BaseModelViewSet):`
- `queryset` (54): add `"department"` → `Ticket.objects.select_related("customer", "category", "assigned_agent", "department").all()`.
- Add beside `search_fields` (90):

```python
    # ORG-1's reusable scoping declaration. ORG-2 appends
    # `ScopeFilter(param="branch", field="branch")` here and writes no
    # parsing code. `?department=none` lists tickets with no department;
    # see `apps/core/scoping.py`.
    scope_filters = (ScopeFilter(param="department", field="department"),)
```

- `get_queryset` (102-141): **no body change at all.** Its first line already reads `queryset = super().get_queryset()`, which now reaches the mixin, which applies the scope only on `list` — the same action its own `if self.action != "list": return queryset` guard (103-104) covers. Add one comment line above that guard noting the department filter is applied by the mixin, not here.
- `ordering_fields` (89): unchanged. `department_name` is a joined display column, exactly like `category_name`/`assigned_agent_name`.

---

### 14 — Reports: a fifth dimension and a `?department=` scope

**File: `backend/apps/reports/tickets.py`:**

Add to `DIMENSION_FIELDS` (35-40):

```python
DIMENSION_FIELDS = {
    "status": "status",
    "priority": "priority",
    "category": "category__name",
    "channel": ORIGIN_CHANNEL_FIELD,
    "department": "department__name",
}
```

`parse_dimension` (43-62) needs **no edit** — it validates against this dict's keys and builds its error message from them.

Add below `DIMENSION_FIELDS`:

```python
# The scopes both RPT-1 endpoints honour. A tuple, not a bare call, so
# ORG-2 adds `ScopeFilter(param="branch", field="branch")` here once and
# both reports pick it up. Applied via the shared
# `apps.core.scoping.apply_scope_filters` — the reports are plain
# `APIView`s, so they use the function rather than `ScopedQuerysetMixin`.
TICKET_SCOPES = (ScopeFilter(param="department", field="department"),)


def scoped_tickets(query_params, queryset=None) -> QuerySet:
    """`queryset` (default: every ticket) narrowed by whatever scope params
    the caller sent. Malformed values raise DRF `ValidationError` -> 400,
    the same contract `parse_dimension`/`parse_bucket` already use.
    """
    if queryset is None:
        queryset = Ticket.objects.all()
    return apply_scope_filters(queryset, query_params, TICKET_SCOPES)
```

Imports to add: `from apps.core.scoping import ScopeFilter, apply_scope_filters` and `from apps.tickets.models import Ticket` (this module currently imports only `apps.communications.models.Message`).

**File: `backend/apps/reports/views.py`:**

- Import `scoped_tickets` alongside the existing `from .tickets import DIMENSION_FIELDS, DIRECT_CHANNEL, parse_dimension, with_origin_channel`.
- `TicketVolumeReportView.get_report` (80-107): replace `queryset = Ticket.objects.all()` (line 82) with `queryset = scoped_tickets(request.query_params)`.
- `TicketBreakdownReportView.get_report` (124-135): replace `queryset = Ticket.objects.filter(created_at__gte=start, created_at__lt=end)` (line 126) with:

```python
        queryset = scoped_tickets(
            request.query_params,
            Ticket.objects.filter(created_at__gte=start, created_at__lt=end),
        )
```

- `csv_columns` on both views are **unchanged** — the department appears as a `series`/`key` value when it is the chosen dimension, and a scope filter narrows rows rather than adding a column. `?export=csv` picks the filter up automatically because it runs the same `get_report`.
- The other six report views are **unchanged** — see `## Story Goal`'s scope boundary.

---

### 15 — `CONVENTIONS.md` §33

**File: `CONVENTIONS.md`** — append after §32 (which ends at line 2194). Do **not** renumber §0-§32. The section body, with its inner fenced example, is:

````markdown
---

## 33. Organizational scoping (ORG-1)

Two scoping primitives exist, and they answer different questions:

| Module | Scopes by | Caller can opt out? | Use for |
|---|---|---|---|
| `apps.core.views.CustomerScopedModelViewSet` | **who is calling** (`request.user.customer_profile`) | No — it is a security boundary | Every portal-facing viewset |
| `apps.core.scoping` | **what the caller asked for** (`?<param>=`) | Yes — absent means no filter | Staff-facing list narrowing, reports |

Never reach for the second where the first is meant. A `?department=`
filter is a convenience; it authorizes nothing.

**Declaring a scope.** A viewset lists its scopes as data and inherits the
parsing:

```python
class TicketViewSet(ScopedQuerysetMixin, BaseModelViewSet):
    queryset = Ticket.objects.all()
    scope_filters = (ScopeFilter(param="department", field="department"),)
```

`ScopedQuerysetMixin` must come **before** `BaseModelViewSet` in the bases,
and the viewset must have a real `queryset` class attribute (its own
`get_queryset` override, if any, reaches the mixin through `super()`).
Only `list` is scoped; widen with `scoped_actions` deliberately.

A plain `APIView` (every `BaseReportView` subclass) calls
`apply_scope_filters(queryset, request.query_params, SCOPES)` directly
instead of inheriting anything.

**The param contract**, identical everywhere: absent/empty means no
filter; a numeric id filters by that id; the literal `"none"` filters for
rows with no value; anything else is a **400**. A malformed filter is
never a silently-unfiltered list.

**`Department` replaced `OrganizationSettings.departments`.** SEC-4 shipped
departments and branches as `JSONField` string lists, explicitly as a
placeholder until something referenced an individual one. ORG-1 promoted
the departments half to `organization.Department` with a data migration
(`0004_migrate_settings_departments`) and dropped the column. **`branches`
is still a JSON list** — ORG-2 promotes it the same way, and until it does,
no code may add a second consumer of that column.

**Frontend:** department options live in `src/shared/departments/`, not in
a feature — three features need the same list and `no-restricted-imports`
(§15) forbids reaching across features for it. `features/organization/`
owns only the management screens and the write path.
````

---

## Frontend Tasks

### 16 — `src/shared/departments/`: the cross-feature options source

**Create file: `frontend/src/shared/departments/types.ts`:**

```ts
/** Mirrors `apps.organization.serializers.DepartmentSerializer`'s read
 * shape. Lives in `shared/`, not `features/organization/`, because
 * `features/tickets`, `features/accounts`, and `features/reports` all need
 * it and `no-restricted-imports` forbids a cross-feature import
 * (CONVENTIONS.md §15/§33). */
export type Department = {
  id: number
  name: string
  description: string
  created_at: string
  updated_at: string
}
```

**Create file: `frontend/src/shared/departments/departmentKeys.ts`:**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

/** Shared so `features/organization`'s mutation hooks can invalidate the
 * very same prefix the pickers in other features read from. */
export const departmentKeys = featureKey('departments')
```

**Create file: `frontend/src/shared/departments/getDepartments.ts`:**

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Department } from './types'

// page_size: 100 (the server's max) — no search-as-you-type combobox
// exists yet, the same simplification `getCategories.ts` accepted.
export function getDepartments(): Promise<Page<Department>> {
  return api.getPage<Department>('/departments/', { params: { page_size: 100, ordering: 'name' } })
}
```

**Create file: `frontend/src/shared/departments/useDepartments.ts`:**

```ts
import { useQuery } from '@tanstack/react-query'

import { departmentKeys } from './departmentKeys'
import { getDepartments } from './getDepartments'

/** The picker/filter options query. Every consumer shares one cache
 * entry, and every write in `features/organization` invalidates it. */
export function useDepartments() {
  return useQuery({
    queryKey: departmentKeys.resource('options'),
    queryFn: getDepartments,
  })
}
```

**Create file: `frontend/src/shared/departments/index.ts`:**

```ts
export { departmentKeys } from './departmentKeys'
export { getDepartments } from './getDepartments'
export { useDepartments } from './useDepartments'
export type { Department } from './types'
```

---

### 17 — `features/organization` department API layer

**Create file: `frontend/src/features/organization/types/department.ts`:**

```ts
import type { Department } from '@/shared/departments'

export type { Department }

/** The write shape — no `id`/`created_at`/`updated_at`, all
 * server-managed. `description` is always sent (`''` to clear), never
 * omitted (CONVENTIONS.md §23, "PATCH for edits"). */
export type DepartmentInput = {
  name: string
  description: string
}
```

**Create these files under `frontend/src/features/organization/api/`**, each a one-call file copied in shape from its `features/tickets/api/` category twin:

- `getDepartmentList.ts` — `export type DepartmentListParams = ServerTableParams & { search?: string }`; `api.getPage<Department>('/departments/', { params })`.
- `useDepartmentList.ts` — `useQuery({ queryKey: departmentKeys.resource('list', params), queryFn: () => getDepartmentList(params) })`.
- `getDepartment.ts` — ``api.get<Department>(`/departments/${id}/`)``.
- `useDepartment.ts` — `useQuery({ queryKey: departmentKeys.resource('detail', id), queryFn: …, enabled })`, matching `useCategory.ts`'s `enabled` option shape.
- `createDepartment.ts` / `updateDepartment.ts` / `deleteDepartment.ts` — `api.post` / `api.patch` / `api.delete`.
- `useDepartmentMutations.ts` — `useCreateDepartment` / `useUpdateDepartment(id)` / `useDeleteDepartment`, all sharing one `useInvalidateDepartments()` helper that invalidates the bare `departmentKeys.all` prefix. Copy `useCategoryMutations.ts` including its comment: invalidating the bare prefix refreshes the admin list, any open detail query, **and** the `useDepartments()` picker in the other three features, in one call.

`departmentKeys` is imported from `@/shared/departments` in all of these — do **not** declare a second key factory here, or the pickers will not refresh after an edit.

---

### 18 — `DepartmentListPage`

**Create file: `frontend/src/features/organization/components/DepartmentListPage.tsx`** — `CategoryListPage.tsx` with `category`→`department`, `useTranslation('organization')`, links to `/settings/departments/…`, and one extra column between `name` and `created_at`:

```tsx
    {
      id: 'description',
      header: t('departments.fields.description'),
      // Not sortable: absent from `DepartmentViewSet.ordering_fields`, the
      // same rule every secondary column in this codebase follows.
      cell: (row) => row.description,
      priority: 'sm',
    },
```

Wrap the "New department" `<Button asChild>` and the `DeleteRowButton` column's content in `<Can permission="departments.manage">` — the list route is reachable on `departments.view`, which `manager`/`agent` hold, and neither may write.

---

### 19 — `DepartmentFormPage`

**Create file: `frontend/src/features/organization/components/DepartmentFormPage.tsx`** — `CategoryFormPage.tsx` verbatim, plus a second field:

```ts
const schema = z.object({
  name: requiredString(100),
  description: optionalString(255).transform((value) => value ?? ''),
})
```

`.transform(… ?? '')` because `description` is `blank=True` and **not** nullable — a cleared field must round-trip as `''`, not `null` (CONVENTIONS.md §23's `optionalString`/`nullableString` table). Navigate to `/settings/departments` on success; `useTranslation('organization')`.

---

### 20 — Routes

**File: `frontend/src/app/router.tsx`** — add two new sibling groups immediately after the existing `<RequirePermission permission="settings.manage" />` group (departments have their own permission, so they do not belong inside it):

```tsx
          {
            element: <RequirePermission permission="departments.view" />,
            children: [
              {
                path: 'settings/departments',
                lazy: async () => {
                  const { DepartmentListPage } =
                    await import('@/features/organization/components/DepartmentListPage')
                  return { element: <DepartmentListPage /> }
                },
              },
            ],
          },
          {
            // Split from the `departments.view` list route above for the
            // same reason `users/new` is split from `users`: create/edit
            // are writes the server gates on `departments.manage`, so a
            // view-only holder must not be routed to a guaranteed dead end.
            element: <RequirePermission permission="departments.manage" />,
            children: [
              {
                // Must stay before `settings/departments/:id/edit`, the
                // same declaration order `roles/new` uses.
                path: 'settings/departments/new',
                lazy: async () => {
                  const { DepartmentFormPage } =
                    await import('@/features/organization/components/DepartmentFormPage')
                  return { element: <DepartmentFormPage /> }
                },
              },
              {
                path: 'settings/departments/:id/edit',
                lazy: async () => {
                  const { DepartmentFormPage } =
                    await import('@/features/organization/components/DepartmentFormPage')
                  return { element: <DepartmentFormPage /> }
                },
              },
            ],
          },
```

Task 27's queue route goes in the `tickets.view` group, **before** `tickets/:id`:

```tsx
              {
                // Must stay before `tickets/:id`, same reason as
                // `tickets/my-tickets`.
                path: 'tickets/department',
                lazy: async () => {
                  const { DepartmentQueuePage } =
                    await import('@/features/tickets/components/DepartmentQueuePage')
                  return { element: <DepartmentQueuePage /> }
                },
              },
```

---

### 21 — Sidebar

**File: `frontend/src/app/Sidebar.tsx`:**

- Import `Building2Icon` from `lucide-react`, keeping the import list alphabetical (between `BookOpenIcon` and `ChevronsLeftIcon`).
- `showAdministration` (121-127): add `can('departments.view') ||`.
- Inside the Administration `NavSection`, after the `settings.manage` link:

```tsx
            <Can permission="departments.view">
              <SidebarLink
                to="/settings/departments"
                icon={Building2Icon}
                label={t('organization:departments.title')}
                collapsed={collapsed}
              />
            </Can>
```

- Inside the Support `NavSection`, after the `/tickets/my-tickets` link and **inside the same `<Can permission="tickets.view">`**, add task 27's queue link — only when the caller actually has a department, since the page has nothing to show otherwise:

```tsx
            {user?.department ? (
              <SidebarLink
                to="/tickets/department"
                icon={Building2Icon}
                label={t('tickets:departmentQueue.title')}
                collapsed={collapsed}
              />
            ) : null}
```

`user` is already destructured from `useAuth()` at line 122.

---

### 22 — Drop departments from the settings screen

**File: `frontend/src/features/organization/types/settings.ts`** — remove `departments: string[]` from **both** `OrganizationSettings` (line 7) and `SettingsInput` (line 19).

**File: `frontend/src/features/organization/components/SettingsPage.tsx`:**

- Remove `departments: z.array(z.string()),` from `schema` (26).
- Remove `departments: settings.departments,` from `toDefaults` (54).
- Remove the `<FormField name="departments" …>` block (~lines 190-205) and its `StringListField`. **Keep** the `branches` block and the whole `StringListField` component — it now has one consumer instead of two, which is still a consumer.
- `StringListField`'s docstring names `SettingsPage` as its single consumer; that stays true. Drop only wording implying two fields.

**Locale files:** `settings.fields.departments` and `settings.addDepartment` move out of `settings` into the new `departments` object (task 30). Do not leave orphaned keys under `settings`.

---

### 23 — Department on the users admin screen

**File: `frontend/src/features/accounts/types/user.ts`:**

- `AdminUser`: add `department: number | null` and `department_name: string | null` after `role_name`.
- `UserCreateInput`: add `department: number | null`. (`UserUpdateInput` extends it, so both write paths get it.)

**File: `frontend/src/features/accounts/components/UserFormPage.tsx`:**

- `import { useDepartments } from '@/shared/departments'`.
- Add `const DEPARTMENT_NONE = 'none'` beside `ROLE_NONE` (29), with the same "Radix `Select.Item` requires a non-empty value" comment.
- `baseShape` (31-36): add `department: z.string()`.
- Add a `useDepartmentOptions(noDepartmentLabel: string)` helper mirroring `useRoleOptions` (46-54), backed by `useDepartments()`.
- Both forms: default `department: DEPARTMENT_NONE` on create, `user.department === null ? DEPARTMENT_NONE : String(user.department)` on edit; `onSubmit` maps `values.department === DEPARTMENT_NONE ? null : Number(values.department)`.
- Render a `<SelectField … name="department" label={t('users.fields.department')} options={departmentOptions} />` immediately after the role `SelectField`.

**File: `frontend/src/features/accounts/components/UserListPage.tsx`** — add a column after `role_name` (73):

```tsx
    {
      id: 'department_name',
      header: t('users.fields.department'),
      // Not sortable: a joined display column absent from
      // `UserViewSet.ordering_fields`, exactly like `role_name` above.
      cell: (row) => row.department_name ?? t('users.noDepartment'),
      priority: 'sm',
    },
```

---

### 24 — Ticket types and list params

**File: `frontend/src/features/tickets/types/ticket.ts`:**

- `Ticket`: add `department: number | null` and `department_name: string | null` after `category_name`.
- `TicketInput`: add `department: number | null`, with a comment noting the form always sends the key explicitly (`null` to clear), never omits it.

**File: `frontend/src/features/tickets/api/getTickets.ts`** — extend `TicketListParams` with `department?: string` (a string, because the value carries either an id or the literal `'none'`).

---

### 25 — Department on the ticket form

**File: `frontend/src/features/tickets/components/TicketFormPage.tsx`** — copy the existing `category` wiring exactly: a `DEPARTMENT_NONE = 'none'` sentinel beside `CATEGORY_NONE` (29), `department: z.string().min(1)` in the schema (beside line 43), the `defaultValues`/`toDefaults`/`toTicketInput` mappings (53, 62, 72), a `departmentOptions` array built from `useDepartments()` (mirroring `categoryOptions` at 146-150), and a `<SelectField name="department" label={t('fields.department')} options={[{ value: DEPARTMENT_NONE, label: t('fields.noDepartment') }, ...departmentOptions]} />` placed after the category field (~176).

---

### 26 — Department filter and column on the ticket list

**File: `frontend/src/features/tickets/components/TicketListPage.tsx`:**

- `import { useDepartments } from '@/shared/departments'`; `const departmentsQuery = useDepartments()`.
- `const [departmentFilter, setDepartmentFilter] = useState('all')` beside the category/priority filters (54-57).
- Add `departmentFilter` to the page-reset `useEffect`'s dependency array (63-66).
- Add to the `useTickets` params spread (70-76): `...(departmentFilter !== 'all' ? { department: departmentFilter } : {})`.
- Add a third `<Select>` to the filter row with three kinds of item: `all` ("All departments"), one per department, and `none` ("No department") — the `none` value maps straight onto the backend's `UNSCOPED` sentinel, so only the label needs translating, never the value.
- Add a `department_name` column after `category_name` (88-97), not sortable, falling back to `t('fields.noDepartment')`.

---

### 27 — The department queue

**Create file: `frontend/src/features/tickets/components/DepartmentQueuePage.tsx`** — `MyTicketsPage.tsx` with three changes:

- `const { user } = useAuth()` (`@/shared/auth`), and the ticket query sends `department: String(user.department.id)` instead of `assigned_to_me: 'true'`.
- The query is disabled and an `<Empty title={t('departmentQueue.noDepartment')} description={…} />` renders when `user?.department` is nullish — an agent with no department has no queue, and firing `?department=undefined` would list every ticket.
- An `assigned_agent_name` column (copied from `TicketListPage`) is **added**, because unlike "my tickets" these rows belong to other people.

Keep the status/priority `Select`s, the page-reset `useEffect`, and the `PageHeader` shape identical.

---

### 28 — Reports: the department dimension and filter

**File: `frontend/src/features/reports/types/report.ts`** — extend the array (26):

```ts
export const REPORT_DIMENSIONS = ['status', 'priority', 'category', 'channel', 'department'] as const
```

**File: `frontend/src/features/reports/api/getTicketVolume.ts`** and **`getTicketBreakdown.ts`** — add `department?: string` to both param types. Both already forward the whole params object to `api.get`, and `exportReport` receives the same object, so the CSV export picks the filter up with no further edit.

**File: `frontend/src/features/reports/components/TicketReportsPage.tsx`:**

- `import { useDepartments } from '@/shared/departments'`; `const [department, setDepartment] = useState('all')`.
- Spread `...(department !== 'all' ? { department } : {})` into both `volumeParams` and the breakdown params, so the chart, the table, and the CSV all read the same filter.
- Add a department `<Select>` beside the existing bucket/series/dimension selects, with `all` / one per department / `none`.
- `labelForDimensionValue` (76-83): the `department` case falls through to the existing `return key` branch (a department name is user data, not a translatable key). Extend that branch's comment to say `category`/`department` rather than just `category`.

---

### 29 — `AuthUser.department`

**File: `frontend/src/shared/auth/types.ts`** — add above `AuthUser`:

```ts
/** Mirrors `apps.accounts.serializers.DepartmentBriefSerializer`. */
export type AuthDepartment = {
  id: number
  name: string
}
```

and inside `AuthUser`, after `role`:

```ts
  /** The caller's own department, or `null`. Drives `/tickets/department`
   * and the sidebar link to it. Read-only — changing a user's department
   * goes through `PATCH /api/users/<id>/` (SEC-1's screen), never here. */
  department: AuthDepartment | null
```

No change to `AuthProvider.tsx` — it stores whatever `/auth/me/` returns.

---

### 30 — Locale keys (`en` + `ar`, both files, identical key sets)

**`frontend/src/features/organization/locales/en.json` and `ar.json`** — remove `settings.fields.departments` and `settings.addDepartment`; add a sibling `departments` object beside `settings`, shaped exactly like `tickets`' own `categories` object:

| Key | en | ar |
|---|---|---|
| `departments.title` | "Departments" | "الأقسام" |
| `departments.new` | "New department" | "قسم جديد" |
| `departments.edit` | "Edit department" | "تعديل القسم" |
| `departments.empty` | "No departments yet" | "لا توجد أقسام بعد" |
| `departments.emptyDescription` | "Create a department to organize agents and tickets by function." | "أنشئ قسمًا لتنظيم الوكلاء والتذاكر حسب الوظيفة." |
| `departments.noSearchResults` | "No departments match your search" | "لا توجد أقسام مطابقة لبحثك" |
| `departments.search` / `departments.searchPlaceholder` | "Search departments" / "Search by name" | "البحث في الأقسام" / "البحث بالاسم" |
| `departments.created` / `departments.updated` | "Department created." / "Department updated." | "تم إنشاء القسم." / "تم تحديث القسم." |
| `departments.fields.name` / `.description` / `.createdAt` / `.actions` | "Name" / "Description" / "Created" / "Actions" | "الاسم" / "الوصف" / "تاريخ الإنشاء" / "الإجراءات" |
| `departments.actions.save` / `.delete` | "Save" / "Delete" | "حفظ" / "حذف" |
| `departments.delete.title` / `.description` | "Delete department?" / "Tickets and agents in this department keep their records; they simply become unassigned." | "حذف القسم؟" / "تحتفظ التذاكر والوكلاء في هذا القسم بسجلاتهم؛ سيصبحون فقط غير معيّنين." |

**`frontend/src/features/tickets/locales/en.json` and `ar.json`** — add `fields.department` ("Department" / "القسم"), `fields.noDepartment` ("No department" / "بدون قسم"), `filters.department` ("Department" / "القسم"), `filters.allDepartments` ("All departments" / "كل الأقسام"), and a `departmentQueue` object: `title` ("Department queue" / "قائمة القسم"), `empty`/`emptyDescription`, and `noDepartment` ("You are not in a department" / "لست ضمن أي قسم") plus its description.

**`frontend/src/features/accounts/locales/en.json` and `ar.json`** — add `users.fields.department` ("Department" / "القسم") and `users.noDepartment` ("No department" / "بدون قسم").

**`frontend/src/features/reports/locales/en.json` and `ar.json`** — add `dimensions.department` ("Department" / "القسم") to whatever object already holds the other four dimension labels, plus `filters.department` / `filters.allDepartments`.

`frontend/src/shared/i18n/resources.ts` needs **no change** — every namespace touched here is already registered.

---

## Edge Cases & Failure Modes

- **The settings row has never been created.** `OrganizationSettings.objects.first()` returns `None` in task 2's `promote`, which returns early. Nothing to promote, no crash. Verified: `load()` (`models.py:96-99`) is `get_or_create(pk=1)`, so on a database where nobody ever opened `/settings`, the row genuinely does not exist.
- **The `departments` JSON list contains duplicates or blanks.** `_validate_string_list` only ever enforced "non-empty string", never uniqueness. Task 2 uses `get_or_create(name=…)` on a `.strip()`ed value and skips empties — two `"Support"` entries produce one row, not an `IntegrityError` that aborts the whole migration.
- **A department name collides on rename.** `Department.name` is `unique=True`; DRF derives the validator from the model field, so `PATCH /api/departments/<id>/` with a taken name is a **400 with a field error**, which `applyServerErrors` (`DepartmentFormPage`) renders on the `name` input. Not a 500.
- **A department is deleted while tickets and agents point at it.** Both FKs are `SET_NULL`, so the delete succeeds, every affected row's `department_id` becomes `NULL`, and both lists render the `noDepartment` fallback. Nothing cascades; nothing 409s. Enforced at `apps/accounts/models.py` (task 8) and `apps/tickets/models.py` (task 11).
- **A department is deleted while someone has it selected as a list filter.** The next request sends `?department=<gone id>`, which is a valid integer, so `apply_scope_filters` filters on it and returns an **empty page** — not a 400 and not an unfiltered list. The `Select` falls back to rendering the raw id because `useDepartments()` no longer returns it; the user re-picks. Deliberate: validating the id's existence would cost an extra query on every list request to improve a transient case.
- **`?department=` sent empty (`/api/tickets/?department=`).** `if not raw: continue` — treated as "no filter", identical to omitting it. This is why `UNSCOPED` is the string `"none"` and not an empty value.
- **`?department=abc`.** `int()` raises, `apply_scope_filters` raises DRF `ValidationError` → **400** with `{"department": ["Must be a numeric id or \"none\"."]}`. The existing `?category=abc` behaviour (`apps/tickets/views.py:113-117`) verbatim.
- **`?department=` on a detail route (`/api/tickets/5/?department=9`).** Ignored — `ScopedQuerysetMixin` scopes only when `self.action` is in `scoped_actions` (`("list",)`). A detail fetch must not 404 because of a stray query param.
- **`UserViewSet` loses its staff-only filter.** The single most dangerous mistake in this story: task 10 rewrites `get_queryset` to call `super()`, and dropping `.filter(customer_profile__isnull=True)` in that rewrite would surface every portal customer's `User` row in the staff Users admin. Verify explicitly (Verification Step 8) by checking the list against a customer known to have portal access.
- **`ScopedQuerysetMixin` placed after `BaseModelViewSet` in the bases.** Python's MRO would then put `ModelViewSet.get_queryset` first and the mixin would never run — the filter silently does nothing and every `?department=` returns unfiltered results. **There is no error to see.** Verify by asserting a filtered list actually shrinks (Verification Steps 6 and 8).
- **`UserViewSet` without a `queryset` class attribute.** `ModelViewSet.get_queryset` asserts `self.queryset is not None` the first time any user list is requested — a hard 500 on `/api/users/`, not a subtle bug. Task 10 adds the attribute; Verification Step 8 catches it immediately if missed.
- **Migration 0005 ordered before 0004.** If Django's autodetector names `0003_department` as `0005`'s only dependency, a fresh `migrate` on an existing database can drop the `departments` column before `promote` reads it, silently losing every configured department. Task 3 requires checking the generated `dependencies` by hand.
- **`accounts/0013` or `tickets/0008` missing the `organization` dependency.** On a **fresh** database `migrate` can then try to add an FK to a table that does not exist yet — `ProgrammingError: relation "organization_department" does not exist`. Loud, but only on a fresh database, so it will not show up on a developer machine that already ran `0003`. Verification Step 3 runs a from-scratch migrate specifically to catch this.
- **An agent with no department opens `/tickets/department`.** `user.department` is `null`; task 27 renders an empty state and never fires the query. The sidebar link is hidden for the same account, so this is reachable only by typing the URL.
- **A `manager` or `agent` opens `/settings/departments`.** They hold `departments.view`, so `RequirePermission` lets them in and the list renders; the "New department" button and every row's Delete button are hidden by `<Can permission="departments.manage">`, and the server rejects the writes regardless (`DepartmentViewSet.permission_map`).
- **`?series=department` or `?dimension=department` on a report whose tickets have no department.** `grouped_counts`/`bucketed_counts` are already called with `include_null=True` / `null_label=str(_("Uncategorized"))` for every non-channel dimension (`apps/reports/views.py:103, 133`), so department-less tickets group under "Uncategorized" rather than vanishing. No code change needed — but confirm the label reads acceptably on a department axis (Verification Step 10).
- **RTL.** Every new screen composes existing primitives (`DataTable`, `Select`, `SelectField`, `PageHeader`, `Empty`, `Badge`) that are already RTL-clean. `npm run check:rtl` is the gate — no `ml-`/`mr-`/`left-`/`right-` in any new file.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` from `backend/` — the existing suite must still pass. `MigrationStateTests.test_no_pending_migrations` is what catches any of tasks 1, 3, 8, or 11 shipping a model change without its migration.
2. `ruff format --check .` and `ruff check .` from `backend/` — covers the new `apps/core/scoping.py`, all four new `organization` migrations, and every edited module (including the isort ordering of the new `apps.organization` import inside `apps/accounts/serializers.py`).
3. `npm run build` from `frontend/` — typechecks the new `shared/departments/` module, the two new organization screens, `DepartmentQueuePage`, the `Ticket`/`AdminUser`/`AuthUser`/`OrganizationSettings` type changes (in particular, **removing** `departments` from `OrganizationSettings` makes any surviving reference a compile error), and every new `t(...)` key.
4. `npm run lint` — `no-restricted-imports` is what proves task 16's `shared/departments/` placement was necessary: an accidental `@/features/organization/...` import from `features/tickets` fails here.
5. `npm run format:check` and `npm run check:rtl`.
6. The `en`/`ar` key-set comparison (the script introduced by `../customer-management/10-story-customer-profiles-SUPPORTOS-28.md` Verification Step 4), run against `frontend/src/features/organization/locales/{en,ar}.json`, then `features/tickets`, `features/accounts`, and `features/reports` — four namespaces this time.
7. Real HTTP and a real browser across the migrate → create → assign → filter → report chain — Verification Steps 2-12 below.

---

## Migration / Rollback

**Forward, in order:** `organization/0003_department` → `organization/0004_migrate_settings_departments` → `organization/0005_remove_organizationsettings_departments` → `organization/0006_grant_department_permissions`, with `accounts/0013_user_department` and `tickets/0008_ticket_department` slotting in after `0003`.

```powershell
cd backend
python manage.py migrate
```

**Before running it on any database with real settings data,** record what is about to be promoted so the result can be checked:

```powershell
python manage.py shell -c "from apps.organization.models import OrganizationSettings; print(OrganizationSettings.load().departments)"
```

**Rollback:**

```powershell
cd backend
python manage.py migrate tickets 0007
python manage.py migrate accounts 0012
python manage.py migrate organization 0002
```

Reverse the two FK migrations **first**: `organization 0002` reverses `0003`'s `CreateModel` into a `DeleteModel`, which cannot drop a table `accounts_user.department_id` and `tickets_ticket.department_id` still reference. Within the `organization` app, Django unapplies in reverse dependency order, so `0005`'s `RemoveField` is reversed — re-adding the `departments` column, empty — **before** `0004`'s `demote` runs, which is what makes writing that column possible at all.

**Half-applied states and what they look like:**

- **`0003` applied, `0004` not.** The `Department` table exists and is empty; `OrganizationSettings.departments` still holds the strings. Harmless — nothing reads the table yet. Re-running `migrate` completes it.
- **`0004` applied, `0005` not.** Both sources exist and agree. Also harmless, and the only window in which a rollback loses nothing at all.
- **`0005` applied, `0006` not.** Departments exist and are linkable, but **no role holds `departments.view`** — every ticket form's picker and every department list returns `403`. The most visible half-state; complete the migration.
- **`0006` applied, frontend not deployed.** The old `SettingsPage` sends `departments: [...]` on `PATCH /api/settings/`; DRF ignores an unknown key by default, so the save succeeds and silently drops it. Deploy both halves together.

**The one irreversible loss:** rolling back past `0003` after an admin has created a department **through the new screen** discards it — `demote` writes every `Department.name` back into the JSON list, so the names survive, but `description`, `id`, and every `User`/`Ticket` link do not. Stated, not guarded: preserving FK links across a `DeleteModel` is not something a reverse migration can do.

---

## Verification Steps

1. **Backend builds:** from `backend/` — `python manage.py check` exits 0, then `ruff format --check .` and `ruff check .` both exit 0.
2. **Migration inspection, before applying:** `python manage.py makemigrations --check --dry-run` reports no pending changes; open all four new `organization` migrations plus `accounts/0013` and `tickets/0008` and confirm by eye that (a) `0005`'s `dependencies` name `0004`, and (b) `accounts/0013` and `tickets/0008` each name `("organization", "0003_department")`.
3. **From-scratch migrate (catches the FK ordering bug):** against a throwaway database — create one, point `DATABASE_URL` at it, run `python manage.py migrate`. It must reach the end with no `relation "organization_department" does not exist`.
4. **Data promotion on the real database:** print `OrganizationSettings.load().departments`, run `python manage.py migrate`, then `python manage.py shell -c "from apps.organization.models import Department; print(list(Department.objects.values_list('name', flat=True)))"`. The second list must contain every distinct non-blank name from the first.
5. **Permissions landed:** `python manage.py shell -c "from apps.accounts.models import Role; print({r.slug: [p for p in r.permissions if p.startswith('departments.')] for r in Role.objects.all()})"` → `admin` has both, `manager` and `agent` have `departments.view` only, `customer` has neither.
6. **Department CRUD and ticket scoping over real HTTP.** As an `admin`: `POST /api/departments/ {"name": "Billing", "description": ""}` → 201. `POST` the same name again → **400**, not 500. Create a second department, assign it to one ticket via `PATCH /api/tickets/<id>/ {"department": <id>}` → 200 with `department_name` in the response. Then:
   - `GET /api/tickets/` → full count.
   - `GET /api/tickets/?department=<id>` → **only** that ticket.
   - `GET /api/tickets/?department=none` → every ticket **except** it.
   - `GET /api/tickets/?department=` → same as unfiltered.
   - `GET /api/tickets/?department=abc` → **400** with a `department` field error.
   - `GET /api/tickets/<id>/?department=999999` → **200**, the ticket (detail routes are not scoped).
7. **Permission split enforced.** As an `agent`: `GET /api/departments/` → 200. `POST /api/departments/` → **403**. `DELETE /api/departments/<id>/` → **403**.
8. **`UserViewSet` regression — the staff-only filter and the mixin, together.** As an `admin`: `GET /api/users/` and record the count `N`. Confirm no portal customer's email appears in the list (cross-check against a customer with `portal_access_enabled: true`). Then assign a department to one user (`PATCH /api/users/<id>/ {"department": <id>}` → 200, response carries `department_name`) and `GET /api/users/?department=<id>` → exactly 1 row. If that returns `N`, the mixin is in the wrong MRO position (task 10).
9. **Deleting a department nulls, does not cascade.** `DELETE /api/departments/<id>/` → 204. Re-fetch the ticket and the user from steps 6/8 → both still exist, both now have `department: null` and `department_name: null`.
10. **Reports:** `GET /api/reports/tickets/breakdown/?dimension=department` → rows keyed by department name plus an "Uncategorized" row for department-less tickets. `GET /api/reports/tickets/volume/?series=department&department=<id>` → only that department's series. `GET /api/reports/tickets/breakdown/?dimension=department&export=csv` → a CSV whose rows match the JSON.
11. **Frontend runs:** from `frontend/` — `npm run dev`, then in the browser as an `admin`:
    - `/settings/departments` lists, creates, renames, and deletes; the sidebar link appears under Administration.
    - `/users/<id>/edit` has a Department select; saving it shows the new column on `/users`.
    - `/tickets/new` has a Department select; `/tickets` has a Department filter that narrows the table, plus a Department column.
    - `/tickets/department` shows the caller's department's tickets; log in as an account with no department and confirm the sidebar link is gone and the URL renders the empty state rather than every ticket.
    - `/reports/tickets` offers Department in both the series and dimension selects and has a working Department filter.
    - `/settings` no longer shows a Departments field, still shows Branches, and still saves.
    - Switch to Arabic and re-check all seven screens for RTL and for missing keys (a missing key renders as the raw key string).
12. **Regression:** `/tickets` category/priority/search/assigned-to-me filters still work and still 400 on a malformed value; `/users` search and sort still work; `/settings` still saves branding and SLA defaults; `/portal` still shows only the signed-in customer's tickets (`CustomerScopedModelViewSet` is untouched, but task 5 adds a second scoping module and this proves the first still governs).
13. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `organization.Department` exists (`name` unique, `description` blank, `ordering = ("name",)`), and `OrganizationSettings.departments` is **gone** from the model, `clean()`, the serializer, the TypeScript type, and `SettingsPage`. `branches` is untouched on all five.
- [ ] `apps/organization/migrations/0004_migrate_settings_departments.py` promotes every distinct non-blank string into a `Department` row, is idempotent (`get_or_create`), tolerates a missing settings row, and has a reverse that writes the names back (Verification Step 4).
- [ ] `0005`'s `dependencies` name `0004`; `accounts/0013` and `tickets/0008` each name `("organization", "0003_department")`; a from-scratch `migrate` completes (Verification Steps 2-3).
- [ ] `Permissions.DEPARTMENTS_VIEW`/`DEPARTMENTS_MANAGE` exist and are granted `admin`→both, `manager`/`agent`→view, by set union (Verification Step 5).
- [ ] `apps/core/scoping.py` exports `ScopeFilter`, `apply_scope_filters`, `ScopedQuerysetMixin`, and `UNSCOPED`, mentions no domain concept by name, and is the **only** place `?department=` is parsed. `CustomerScopedModelViewSet` is unmodified.
- [ ] `?department=<id>` filters, `?department=none` lists unscoped rows, `?department=` and an absent param do nothing, and `?department=abc` is a **400** — on `/api/tickets/`, `/api/users/`, and both RPT-1 report endpoints (Verification Steps 6, 8, 10).
- [ ] `?department=` on a **detail** route is ignored, not a 404 (Verification Step 6).
- [ ] `User.department` and `Ticket.department` are both nullable `SET_NULL`; deleting a department nulls both and deletes nothing (Verification Step 9).
- [ ] `UserViewSet` has a real `queryset` attribute, `ScopedQuerysetMixin` **before** `BaseModelViewSet`, and still returns only `customer_profile__isnull=True` rows — verified against a known portal customer, not assumed (Verification Step 8).
- [ ] `TicketSerializer.immutable_fields` is still exactly `("customer",)` — a ticket can be moved between departments.
- [ ] `/auth/me/` carries `department: {id, name} | null`, and `AuthUser` mirrors it.
- [ ] `department` is the fifth `REPORT_DIMENSIONS` entry and the fifth `DIMENSION_FIELDS` key; both RPT-1 endpoints honour `?department=`, including under `?export=csv` (Verification Step 10). The other six report endpoints are unchanged.
- [ ] `/settings/departments` (plus `/new` and `/:id/edit`) exist, are permission-split `view`/`manage` on both the route and the in-page controls, and are reachable from the sidebar.
- [ ] `/tickets/department` shows the caller's department's tickets, renders an empty state and fires **no** query when the caller has no department, and its sidebar link is hidden for such an account.
- [ ] Department appears as a select on the user form and the ticket form, as a filter on the ticket list and the ticket report, and as a non-sortable column on the users list and the ticket list.
- [ ] Department options are fetched from `src/shared/departments/` by all three consuming features; `npm run lint` passes with no `no-restricted-imports` violation, and a write in `features/organization` refreshes every picker (one shared `departmentKeys` prefix).
- [ ] `CONVENTIONS.md` §33 documents both scoping primitives, the param contract, and the "`branches` is still JSON until ORG-2" rule. §0-§32 are not renumbered.
- [ ] `en`/`ar` key sets match for `organization`, `tickets`, `accounts`, and `reports` (`## Test Plan` item 6).
- [ ] The full gate set passes: `python manage.py check`, `python manage.py test`, `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`.

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 88 (`ORG-2` — Multi-Branch), which reuses this story's `Department` model, its migration sequence, and `apps/core/scoping.py` as its template.**
