# Story 48 — Users & Roles Admin (Story: SUPPORTOS-72)

## Prerequisites

- **Story 09 completed:** [../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md](../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md). Verified landed: `accounts.Role` (`slug`, `name`, `description`, `permissions` JSON, `is_system`), `User.role` (FK, `null=True`, `on_delete=PROTECT`), `apps/core/permissions.py`'s `Permissions`/`ALL_PERMISSIONS`/`permissions_for`/`HasPermission`, `BaseModelViewSet`, and `/auth/me/` exposing `role` + `permissions`.
- **Story 10 completed:** [../customer-management/10-story-customer-profiles-SUPPORTOS-28.md](../customer-management/10-story-customer-profiles-SUPPORTOS-28.md) — establishes the feature-module template (`CONVENTIONS.md` § 23) this story follows: `BaseModelViewSet` + fully-populated `permission_map`, `DataTable` + `useServerTable`, `useAppForm` + field components, prefix-wide mutation invalidation, PATCH-for-edit.
- **This is the boundary Story 09 deliberately left open.** `apps/accounts/models.py:44-45` (the `Role` docstring): *"SEC-1 manages roles and SEC-2 edits their permissions through a UI, and neither can edit Python."* `apps/accounts/admin.py:9-16` (`RoleAdmin`'s docstring): *"Until SEC-1 ships, this is the only way to create a role or edit its permissions."* This story is SEC-1. It does **not** touch permission editing — that boundary (SEC-2, `SUPPORTOS-73`) is unchanged; see `## Story Goal`.
- Verified backend baseline: `apps/accounts/serializers.py` has exactly three serializers (`RoleSerializer` — `slug`/`name` only, embedded in `/me/`; `UserSerializer` — the `/me/` shape; `LogoutSerializer`). `apps/accounts/views.py` has exactly `LogoutView` and `MeView`, both plain `APIView`s. `apps/accounts/urls.py` has four `path()` entries, no router. No `UserViewSet`/`RoleViewSet` exists anywhere — verified by grep.
- Verified: `Permissions` (`apps/core/permissions.py:26-35`) already holds `USERS_VIEW`, `USERS_MANAGE`, `ROLES_MANAGE` (seeded by Story 09) — this story adds **no new permission constant** and **no grant migration**. It also adds **no model and no schema migration** — `Role` and `User.role` already exist.
- Verified: four system roles are seeded today — `admin`, `manager`, `agent` (`apps/accounts/migrations/0003_seed_roles.py`) and `customer` (`apps/accounts/migrations/0004_seed_customer_role.py`, added for Story 42/`PORTAL-0`, holding only `portal.access`). Only `admin` currently holds `roles.manage`; `admin` and `manager` hold `users.view`; no role but `admin` holds `users.manage`.
- Verified: `python manage.py test` reports **54** passing today (run live).
- **The scope boundary that shapes this story — read before task 1.** `.squad/stories/security-administration/SUPPORTOS-73/intake.md` (SEC-2, *"Dependencies: SEC-1... Permission config API + UI — Implement role→permission mapping UI"*) confirms `Role.permissions` stays **read-only** in every screen this story builds. `Role.clean()` (`apps/accounts/models.py:69-86`) and `RoleAdmin`'s raw-JSON textarea remain the only ways to change what a role grants, until SEC-2.

---

## Story Goal

Give staff administrators a real screen over the `AUTHZ` identity models — `accounts.User` and `accounts.Role` — so that assigning a role, deactivating an account, or renaming a role no longer requires Django admin or `manage.py shell`.

1. `UserViewSet` — list/search/sort staff users, create a new one with an initial password, edit name/email/role/active-status. **No delete** — see the CASCADE finding below.
2. `RoleViewSet` — list/search/sort roles, create/rename/describe a role, delete a non-system role. **No permission editing** — `Role.permissions` stays read-only; SEC-2 owns that.
3. A `UserListPage`/`UserFormPage` and a `RoleListPage`/`RoleFormPage`, all `DataTable`/`useAppForm`-based per `CONVENTIONS.md` § 23, gated by `users.view`/`users.manage`/`roles.manage` through the existing `HasPermission`/`<Can>`/`RequirePermission` mechanism — no new authorization concept.

### Two verified findings that shape the model, not just the UI

**1. A hard `DELETE` on a user is a real data-loss trap, not a policy choice.** Verified by grep across every migration referencing `settings.AUTH_USER_MODEL`:

| Relation | `on_delete` |
|---|---|
| `notifications.Notification.recipient` | **`CASCADE`** |
| `agents.Task.owner` | **`CASCADE`** |
| `tickets.TicketActivity.actor`, `agents.InternalNote.author`, `sla.AssignmentRule.last_assigned_agent`, `customers.Customer.user`, `tickets.Ticket.assigned_agent`, `customers.Attachment.uploaded_by`, `customers.Note.author` | `SET_NULL` |

`User.role` itself is `PROTECT`, which is unrelated and already safe. But `Notification.recipient` and `Task.owner` are `CASCADE`: deleting a `User` silently deletes every task they own and every notification addressed to them. `BaseModelViewSet` is a full `ModelViewSet`, so `destroy` exists unless explicitly removed. Per `CONVENTIONS.md` § 22's grant-on-omission rule, simply **omitting** `"destroy"` from `permission_map` does **not** forbid it — it falls through to authenticated-only, which would make this worse, not safer. Task 2 removes the HTTP verb itself via `http_method_names`, verified against the installed framework:
- `django/views/generic/base.py:134-144` (`View.dispatch`) — `if request.method.lower() in self.http_method_names: handler = getattr(...) else: handler = self.http_method_not_allowed`. DRF's `ViewSetMixin.as_view()` (`rest_framework/viewsets.py:113-117`) still binds `self.delete = self.destroy`, but `dispatch()`'s method-name gate runs first, so a DELETE request never reaches `destroy`.
- `rest_framework/views.py:167-172` (`APIView.http_method_not_allowed`) — raises `exceptions.MethodNotAllowed(request.method)`, `default_code = "method_not_allowed"` (`rest_framework/exceptions.py:194-198`), a code the frontend already recognises (`shared/lib/api/types.ts:15`). No new error code, no new frontend handling.

Deactivation (`is_active=False` via `update`) is the sanctioned way to remove someone's access without touching their history.

**2. A portal customer's `User` row must not appear in this screen.** `customers.Customer.user` (`apps/customers/models.py:38-45`) is a `OneToOneField` to `accounts.User`, and its own docstring says the link is *"set by a staff member through Django admin (Story 42 task 5), not a self-service flow"* — i.e. portal-customer accounts are already `accounts.User` rows, provisioned through a different screen than this one. Surfacing them in a staff-facing "manage users" list would let an agent edit a customer's login identity through the wrong door, and would list every `customer`-role account (seeded, `apps/accounts/migrations/0004_seed_customer_role.py`) as staff. Task 2's `UserViewSet.get_queryset` filters on `customer_profile__isnull=True` — the OneToOne's reverse accessor, the authoritative signal — not on `role.slug`, because an admin could in principle leave a portal account's role blank without that changing what actually grants portal access.

### Explicitly out of scope

- **Editing `Role.permissions` → SEC-2** (`SUPPORTOS-73`). `RoleAdminSerializer` (task 1) declares it read-only. Django admin's raw JSON textarea is still the only write path.
- **Audit logging of who changed what → SEC-3** (`SUPPORTOS-74`).
- **Deleting a user, in any form.** Deactivation only — see the CASCADE finding above.
- **Password reset / self-service password change.** Task 1's `UserAdminSerializer.password` is create-only, validated via Django's `AUTH_PASSWORD_VALIDATORS` (`config/settings/base.py:130`). An edit never renders or accepts a password field. No email/invite flow exists in this codebase (verified by grep for `invit|reset_password` — no hits outside `accounts/models.py`'s own docstrings) and this story does not add one.
- **Bulk actions, CSV import/export.**
- **A dedicated 403 screen.** `RequirePermission` redirects to `/`, as Story 09 established.
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-72/intake.md` — one task block, **no attachments, no acceptance criteria**. Done Criteria derive from *"manage users/roles"* and the explicit *"Implement management screens over AUTHZ models"* framing — i.e. this story is UI over Story 09's models, not a new authorization mechanism.
2. `backend/apps/accounts/models.py` — `Role` (lines 41-86, especially the `clean()` guard at 69-86) and `User` (lines 89-133, especially `role` at 106-113). Note `on_delete=models.PROTECT` on `role` (line 110) is already correctly handled by `apps/core/exceptions.py:63-71`'s `ProtectedError` → `validation_error` translation — verified live against this exact relation per `CONVENTIONS.md` § 23's own note (*"the only precedent before it"*).
3. `backend/apps/accounts/serializers.py` (all 42 lines) — the existing `RoleSerializer` (lines 11-14) and `UserSerializer` (lines 17-37) are the `/auth/me/` shape. **Do not modify either** — task 1 adds two new serializers beside them.
4. `backend/apps/accounts/views.py` (all 44 lines) and `backend/apps/accounts/urls.py` (all 14 lines) — the four existing `auth/`-prefixed endpoints. Task 2 adds new views here; task 3 adds a **new** urls module rather than touching the `auth/`-prefixed router-free one.
5. `backend/apps/accounts/admin.py` — `RoleAdmin` (lines 7-45, especially `get_readonly_fields`/`has_delete_permission` at 27-45, the `is_system` guard task 2's `RoleViewSet` mirrors) and `UserAdmin` (lines 48-90).
6. `backend/apps/core/views.py` — `BaseModelViewSet` (lines 12-31): `permission_classes = [IsAuthenticated, HasPermission]`, `permission_map: dict[str, str] = {}`, and the grant-on-omission docstring. Also read `CustomerScopedModelViewSet` (lines 34-62) — **not used here**, it is for portal-facing viewsets only; this story's viewsets subclass `BaseModelViewSet` directly.
7. `backend/apps/core/permissions.py` — `Permissions` (lines 18-35, all ten existing constants — task 1 adds none), `HasPermission._required_permission` (lines 129-137).
8. `backend/apps/core/serializers.py` (all 20 lines) — `BaseModelSerializer`, used by `RoleAdminSerializer` (`Role` extends `TimeStampedModel`). **Not** used by `UserAdminSerializer` — `User` has no `created_at`/`updated_at`, the same reason `UserSerializer` (Story 08) is not `BaseModelSerializer`.
9. `backend/apps/tickets/serializers.py:14-35` (`TicketSerializer`) — the `category`/`category_name` dotted-source pattern task 1's `role`/`role_name` copies exactly.
10. `backend/apps/tickets/views.py:137-149` (`TicketViewSet.assignable_agents`) — the precedent for gating a cross-feature "options" read under the *consumer's* permission (`tickets.view`) rather than the owning feature's manage permission. Task 2's `RoleViewSet.list`/`retrieve` gated on `users.view` follows the same reasoning for the user form's role picker.
11. `backend/apps/customers/models.py:32-45` (`Customer.user`) — the OneToOne this story's `UserViewSet.get_queryset` filters against. Read the docstring in full; it is what justifies filtering on the relation instead of on `role.slug`.
12. `backend/config/api_urls.py` (all 24 lines) — task 3 adds one `include()` line above the catch-all `re_path`, which must stay last.
13. `backend/config/settings/base.py:130` (`AUTH_PASSWORD_VALIDATORS`) — unchanged, but `UserAdminSerializer.validate_password` calls into it. Lines 242-245 (`DEFAULT_FILTER_BACKENDS`) already list both `OrderingFilter` and `SearchFilter` — **no settings change needed**.
14. `backend/config/tests/test_settings.py:105-106` (`MigrationStateTests.test_no_pending_migrations`) and `backend/apps/core/tests/test_health.py:93` (`ApiCatchAllTests`) — the two regression guards Verification Step 1 relies on. This story ships **no migration**, so the first is a no-op check, not a new risk.
15. `frontend/src/features/customers/components/CustomerListPage.tsx` (all 117 lines) and `CustomerProfilePage.tsx` (all 108 lines) — the `DataTable`/`useServerTable`/`<Can>`/`useConfirm` composition task 5's `UserListPage`/`RoleListPage` copy.
16. `frontend/src/features/knowledge-base/components/ArticleFormPage.tsx` (all 211 lines) — the `CATEGORY_NONE` sentinel pattern (lines 26, 47, 57, 68) task 6's `UserFormPage` copies for its "no role" option, and the outer-component-picks-mode / inner-component-owns-the-form-instance split (lines 74-90).
17. `frontend/src/shared/ui/form/SwitchField.tsx` (all 51 lines) — **this story is its first production consumer**, verified by grep (no `SwitchField`/`CheckboxField`/`z.boolean()` hit anywhere under `frontend/src/features/`). Read its docstring: `checked`/`onCheckedChange`, not `{...field}`.
18. `frontend/src/shared/ui/form/TextField.tsx:16` — `type` supports `'password'`; task 6 uses it for the create-only password field.
19. `frontend/src/shared/validation/schemas.ts` — `requiredString`, `email`, `optionalString`. No new shared helper is needed this story.
20. `frontend/src/shared/i18n/resources.ts` (all 71 lines) — the explicit-map registration pattern; task 8 adds one namespace, `accounts` (distinct from the already-registered `auth` namespace, which is login/session, not identity administration).
21. `frontend/src/app/router.tsx` — the `RequirePermission`-wrapped route-group pattern (e.g. lines 44-82 for `customers.view`). Task 9 adds two more groups.
22. `frontend/src/app/RootLayout.tsx` (all 71 lines) — the `<Can>`-gated nav pattern (lines 22-48). Task 9 adds two more links.
23. `CONVENTIONS.md` § 22 (lines 735-833, authorization) and § 23 (lines 834-1033, feature module conventions — read the FAQ/Article entries near the end, lines 979-1012, for the "two independently-gated route trees" and "queryset filtered by the caller's own permission" precedents this story's `RoleViewSet` permission split and `UserViewSet.get_queryset` filter follow the same reasoning as, without being either case exactly).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Management screens over `AUTHZ` models — no new authorization mechanism.** | Intake | `UserViewSet`/`RoleViewSet` extend `BaseModelViewSet`; both reuse `Permissions.USERS_VIEW`/`USERS_MANAGE`/`ROLES_MANAGE`, all three already seeded by Story 09. No new `Permissions` constant. |
| **Permission editing stays out of scope (SEC-2's boundary).** | SUPPORTOS-73 intake, `Role` model docstring | `RoleAdminSerializer.Meta.read_only_fields` includes `permissions`; no frontend control ever sends it. |
| **A user cannot be hard-deleted.** | Verified CASCADE finding, this story | `UserViewSet.http_method_names` excludes `"delete"`; `UserListPage`/`UserFormPage` render no delete control, only a deactivate switch. |
| **The backend owns authorization; the frontend check is UX only.** | § 12, § 22 | `<Can>` hides the "New user"/"New role"/delete-role controls; `HasPermission` is what actually refuses. Both read the same permission strings. |
| **PATCH for edits, not PUT.** | § 23 | `updateUser`/`updateRole` use `api.patch`. |
| **Every mutation invalidates its own feature's key prefix.** | § 23 | `userKeys.all` and `roleKeys.all` are separate prefixes (two independent resources under one feature folder, the same split `faqKeys`/`articleKeys` already use inside `knowledge-base`) — a user mutation never invalidates the roles cache or vice versa. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 1 — Two new serializers

**File: `backend/apps/accounts/serializers.py`** — add imports and two classes beside the existing three. Do not modify `RoleSerializer`, `UserSerializer`, or `LogoutSerializer`.

```python
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.permissions import permissions_for
from apps.core.serializers import BaseModelSerializer

from .models import Role

User = get_user_model()


class RoleAdminSerializer(BaseModelSerializer):
    """CRUD over `Role` for SEC-1's admin screen. `permissions` and
    `is_system` stay read-only — editing the permission bundle is SEC-2
    (CONVENTIONS.md §22); `RoleAdmin`'s raw JSON textarea remains the only
    write path for `permissions` until then.
    """

    class Meta(BaseModelSerializer.Meta):
        model = Role
        fields = (
            "id", "slug", "name", "description", "permissions", "is_system",
            "created_at", "updated_at",
        )
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + (
            "permissions", "is_system",
        )

    def validate_slug(self, value):
        """A system role's slug is code-referenced (the seed migrations key
        on it) and admin-protected (`RoleAdmin.get_readonly_fields`); this
        mirrors that guard for the API path, since DRF does not call model
        `clean()` (the same split CONVENTIONS.md §22 records for `Role.clean()`
        itself, which only guards `permissions`, not `slug`).
        """
        if self.instance is not None and self.instance.is_system and value != self.instance.slug:
            raise serializers.ValidationError(_("A system role's slug cannot be changed."))
        return value


class UserAdminSerializer(serializers.ModelSerializer):
    """CRUD over `User` for SEC-1's admin screen. Deliberately NOT
    `BaseModelSerializer` — `User` has no `created_at`/`updated_at`, the
    same reason `UserSerializer` above is not (Story 08 `## Context` item 5).

    `is_staff`/`is_superuser` are read-only and shown only for display (e.g.
    explaining why an account with `role: null` still has full access, per
    `/auth/me/`'s own superuser note in `permissions_for`) — granting either
    is a Django-admin-only action, never exposed through this API.
    """

    # Same dotted-source pattern as `TicketSerializer.category_name`
    # (apps/tickets/serializers.py:26) — `allow_null=True` because `role`
    # itself is nullable. `role` needs no explicit declaration: DRF derives
    # `required=False, allow_null=True` from the model FK's own
    # `null=True, blank=True`, the same verified derivation
    # `TicketSerializer.category` relies on.
    role_name = serializers.CharField(source="role.name", read_only=True, allow_null=True)
    # Write-only; required only on create (see `validate` below). Never
    # returned and never accepted on update — password change is a
    # self-service flow this story does not build. See `## Story Goal`.
    password = serializers.CharField(
        write_only=True, required=False, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = (
            "id", "email", "first_name", "last_name", "is_active", "is_staff",
            "is_superuser", "role", "role_name", "date_joined", "last_login",
            "password",
        )
        read_only_fields = ("id", "is_staff", "is_superuser", "date_joined", "last_login")

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": [_("This field is required.")]})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        # Silently ignored, not a 400: the edit form never renders this
        # field, so a stray "password" key only ever arrives from a
        # hand-crafted request, and rejecting it would tell such a caller
        # more than a normal validation error should.
        validated_data.pop("password", None)
        return super().update(instance, validated_data)
```

`permissions_for` is imported but unused by these two classes — **remove that import** if not otherwise referenced; the existing `UserSerializer.get_permissions` (line 31-37) already uses it and stays as-is.

---

### 2 — Two new viewsets

**File: `backend/apps/accounts/views.py`** — add imports and two classes beside `LogoutView`/`MeView`.

```python
from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Role
from .serializers import LogoutSerializer, RoleAdminSerializer, UserAdminSerializer, UserSerializer

User = get_user_model()


class UserViewSet(BaseModelViewSet):
    """Staff user administration — SEC-1. The identity half of the
    management screens Story 09 deferred; `RoleViewSet` below is the other
    half.

    No `destroy`: `accounts.User` is referenced by `agents.Task.owner` and
    `notifications.Notification.recipient` with `on_delete=CASCADE`
    (verified by grep across every `settings.AUTH_USER_MODEL` migration —
    see `## Story Goal`), so a hard delete would silently wipe a person's
    tasks and notifications. `http_method_names` drops "delete" entirely
    rather than leaving `destroy` unmapped in `permission_map` — the
    grant-on-omission rule (CONVENTIONS.md §22) means an unmapped action is
    authenticated-only, NOT forbidden, which would make this worse.
    Deactivation (`is_active=False` via `update`) is the sanctioned way to
    remove someone's access without touching their history.
    """

    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    serializer_class = UserAdminSerializer

    permission_map = {
        "list": Permissions.USERS_VIEW,
        "retrieve": Permissions.USERS_VIEW,
        "create": Permissions.USERS_MANAGE,
        "update": Permissions.USERS_MANAGE,
        "partial_update": Permissions.USERS_MANAGE,
    }

    # Each name here must match a `ColumnDef.id` on the frontend, exactly
    # like every prior feature's `ordering_fields` contract (§23).
    ordering_fields = ("email", "first_name", "last_name", "is_active", "date_joined")
    search_fields = ("email", "first_name", "last_name")

    def get_queryset(self):
        # Staff identities only. A portal customer's User row is
        # provisioned through `Customer.user` (Story 42, Django-admin-only)
        # and has no place in a staff-facing "manage users" screen.
        # `customer_profile` (the OneToOne's reverse accessor —
        # apps/customers/models.py:38-45) is the authoritative signal, not
        # `role.slug == "customer"`: the linked Customer row is what
        # actually grants portal access, independent of whatever role is
        # assigned. See `## Story Goal`.
        return User.objects.select_related("role").filter(customer_profile__isnull=True)


class RoleViewSet(BaseModelViewSet):
    """Role administration — SEC-1's other half. `list`/`retrieve` are
    gated on `users.view`, not `roles.manage`: `UserFormPage`'s role picker
    reads this endpoint, and it must work for anyone who can already see
    `UserViewSet.list` — the same cross-feature reuse
    `TicketViewSet.assignable_agents` established for `tickets.view`
    (apps/tickets/views.py:137-149). Only creating, renaming, or deleting a
    role needs the more sensitive `roles.manage`. `permissions` stays
    read-only — see `RoleAdminSerializer`.
    """

    queryset = Role.objects.all()
    serializer_class = RoleAdminSerializer

    permission_map = {
        "list": Permissions.USERS_VIEW,
        "retrieve": Permissions.USERS_VIEW,
        "create": Permissions.ROLES_MANAGE,
        "update": Permissions.ROLES_MANAGE,
        "partial_update": Permissions.ROLES_MANAGE,
        "destroy": Permissions.ROLES_MANAGE,
    }

    ordering_fields = ("name", "slug", "created_at")
    search_fields = ("name", "slug")

    def destroy(self, request, *args, **kwargs):
        """Mirrors `RoleAdmin.has_delete_permission` (apps/accounts/admin.py:42-45)
        for the API path — a system role must not be deletable from here
        either.
        """
        role = self.get_object()
        if role.is_system:
            raise ValidationError({"non_field_errors": [_("System roles cannot be deleted.")]})
        return super().destroy(request, *args, **kwargs)
```

`MeView`'s import of `UserSerializer` (line 8 of the current file) is unchanged — it still serialises `/auth/me/` through the original, unmodified serializer.

---

### 3 — Routing

**Create file: `backend/apps/accounts/admin_urls.py`** — a second, router-based urls module for this app. Kept separate from `apps/accounts/urls.py` (the `auth/`-prefixed token/logout/me endpoints) so the new resources land at `/api/users/` and `/api/roles/`, matching every sibling feature's top-level `/api/<resource>/` convention, rather than nesting identity administration under the session-oriented `auth/` prefix.

```python
from rest_framework.routers import SimpleRouter

from .views import RoleViewSet, UserViewSet

app_name = "accounts_admin"

# SimpleRouter, not DefaultRouter: apps.customers.urls already owns the
# auto-generated API-root view at path(""). See Story 39 `## Context` item 9.
router = SimpleRouter()
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")

urlpatterns = router.urls
```

`app_name = "accounts_admin"`, not `"accounts"` — `apps/accounts/urls.py` already declares `app_name = "accounts"` (line 6); reusing it on a second urls module included separately is needless ambiguity for no benefit, since neither module is reversed by name anywhere in this project (verified: the frontend calls REST paths directly, never Django's `reverse()`).

**File: `backend/config/api_urls.py`** — one `include()`, above the catch-all, grouped with the other `apps.accounts` line:

```python
urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.accounts.admin_urls")),
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

Endpoints: `GET/POST /api/users/`, `GET/PUT/PATCH /api/users/<pk>/` (no `DELETE` — 405), `GET/POST /api/roles/`, `GET/PUT/PATCH/DELETE /api/roles/<pk>/`.

---

### 4 — Tidy the now-outdated admin docstring

**File: `backend/apps/accounts/admin.py`** — `RoleAdmin`'s docstring (lines 9-11) currently reads *"Until SEC-1 ships, this is the only way to create a role or edit its permissions."* SEC-1 has shipped role **creation**; only **permission editing** is still admin-only. Update to:

```python
class RoleAdmin(admin.ModelAdmin):
    """`RoleViewSet` (apps.accounts.views) now covers create/rename/delete —
    SEC-1. `permissions` is still edited here as a raw JSON textarea: a
    checkbox list over `ALL_PERMISSIONS` is what SEC-2 is for, and
    `Role.clean()` rejects an invalid string with a field error, so the raw
    editor is safe rather than merely tolerable. See CONVENTIONS.md §22.
    """
```

No behavioural change — `list_display`, `search_fields`, `readonly_fields`, `get_readonly_fields`, `get_prepopulated_fields`, `has_delete_permission` are all unchanged. This is a documentation-only edit.

---

## Frontend Tasks

### 5 — Types, API layer, and query keys

**Create file: `frontend/src/features/accounts/types/role.ts`**

```ts
/** Mirrors `apps.accounts.serializers.RoleAdminSerializer` verbatim. */
export type Role = {
  id: number
  slug: string
  name: string
  description: string
  /** Read-only here — editing this list is SEC-2. */
  permissions: string[]
  is_system: boolean
  created_at: string
  updated_at: string
}

/** The write shape. `permissions`/`is_system` are server-managed. */
export type RoleInput = {
  slug: string
  name: string
  description: string
}
```

**Create file: `frontend/src/features/accounts/types/user.ts`**

```ts
/** Mirrors `apps.accounts.serializers.UserAdminSerializer`'s read shape. */
export type AdminUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  role: number | null
  role_name: string | null
  date_joined: string
  last_login: string | null
}

/** Create-only write shape — includes `password`. */
export type UserCreateInput = {
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  role: number | null
  password: string
}

/** Edit write shape — no `password`; the API silently ignores one anyway. */
export type UserUpdateInput = Omit<UserCreateInput, 'password'>
```

**Create files: `frontend/src/features/accounts/api/userKeys.ts`, `roleKeys.ts`** — following `faqKeys.ts`/`articleKeys.ts`'s one-file-per-resource split inside a shared feature folder:

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const userKeys = featureKey('users')
```

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const roleKeys = featureKey('roles')
```

**Create files: `getUsers.ts`, `getUser.ts`, `createUser.ts`, `updateUser.ts`** (mirrors `features/customers/api/getCustomers.ts` etc.):

```ts
import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { AdminUser } from '../types/user'

export type UserListParams = ServerTableParams & { search?: string }

export function getUsers(params: UserListParams): Promise<Page<AdminUser>> {
  return api.getPage<AdminUser>('/users/', { params })
}
```

```ts
export function getUser(id: number): Promise<AdminUser> {
  return api.get<AdminUser>(`/users/${id}/`)
}
```

```ts
export function createUser(input: UserCreateInput): Promise<AdminUser> {
  return api.post<AdminUser>('/users/', input)
}
```

```ts
// PATCH, not PUT — CONVENTIONS.md §23.
export function updateUser(id: number, input: UserUpdateInput): Promise<AdminUser> {
  return api.patch<AdminUser>(`/users/${id}/`, input)
}
```

**Create files: `useUsers.ts`, `useUser.ts`, `useUserMutations.ts`** — the same `useQuery`/`useMutation` shape as `features/customers/api/useCustomers.ts` / `useCustomerMutations.ts`, keyed on `userKeys`. **No `useDeleteUser`** — there is no delete endpoint to call.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createUser } from './createUser'
import { updateUser } from './updateUser'
import { userKeys } from './userKeys'
import type { UserCreateInput, UserUpdateInput } from '../types/user'

function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: userKeys.all })
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: UserCreateInput) => createUser(input),
    onSuccess: invalidate,
  })
}

export function useUpdateUser(id: number) {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: UserUpdateInput) => updateUser(id, input),
    onSuccess: invalidate,
  })
}
```

**Create files: `getRoles.ts`, `getRole.ts`, `createRole.ts`, `updateRole.ts`, `deleteRole.ts`, `useRoles.ts`, `useRole.ts`, `useRoleMutations.ts`** — identical shape, targeting `/roles/`, keyed on `roleKeys`. `useDeleteRole` **is** needed here (unlike users):

```ts
export function deleteRole(id: number): Promise<void> {
  return api.delete(`/roles/${id}/`)
}
```

```ts
export function useDeleteRole() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (id: number) => deleteRole(id),
    onSuccess: invalidate,
  })
}
```

---

### 6 — The Users screens

**Create file: `frontend/src/features/accounts/components/UserListPage.tsx`** — same composition as `CustomerListPage.tsx`: `useServerTable` + debounced search (300 ms, reset page on change) + `DataTable`.

Columns:

| `id` | header | sortable | notes |
|---|---|---|---|
| `email` | `t('users.fields.email')` | yes | `cell` renders a `<Link to={\`/users/${row.id}/edit\`}>` |
| `first_name` | `t('users.fields.firstName')` | yes | |
| `last_name` | `t('users.fields.lastName')` | yes | |
| `role_name` | `t('users.fields.role')` | **no** | not in `ordering_fields`; `row.role_name ?? (row.is_superuser ? t('users.superuser') : t('users.noRole'))` |
| `is_active` | `t('users.fields.status')` | yes | `<Badge variant={row.is_active ? 'secondary' : 'outline'}>` |

`caption={t('users.title')}`. A `<Can permission="users.manage">` around the "New user" button, `<Link to="/users/new">`. `empty`: search-active vs not, same two-message split as `CustomerListPage`. **No delete action anywhere on this screen.**

**Create file: `frontend/src/features/accounts/components/UserFormPage.tsx`** — deliberately **not** the single-schema pattern `ArticleFormPage`/`CustomerFormPage` use, because create and edit have genuinely different fields here (`password` exists only on create). The outer component still picks the mode the same way `ArticleFormPage` does; each mode gets its own inner component with its own schema and its own `useAppForm` call.

```tsx
const ROLE_NONE = 'none'  // Radix Select needs a non-empty value; same role as ArticleFormPage's CATEGORY_NONE.

const baseShape = {
  email: email(),
  first_name: optionalString(150),
  last_name: optionalString(150),
  role: z.string(),
  is_active: z.boolean(),
}

const createSchema = z.object({ ...baseShape, password: requiredString(128) })
const editSchema = z.object(baseShape)
```

- `UserFormPage` (outer): `useParams()` → `idParam`; `idParam === undefined` renders `<UserCreateForm />`; otherwise wraps `useUser(id)` in `<QueryBoundary>` and renders `<UserEditForm user={user} id={id} />`.
- Both inner forms fetch `useRoles({ page: 1, page_size: 100 })` for the role `<SelectField>` options (`{ value: ROLE_NONE, label: t('users.noRole') }` plus every role's `{ value: String(role.id), label: role.name }`), and both use `TextField`s for email/first_name/last_name, `SwitchField` for `is_active`, `SelectField` for `role`.
- `UserCreateForm` adds one more `<TextField type="password" name="password" autoComplete="new-password">` and defaults `is_active: true`.
- `UserEditForm` seeds `defaultValues` from the loaded `AdminUser` (`role: user.role === null ? ROLE_NONE : String(user.role)`), renders no password field, and calls `useUpdateUser(id)`.
- Both convert `role: values.role === ROLE_NONE ? null : Number(values.role)` before calling their mutation, and on success toast + `navigate('/users')`.
- `onError` → `isValidationError(error)` → `applyServerErrors(form, error)`, same as every prior form. A duplicate `email` arrives as a field error via `User.email`'s model-level `unique=True` (`ModelSerializer` auto-derives the `UniqueValidator`, the same auto-derivation `CONVENTIONS.md` §23 documents — `email` is *not* explicitly redeclared on `UserAdminSerializer`, so the derivation applies with no extra work, unlike `CustomerSerializer.email`'s special case).
- A weak/common password from `create_user` → `validate_password` returns a field error under `password`, translated server-side and passed through untouched (§ 18).

---

### 7 — The Roles screens

**Create file: `frontend/src/features/accounts/components/RoleListPage.tsx`** — same shape as `FaqListPage.tsx` (list + inline delete button per row, no separate profile page — a role has no content beyond what the form already edits).

Columns: `name` (link to `/roles/:id/edit`, sortable), `slug` (sortable), a computed `permissions` column showing `row.permissions.length` via `t('roles.permissionCount', { count: row.permissions.length })` (not sortable — server-side sorting has no ordering over a JSON array length), `is_system` (`<Badge>` when true), `actions` (a delete button, rendered only when `!row.is_system`, gated by `<Can permission="roles.manage">`, going through `useConfirm()` then `useDeleteRole()`).

`<Can permission="roles.manage">` also gates the "New role" button. `caption={t('roles.title')}`.

**Create file: `frontend/src/features/accounts/components/RoleFormPage.tsx`** — same create/edit-in-one-component shape as `ArticleFormPage` (the field set here genuinely is identical between modes, unlike Users).

```ts
// Django's own SlugField validation regex (django.core.validators.slug_re
// pattern, `^[-a-zA-Z0-9_]+$`) — matched client-side so a bad slug is a
// form error, not a round trip to the server.
const schema = z.object({
  slug: z.string().trim().min(1).max(50).regex(/^[-a-zA-Z0-9_]+$/),
  name: requiredString(100),
  description: optionalString(255),
})
```

- `defaultValues` from the loaded `Role` on edit; `{ slug: '', name: '', description: undefined }` on create.
- The `slug` `<TextField>` is `disabled` when editing a role whose `is_system` is `true` — mirrors `RoleAdminSerializer.validate_slug` and `RoleAdmin.get_readonly_fields`, so a system role's slug is visibly, not just server-side, locked.
- **No permissions field anywhere on this form.** A role created here has `permissions: []` until an admin edits it via Django admin's raw JSON textarea, or until SEC-2 ships — an expected interim state, not a bug (see `## Edge Cases`).
- `onSuccess` → toast + `navigate('/roles')`. `onError` → the same `applyServerErrors` path; a system-role slug change returns the `validate_slug` field error onto the `slug` input; a duplicate slug returns the model's own `unique=True` `UniqueValidator` error the same way.

---

### 8 — Locale namespace

**Create file: `frontend/src/features/accounts/locales/en.json`**

```json
{
  "users": {
    "title": "Users",
    "new": "New user",
    "edit": "Edit user",
    "search": "Search users",
    "searchPlaceholder": "Name or email",
    "empty": "No users yet",
    "emptyDescription": "Create the first user to get started.",
    "noSearchResults": "No users match that search.",
    "noRole": "No role",
    "superuser": "Superuser",
    "fields": {
      "email": "Email",
      "firstName": "First name",
      "lastName": "Last name",
      "role": "Role",
      "status": "Status",
      "password": "Password"
    },
    "status": { "active": "Active", "inactive": "Inactive" },
    "actions": { "save": "Save" },
    "created": "User created.",
    "updated": "User updated.",
    "notFound": "That user could not be found."
  },
  "roles": {
    "title": "Roles",
    "new": "New role",
    "edit": "Edit role",
    "empty": "No roles yet",
    "emptyDescription": "Create the first role to get started.",
    "permissionCount_one": "{{count}} permission",
    "permissionCount_other": "{{count}} permissions",
    "fields": {
      "name": "Name",
      "slug": "Slug",
      "description": "Description",
      "permissions": "Permissions",
      "actions": "Actions"
    },
    "systemBadge": "System",
    "actions": { "save": "Save", "delete": "Delete" },
    "delete": {
      "title": "Delete this role?",
      "description": "This permanently removes the role. This cannot be undone."
    },
    "created": "Role created.",
    "updated": "Role updated.",
    "deleted": "Role deleted.",
    "notFound": "That role could not be found."
  }
}
```

**Create `frontend/src/features/accounts/locales/ar.json`** with the identical key set (including the plural `permissionCount_one`/`permissionCount_other` pair — i18next's plural suffixing, already used nowhere else in this project's JSON but standard for the library already in use), translated.

**File: `frontend/src/shared/i18n/resources.ts`** — register `accounts` (two imports, two entries), following the existing pattern exactly. `accounts` is distinct from the already-registered `auth` namespace (login/session copy) — no key collision.

---

### 9 — Routes and navigation

**File: `frontend/src/app/router.tsx`** — two new `RequirePermission`-wrapped groups inside the existing `RequireAuth` element, alongside the `customers.view`/`tickets.view`/`knowledge_base.*` groups:

```tsx
{
  element: <RequirePermission permission="users.view" />,
  children: [
    { path: 'users', lazy: /* UserListPage */ },
    // Must stay before `users/:id`, same reason as `customers/new`.
    { path: 'users/new', lazy: /* UserFormPage */ },
    { path: 'users/:id/edit', lazy: /* UserFormPage */ },
  ],
},
{
  element: <RequirePermission permission="roles.manage" />,
  children: [
    { path: 'roles', lazy: /* RoleListPage */ },
    { path: 'roles/new', lazy: /* RoleFormPage */ },
    { path: 'roles/:id/edit', lazy: /* RoleFormPage */ },
  ],
},
```

Note the asymmetry: the **route** for `/roles` requires `roles.manage` (it is purely an admin surface), while the **API**'s `RoleViewSet.list` requires only `users.view` (task 2) — so `UserFormPage`'s role `<SelectField>` still resolves for a `manager` account (which holds `users.view` but not `roles.manage`) even though that account cannot navigate to `/roles` itself. This is intentional, not a gap — see task 2's `RoleViewSet` docstring.

**File: `frontend/src/app/RootLayout.tsx`** — add two nav links beside the existing ones, and extend the `useTranslation` namespace array (line 13) with `'accounts'`:

```tsx
<Can permission="users.view">
  <Button asChild variant="ghost" size="sm">
    <Link to="/users">{t('accounts:users.title')}</Link>
  </Button>
</Can>
<Can permission="roles.manage">
  <Button asChild variant="ghost" size="sm">
    <Link to="/roles">{t('accounts:roles.title')}</Link>
  </Button>
</Can>
```

---

## Documentation Tasks

### 10 — Append to `CONVENTIONS.md` § 23

**File: `CONVENTIONS.md`** — append two entries after the existing last one (ends at line 1033, the `TicketConversation` "not automatically a `shared/` component" note). Do **not** renumber § 0-§ 26.

```markdown
**A resource that must never be hard-deleted removes the HTTP verb, not
just the permission mapping.** `UserViewSet` (Story 48, `SEC-1`) is the
first case: `accounts.User` is referenced by `agents.Task.owner` and
`notifications.Notification.recipient` with `on_delete=CASCADE`, so a
`DELETE` would silently remove a person's tasks and notifications.
Per this section's own grant-on-omission rule, leaving `destroy` out of
`permission_map` is not a deny — it falls through to authenticated-only.
Dropping `"delete"` from the viewset's `http_method_names` is what actually
disables the verb: Django's `View.dispatch()` gates on
`request.method.lower() in self.http_method_names` before a DRF viewset's
router-bound `self.delete` (set by `ViewSetMixin.as_view()`) is ever
reached, so the request 405s as `method_not_allowed` with no new error
code. Reach for this whenever a resource has a `CASCADE`-related model that
must survive a parent record's removal and there is no row-level rule
(`has_object_permission`) that could express "always deny" instead.

**A queryset filter can exclude rows that belong to a different feature's
identity, keyed on the owning relation, not on a denormalised field.**
`UserViewSet.get_queryset` (Story 48, `SEC-1`) excludes portal-customer
accounts from the staff user-admin screen by filtering on
`customer_profile__isnull=True` (the `Customer.user` OneToOne's reverse
accessor) rather than on `role.slug == "customer"` — the FK relation is
the actual grant of portal access; a role is just data an admin could
otherwise leave stale. The same reasoning as `ArticleViewSet.get_queryset`
filtering by the caller's *own* permission (Story 40) rather than by
action name: filter on the fact that is actually true, not on a proxy for it.
```

**File: `frontend/src/README.md`** — extend § Authentication & authorization (lines 78-98) with one sentence naming `SwitchField` as now having a production consumer (`UserFormPage`'s active/inactive toggle) — this project's fifth field component to ship with a real call site, after `TextField`/`SelectField` (Customer/Article/Ticket forms).

No change to root `README.md` — no new environment variable, no new error code, no new dependency.

---

## Edge Cases & Failure Modes

- **A hard delete of a user would cascade-delete their tasks and notifications.** Verified by grep across every `settings.AUTH_USER_MODEL` migration (see `## Story Goal`). `UserViewSet.http_method_names` excludes `"delete"` entirely; a `DELETE /api/users/<id>/` returns 405 `method_not_allowed`, verified against `django/views/generic/base.py:134-144` and `rest_framework/views.py:167-172`. Re-adding `destroy` to `permission_map` without also restoring `"delete"` to `http_method_names` would be a no-op — the verb is gone before permissions are even checked.
- **A portal customer's account must never appear in, or be editable through, the staff user-admin screen.** `UserViewSet.get_queryset` filters on `customer_profile__isnull=True`. Missing this filter would let a support agent with `users.manage` edit a customer's login email/password through the wrong screen, and would list every seeded `customer`-role account as if it were staff.
- **A new role has zero permissions until edited via Django admin.** `Role.permissions` defaults to `[]` and stays read-only on `RoleAdminSerializer`. This is the correct interim state — SEC-2 (`SUPPORTOS-73`) is what builds the UI over that field. Nothing in this story's screens implies otherwise; `RoleListPage`'s permission-count column will show `0 permissions` for a freshly created role, which is accurate, not a bug.
- **A system role's slug is rejected server-side even if the disabled frontend input is bypassed.** `RoleAdminSerializer.validate_slug` raises when `self.instance.is_system` and the incoming value differs — independent of the frontend's `disabled` attribute, the same defense-in-depth `Role.clean()` already applies to the admin form path.
- **Deleting a non-system role that a user still holds fails cleanly, not with a 500.** `User.role` is `on_delete=PROTECT`; `apps/core/exceptions.py:63-71` already translates the resulting `ProtectedError` into a `validation_error` — verified pre-existing behaviour, not new work this story does. `RoleViewSet.destroy`'s own `is_system` guard runs *before* this ever matters for a seeded role (which is always `is_system=True` and therefore rejected first), so the `ProtectedError` path is only reached for a **custom** role someone assigned to a user, which is the correct case for it to fire.
- **Deactivating your own account is not specially prevented.** `UserViewSet.update` has no self-protection check — an admin with `users.manage` can set their own `is_active=False`. `is_active=False` does not itself invalidate an already-issued access token (JWTs are stateless until they expire or are blacklisted; Story 08/09 built no "check `is_active` per request" enforcement beyond Django's own `ModelBackend`, which this project does not use for JWT auth). Locking yourself out this way is a known, low-probability foot-gun this story does not add tooling to prevent — flagged here rather than silently accepted.
- **The role dropdown lists the seeded `customer` role alongside staff roles.** `RoleViewSet.list` has no "staff-only" filter — a `manager` or `admin` could assign the `customer` role (which only grants `portal.access`) to a staff account. This is unusual but not incorrect per the data model; restricting it would require a "role kind" concept the intake does not ask for. Left as a known rough edge.
- **A weak or too-short password on create is a field error, not a 500.** `UserAdminSerializer.validate_password` runs `django.contrib.auth.password_validation.validate_password` (`AUTH_PASSWORD_VALIDATORS`, `config/settings/base.py:130`), which raises Django's own `ValidationError` → translated by `_to_drf_exception` (`apps/core/exceptions.py:60-62`) into a DRF `ValidationError` on the `password` field.
- **`role` on `UserAdminSerializer` needs no explicit declaration for its `required=False, allow_null=True` behaviour** — verified DRF derivation from the model FK's own `null=True, blank=True`, the same derivation already relied on for `TicketSerializer.category`. If a future Django/DRF upgrade changes this derivation, `UserFormPage`'s "clear role" path (`role: null`) would start failing validation instead of clearing — worth re-verifying on any DRF version bump.
- **Two role names can collide; two slugs cannot.** `Role.name` has no `unique=True`; `Role.slug` does. A duplicate slug is a clean field error via the model-derived `UniqueValidator`; a duplicate *name* silently succeeds — this mirrors the model exactly and is not a gap this story introduces.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass. This story ships no migration, so `MigrationStateTests.test_no_pending_migrations` is a no-op check here, not a new risk; `ApiCatchAllTests` (`apps/core/tests/test_health.py:93`) is what confirms the new `admin_urls.py` router does not shadow the catch-all.
2. `ruff format --check .` / `ruff check .` on the new and changed Python.
3. `npm run build` — typechecks `Role`/`RoleInput`, `AdminUser`/`UserCreateInput`/`UserUpdateInput`, every new `ColumnDef<...>`, both `useAppForm` instantiations in `UserFormPage` (create and edit schemas), and every new `t('accounts:…')` key.
4. `npm run lint` (`react/jsx-no-literals` over the four new components), `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison for the new `accounts` namespace, the same script Story 10's Verification Step 4 uses.
6. Real HTTP across the four seeded-role accounts (`admin@`, `mgr@`, `agent@` from Story 09's verification, plus the `customer` role's absence of a staff test account — no portal test account is needed since the queryset filter, not a permission check, is what excludes it) and a real browser walkthrough in both languages — Verification Steps 5-13 below.

---

## Migration / Rollback

**No migration in this story.** `Role` and `User.role` already exist (Story 09); this is a pure code change — two serializers, two viewsets, one new urls module, one new `include()` line, four new frontend components, and their supporting `types`/`api`/`locales` files.

**Rollback of the code:** revert the commits. No `npm install` and no `pip install` — no new dependency in either app.

**Half-applied states to avoid:**

- **Task 2 (`UserViewSet`/`RoleViewSet`) before task 3 (`admin_urls.py` + the `api_urls.py` include)** → the viewsets exist but are unreachable; harmless, but `npm run dev` against a real backend would 404 on `/api/users/` and `/api/roles/` until task 3 lands. Ship them together.
- **Task 6/7 (frontend components) before task 8 (locale namespace)** → every `t('accounts:…')` key fails `tsc -b`, the same failure mode Story 10's `## Migration / Rollback` already documents for its own namespace-before-components ordering (here inverted: components import the namespace, so components-before-locales is the broken order).
- **Task 9 (routes) before tasks 6/7** → the lazy imports resolve to modules that do not exist yet; the build fails on the import, not the route.
- **`http_method_names` excluding `"delete"` on `UserViewSet` without the frontend also omitting a delete control** → not a security gap (the backend already 405s), but a confusing UX if a delete button were ever added and silently failed. Task 6 renders no delete control at all, so this state cannot occur as shipped.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing — `ApiCatchAllTests` in particular, proving the new `admin_urls.py` router does not shadow the catch-all.
3. **`en`/`ar` key sets match** for the new `accounts` namespace (the same `node -e` script Story 10 Verification Step 4 uses, pointed at `frontend/src/features/accounts/locales/{en,ar}.json`).
4. **`GET /api/users/` and `GET /api/roles/` enforce `users.view`.** Using the Story 09 accounts (`admin@`, `mgr@`, `agent@`, password `Sup3rSecret!`) plus no token:

   | Request | no token | `agent@` (no `users.view`) | `mgr@` (`users.view` only) |
   |---|---|---|---|
   | `GET /api/users/` | 401 `not_authenticated` | 403 `permission_denied` | 200 |
   | `GET /api/roles/` | 401 | 403 | 200 |

5. **The portal-customer filter actually excludes.** In Django admin (or shell), create a `Customer` row and link its `user` field to one of the seeded accounts (or a new one), giving that account the `customer` role. `GET /api/users/` as `admin@` must **not** list it; `python manage.py shell -c "from django.contrib.auth import get_user_model; print(get_user_model().objects.count())"` must show a higher count than the API's `meta.pagination.count` by exactly the number of linked accounts.
6. **`POST /api/users/` creates an account with a working password, and rejects a weak one.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/users/ -H "Content-Type: application/json" -H "Authorization: Bearer $adminToken" -d '{\"email\":\"newagent@supportos.local\",\"first_name\":\"New\",\"last_name\":\"Agent\",\"is_active\":true,\"role\":null,\"password\":\"Sup3rSecret!\"}'
   ```

   Expect 201. Then repeat with `"password":"123"` — expect a `validation_error` on `password`. Then obtain a token for `newagent@` at `/api/auth/token/` with the working password to confirm it actually authenticates.
7. **`DELETE /api/users/<id>/` is 405, not 403 or 204.** `curl.exe -s -X DELETE ... -H "Authorization: Bearer $adminToken"` against any user id — expect **405** with `error.code: "method_not_allowed"`, even for the superuser. This is the check that `http_method_names` is doing its job independent of permissions.
8. **`PATCH /api/users/<id>/` deactivates without touching other fields**, and assigns/clears a role: `{"is_active": false}` then `GET` the same user back — `is_active: false`, every other field unchanged. Then `{"role": null}` on a user that had one — `role: null`, `role_name: null`.
9. **A system role cannot be deleted or renamed via the API.** `DELETE /api/roles/<admin-role-id>/` as `admin@` → `validation_error` naming "System roles cannot be deleted", **not** a `ProtectedError` 500. `PATCH` the same role with a different `slug` → `validation_error` on `slug`.
10. **A non-system role can be created, edited, and deleted end to end.** `POST /api/roles/` with a fresh `slug`/`name` → 201, `permissions: []`. `PATCH` its `name` → 200. `DELETE` it → 204 (or a `ProtectedError`-derived `validation_error` if a test user was assigned it in an earlier step — confirm which occurred and that it is the expected one).
11. **Ordering and search work on both resources.** `?ordering=email`, `?ordering=-date_joined` on `/api/users/`; `?ordering=name`, `?ordering=slug` on `/api/roles/`; `?search=` against an email fragment and a role-name fragment respectively. `?ordering=is_staff` (not in `ordering_fields`) is ignored, not an error.
12. **The full UI walkthrough, both languages.** `npm run dev` with the backend up, signed in as `admin@`:
    - `/users` lists staff accounts only (no portal customers); sortable headers work; search narrows and resets to page 1.
    - "New user" creates one with a role and a password; the new row appears with no manual refresh.
    - Edit toggles `is_active` off; the badge updates in the list.
    - `/roles` lists all four seeded roles plus any created above, each showing its permission count and an `is_system` badge on the seeded four; delete is absent/disabled for the seeded four and present for a custom one.
    - Switch to Arabic: every string translated, `dir="rtl"`, no hardcoded English left visible.
    - Sign in as `mgr@` (`users.view` only): `/users` is reachable and read-only in effect (no "New user" button, no editable Save button state — verify the button itself: since `<Can>` only gates buttons, not fields, confirm `UserFormPage`'s Save still exists but the API 403s on submit — note if this is confusing UX and whether a `<Can>`-gated read-only banner is worth a follow-up, without adding one now). `/roles` redirects to `/` (no `roles.manage`) and the nav link is absent.
    - Sign in as `agent@` (neither permission): both nav links absent; direct navigation to `/users` and `/roles` both redirect to `/`.
13. **No hardcoded strings, no ad-hoc role checks.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\accounts\**\*.tsx -Pattern "'[A-Z][a-z]{3,}"
    Select-String -Path src\features\accounts\**\*.tsx,src\features\accounts\**\*.ts -Pattern "user\.role|is_staff|permissions\.includes"
    ```

    The first must return only non-user-facing hits; the second must return **nothing**.
14. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `RoleAdminSerializer` and `UserAdminSerializer` added to `apps/accounts/serializers.py`; the existing `RoleSerializer`/`UserSerializer`/`LogoutSerializer` and `/auth/me/`'s response shape are **unchanged**.
- [ ] `Role.permissions` and `Role.is_system` are **read-only** on `RoleAdminSerializer`; no frontend control anywhere sends `permissions`.
- [ ] `UserAdminSerializer.password` is write-only, required only on create (`validate`), validated via `django.contrib.auth.password_validation.validate_password`, and silently dropped on update.
- [ ] `UserViewSet.http_method_names` excludes `"delete"`; `DELETE /api/users/<id>/` returns 405 `method_not_allowed` for every account including a superuser (Verification Step 7).
- [ ] `UserViewSet.get_queryset` filters `customer_profile__isnull=True`; a portal-customer-linked account never appears in `/api/users/` (Verification Step 5).
- [ ] `RoleViewSet.list`/`retrieve` gated on `users.view`; `create`/`update`/`partial_update`/`destroy` gated on `roles.manage`; `destroy` additionally rejects `is_system` roles with a field error, not a 500 (Verification Step 9).
- [ ] No new `Permissions` constant, no new grant migration, no schema/data migration of any kind — verified by `git status`/`git diff` showing no new file under `apps/accounts/migrations/`.
- [ ] `config/api_urls.py` registers `apps.accounts.admin_urls` above the catch-all `re_path`, which is still last; `ApiCatchAllTests` still passes; endpoints land at `/api/users/` and `/api/roles/`, not nested under `/api/auth/`.
- [ ] `features/accounts/` contains `types/{user,role}.ts`, `api/` (both key files, all read/write call modules, all `use*` hooks — **no `useDeleteUser`**), `components/` (`UserListPage`, `UserFormPage`, `RoleListPage`, `RoleFormPage`), and `locales/{en,ar}.json` registered in `resources.ts` as `accounts`.
- [ ] `UserFormPage` uses two schemas (create includes `password`, edit does not) and two inner form components, not one shared schema.
- [ ] `RoleFormPage`'s `slug` input is `disabled` when editing a system role; no `permissions` field exists on the form.
- [ ] Every mutation invalidates its own resource's key prefix (`userKeys.all` or `roleKeys.all`) — never the other resource's, never an individual item key.
- [ ] Routes: `/users`, `/users/new`, `/users/:id/edit` gated by `RequirePermission permission="users.view"`; `/roles`, `/roles/new`, `/roles/:id/edit` gated by `RequirePermission permission="roles.manage"`; both `new` routes declared before their `:id` siblings.
- [ ] `RootLayout` gains two nav links, gated by `<Can permission="users.view">` and `<Can permission="roles.manage">` respectively.
- [ ] Verified by real HTTP: the permission table in Verification Step 4; user creation with a working and a rejected password (Step 6); the 405-on-delete (Step 7); deactivate/role-clear via PATCH (Step 8); system-role protection (Step 9); custom-role full CRUD (Step 10); ordering/search (Step 11).
- [ ] Both languages walk through cleanly, RTL included (Step 12); no hardcoded strings or ad-hoc role checks (Step 13).
- [ ] `CONVENTIONS.md` § 23 gains the two appended entries (hard-delete-by-verb-removal; queryset-filter-by-owning-relation) — **appended, § 0-§ 26 unrenumbered**. `RoleAdmin`'s docstring in `apps/accounts/admin.py` updated to reflect that role creation is now API-driven. `frontend/src/README.md` § Authentication & authorization notes `SwitchField`'s first production consumer.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` filled in with this story, and `.squad/plans/00-index.md` gains a row for `security-administration`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 49 (SEC-2, `SUPPORTOS-73`, Permissions Management — the role→permission mapping UI this story deliberately left read-only).**
