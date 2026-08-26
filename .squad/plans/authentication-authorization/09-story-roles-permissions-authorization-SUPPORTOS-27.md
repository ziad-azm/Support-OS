# Story 09 — Roles, Permissions & Authorization (Story: SUPPORTOS-27)

## Prerequisites

- **Story 08 completed:** [08-story-authentication-jwt-SUPPORTOS-26.md](08-story-authentication-jwt-SUPPORTOS-26.md). Verified landed and running: `accounts.User` (email login, `AbstractBaseUser` + `PermissionsMixin`), `JWTAuthentication` as the global `DEFAULT_AUTHENTICATION_CLASSES`, the four `/api/auth/` endpoints, `frontend/src/shared/auth/` (token storage, single-flight refresh, `AuthProvider`, `useAuth`, `RequireAuth`), `LoginPage`, and `CONVENTIONS.md` § 21.
- **Two written promises from earlier stories come due in this one.** Both are load-bearing, not decoration:
  - `backend/apps/accounts/models.py:40–42` — *"Deliberately minimal: AUTH-2 adds the role field/FK on top of this."* Task 1 is that field.
  - `backend/apps/core/views.py:10–16` — `BaseModelViewSet`, *"Deliberately empty. It exists so AUTH-2 can add project-wide permission and filtering defaults in one place instead of editing every viewset."* Task 4 is what finally gives it a body. **It still has zero subclasses** — verified by grep.
- **`CONVENTIONS.md` § 13** (lines 191–209) says AUTH-2 "is not planned yet" and carries the standing *"Open security note"* that `DEFAULT_PERMISSION_CLASSES` is `AllowAny`. This story rewrites § 13 and appends § 22.
- Verified backend baseline: `apps/accounts/models.py` has **no** role field; `Group.objects.count()` is **0**; `apps/core/` has no `permissions.py`; nothing anywhere subclasses `BaseModelViewSet`.
- Verified frontend baseline: grepped `frontend/src` for `can(`, `permission`, `Role` — no authorization helpers of any kind. `AuthUser` (`shared/auth/types.ts:3–9`) carries `is_staff` but no role and no permissions.
- **The scope boundary that decides this story's shape — read before task 1.** `SupportOs backlog.MD` **line 684** assigns *"User/role admin API + UI — Implement management screens over `AUTHZ` models"* to **SEC-1** (EPIC 13), and **line 691** assigns *"Permission config API + UI — Implement role→permission mapping UI enforced by `AUTHZ`"* to **SEC-2**. So AUTH-2 produces the **models and the mechanism**; the admin screens over them belong to a later epic. See `## Story Goal` for what that forces about the data model.

---

## Story Goal

Make authorization a single mechanism that every future endpoint and every future button inherits, before any domain model exists to protect — so no feature ever writes its own role check.

1. A `Role` model with the three seeded roles the intake names (Admin, Manager, Agent), extensible at runtime.
2. A **code-defined permission vocabulary** and a **database-backed role→permission mapping** — the split is deliberate and forced by SEC-2; see below.
3. `User.role`, so a person's access follows their job.
4. One DRF permission class, `HasPermission`, driven by a declarative `permission_map` on the view — no per-feature `if user.role == ...` anywhere.
5. `BaseModelViewSet` carrying that class by default, which is the intake's *"applied via base viewset conventions"* literally.
6. `/api/auth/me/` returning the caller's role and a flat permission list, so the frontend can gate UI from the same source of truth the backend enforces.
7. `can(permission)`, a `<Can>` guard, and a `RequirePermission` route guard — the frontend's only sanctioned way to gate an action.

### The design decision this story turns on

**The intake says "mapping actions→roles". This story maps actions→*permissions*, and roles→permissions.** That is strictly more granular, and it is what the intake's own words *"granular permissions"* require: a role that is a bag of permissions can be re-cut without touching a single view, whereas a view naming roles directly (`allowed_roles = ["admin"]`) has to be edited every time the org chart changes. Views name permissions; only roles name permissions-in-bulk.

**Where each half lives is forced by SEC-2, not chosen for taste.** SEC-2 (backlog line 691) will build a *UI* for the role→permission mapping. A UI cannot edit a Python dict. So:

| Thing | Where it lives | Why it cannot live in the other place |
|---|---|---|
| The permission **vocabulary** (`users.view`, …) | **Code** — `apps/core/permissions.py` | Code is what enforces a permission. A DB-defined permission string that no view checks is a lie in the admin UI — it grants nothing. |
| Role → permission **mapping** | **Database** — `Role.permissions` | SEC-2 needs to edit it through a UI. A Python dict has no UI. |
| User → role **assignment** | **Database** — `User.role` | It is operational data; an admin assigns it, and SEC-1 builds that screen. |

`Role.permissions` is validated against the code registry in `clean()`, so the two halves cannot drift: you cannot save a role granting `tickets.delete` until some view actually declares `tickets.delete`.

**Why not Django's `Group` + `Permission`?** Verified: `auth.Permission` rows require a `ContentType`, i.e. a concrete model. Right now **32 permissions exist and every one belongs to `accounts`/`admin`/`auth`/`contenttypes`/`sessions`/`token_blacklist`** — there is not a single domain model (`customers`, `tickets`, `sla`, … are all empty apps). Building the authorization vocabulary on `auth.Permission` would mean either inventing placeholder models to hang permissions off, or having no domain vocabulary at all until CUST-1 lands. A code-defined string registry is decoupled from model existence, which is precisely what lets this mechanism ship *before* the domain does. `PermissionsMixin` stays on `User` (it is already there, `has_perm` still works, and Django admin needs it) — it is simply not the mechanism features use.

**Single role per user, not many.** `User.role` is an FK. This matches the story's own framing (*"access matches each person's job"* — a person has one job), the previous story's stated intent (*"the role field/FK"*), and it keeps `can()` a set-membership test rather than a union across roles. Multi-role is a schema change plus a `can()` change; it is not a refactor of anything else.

### Superuser is the one bypass, and `/me/` must agree with it

`is_superuser` short-circuits Django's `has_perm` to `True` for **any** string — verified: `superuser.has_perm("totally.made_up")` returns `True`. This story keeps that behaviour, because `admin@supportos.local` is a superuser and is how roles get bootstrapped before SEC-1 exists.

That creates a trap worth stating up front: if `HasPermission` grants a superuser everything but `/auth/me/` returns that superuser's *role-derived* permission list (empty, since a superuser needs no role), then **the backend permits an action the frontend hides**. `UserSerializer.get_permissions` therefore returns the **entire registry** for a superuser. Verification Step 8 checks exactly this.

### Explicitly out of scope

- **User/role admin API and UI → SEC-1** (backlog line 684). No `UserViewSet`, no users list screen, no role-assignment screen. Until SEC-1, roles are assigned in **Django admin** (task 5 registers `Role` and adds the role field to `UserAdmin` so this is possible on day one) or via `manage.py shell`.
- **A role→permission editing UI → SEC-2** (backlog line 691). This story ships the editable `Role.permissions` field and the validation that guards it; the screen over it is SEC-2's.
- **Per-object / row-level permissions.** `HasPermission` implements `has_permission` only, not `has_object_permission`. Object-level rules ("an agent may edit *their own* ticket") need a domain model to be about; the first feature that needs one adds `has_object_permission` to the same class. Noted in § 22 as the extension point rather than pre-built.
- **Field-level permissions** (hiding a serializer field by role).
- **Object ownership / assignment scoping.** Backlog line 334 ("agent-scoped filter") is TKT-era work.
- **Audit logging of permission denials → SEC-3.**
- **Multi-tenant / org scoping.** `apps/organization` is still an empty app; a role is global, not per-org. ORG-1 owns that.
- **Multi-role users**, and **permission inheritance / role hierarchy**.
- **Rate limiting and login-attempt throttling** — still the open gap AUTH-1 flagged; still not this story.
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

### Shipping without a UI consumer — stated plainly, for the third time

`can()` and `<Can>` ship with **no production call site**, because the screens that would gate anything are SEC-1's. This is the same gap stories 06 (`DataTable`) and 07 (the form pattern) carried, and the overview records all three. The difference here is that the *backend* half does have a real consumer immediately: every endpoint added from CUST-1 onward inherits enforcement from `BaseModelViewSet` the moment it subclasses it, with no per-feature code. Verification uses a throwaway harness deleted before committing — the pattern that worked for stories 06 and 07.

---

## Context — Read These Files First

1. `.squad/stories/authentication-authorization/SUPPORTOS-27/intake.md` — two task blocks, **no attachments, no acceptance criteria**. Done Criteria derive from the two **Outcome** lines and the two **Constraints** lines (*"one permission mechanism reused by all endpoints; no per-feature ad-hoc checks"*, *"features gate UI via these helpers; no bespoke role checks"*).
2. `SupportOs backlog.MD` **lines 677–700** — EPIC 13. Read SEC-1 (line 684) and SEC-2 (line 691) before deciding anything is in scope. They are the reason this story has no admin screens.
3. `backend/apps/accounts/models.py` — all 70 lines. `User` (line 37), the AUTH-2 promise in its docstring (lines 40–42), and `PermissionsMixin` (line 37) which already supplies `groups`, `user_permissions`, `is_superuser`, and `has_perm`.
4. `backend/apps/core/views.py` — `BaseModelViewSet` (lines 10–16), the empty base this story fills. Note `HealthView` (line 26) and `ApiNotFoundView` (line 56) both set `authentication_classes: list = []` **and** `permission_classes = [AllowAny]` explicitly — that is what keeps them open regardless of what this story changes, and it must stay.
5. `backend/apps/core/exceptions.py` — `envelope_exception_handler` (line 25), `code = getattr(exc, "default_code", "error")` (line 42), and `_to_drf_exception` (line 50), which already translates Django's `PermissionDenied` to DRF's (lines 54–55).
6. `backend/apps/accounts/serializers.py` — all 20 lines. `UserSerializer` (line 7) and its `fields` tuple (line 15), which task 3 extends. Note its docstring explains why it is **not** `BaseModelSerializer` — that reasoning still holds; do not "fix" it.
7. `backend/apps/accounts/views.py` — `MeView` (line 35). It is an `APIView`, so it has **no `self.action`** — the case task 2's permission class must handle without crashing.
8. `backend/config/settings/base.py` — `AUTH_USER_MODEL` (line 68), `LOCAL_APPS` (line 50), and `REST_FRAMEWORK`'s `DEFAULT_AUTHENTICATION_CLASSES` (line 237) / `DEFAULT_PERMISSION_CLASSES` (lines 240–241) with the comment above them explaining the `AllowAny` default. **Task 4 does not change `DEFAULT_PERMISSION_CLASSES`** — read the note there before assuming it should.
9. `backend/apps/README.md` § Where new code goes (lines 13–27) and § What `core` is for (lines 29–44). Rule 3 — *"Needed by two or more apps but only as a type, enum, or constant → `apps/core`"* — is why the permission registry goes in `core` and the `Role` model goes in `accounts`.
10. `backend/config/tests/test_settings.py` — `MigrationStateTests.test_no_pending_migrations` (line 104). It fails the build if task 1's model changes ship without their migration.
11. `frontend/src/shared/auth/types.ts` — all 18 lines. `AuthUser` (line 3) and `AuthContextValue` (line 13), both of which task 6 extends.
12. `frontend/src/shared/auth/AuthProvider.tsx` — all 85 lines. `/auth/me/` is fetched in exactly two places, the boot sequence (line 30) and `login` (line 55); both flow into `setUser`. Task 6 adds no third fetch.
13. `frontend/src/shared/lib/api/errors.ts` — `ApiRequestError`, specifically `isAuth` (line 45), which covers `not_authenticated`/`authentication_failed` but **not** `permission_denied`. Task 7 adds one getter beside it.
14. `frontend/src/shared/lib/api/queryClient.ts` — `shouldRetry` (line 11): *"never retry a 4xx"*. A 403 is therefore already correctly non-retried; task 7 changes nothing here.
15. `frontend/src/shared/i18n/locales/{en,ar}/errors.json` — confirm `permission_denied` and `not_authenticated` are **already present in both** before writing task 7. They are; this story adds **no** new error code.
16. `CONVENTIONS.md` — § 12 (lines 176–190: the backend owns authorization, a frontend check is UX only — the rule task 7 exists to serve), **§ 13 (lines 191–209: rewritten by task 8)**, § 16, § 19, § 20, and **all of § 21** (lines 625–end), whose "AllowAny everywhere except MeView" paragraph this story updates.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **One permission mechanism, reused by all endpoints.** | Intake, backend constraints | `apps/core/permissions.py`'s `HasPermission` is the only permission class features use; `BaseModelViewSet` carries it by default (task 4). |
| **No per-feature ad-hoc checks.** | Intake, backend constraints | A view declares `permission_map`; it never reads `request.user.role`. Verification Step 10 greps for `\.role ==` and `is_staff` across `apps/`. |
| **Roles: Admin, Manager, Agent, plus extensible.** | Intake, backend task | `Role` rows seeded by a data migration (task 1); new roles are created at runtime, not by a code change. |
| **Granular permissions.** | Intake, description | Permission strings, not role names, are what a view declares. Roles are bundles. |
| **Applied via base viewset conventions.** | Intake, backend task | `BaseModelViewSet` (task 4) — the base that has existed empty since story 02 specifically for this. |
| **Features gate UI via the shared helpers; no bespoke role checks.** | Intake, frontend constraints | `can()` / `<Can>` / `RequirePermission` (task 7). Verification Step 11 greps `frontend/src` for `user.role`/`is_staff` outside `shared/auth/`. |
| **The backend owns authorization; the frontend check is UX only.** | § 12 lines 177–180 | `can()` hides a control; `HasPermission` is what actually refuses. Both read the same permission strings, so they cannot disagree by construction — except for the superuser case task 3 handles explicitly. |
| **Errors translate by code, never by message.** | § 18 | `permission_denied` / `not_authenticated` are **already** in both `errors.json` files — verified. This story adds no code and no copy. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | **This story adds no environment variable.** `.env.example` and the README env table are unchanged. |

---

## Backend Tasks

### 1 — The permission registry, the `Role` model, and `User.role`

**Create file: `backend/apps/core/permissions.py`** — the vocabulary half. This file is the single source of truth for what a permission *is*; nothing else defines a permission string.

```python
"""The project's authorization vocabulary and its one DRF permission class.

Two halves, deliberately split (see CONVENTIONS.md §22):

* The permission STRINGS below are code. Code is what enforces a permission,
  so a permission that no view declares must not be grantable — SEC-2's
  future admin UI offers exactly this list and nothing else.
* The role -> permission MAPPING is data (`accounts.Role.permissions`), so
  SEC-2 can build a UI over it.

Adding a permission is a two-line change here plus the view that declares it.
Every feature story appends its own; this list grows with the domain.
"""

from rest_framework.permissions import BasePermission


class Permissions:
    """Permission strings, namespaced `<area>.<action>`.

    Only the areas that exist today are listed. A feature story adds its own
    constants here in the same change as the viewset that declares them —
    never a string literal at the call site.
    """

    USERS_VIEW = "users.view"
    USERS_MANAGE = "users.manage"
    ROLES_MANAGE = "roles.manage"


ALL_PERMISSIONS: frozenset[str] = frozenset(
    value
    for name, value in vars(Permissions).items()
    if not name.startswith("_") and isinstance(value, str)
)


def permissions_for(user) -> frozenset[str]:
    """Every permission this user holds.

    A superuser holds all of them — Django's own `has_perm` already
    short-circuits to True for a superuser (verified), so anything narrower
    here would make the API and `/auth/me/` disagree. Duck-typed on `role`
    rather than importing `accounts`, to keep `core` free of app imports.
    """
    if not user or not user.is_authenticated:
        return frozenset()
    if user.is_superuser:
        return ALL_PERMISSIONS
    role = getattr(user, "role", None)
    if role is None:
        return frozenset()
    return frozenset(role.permissions)


class HasPermission(BasePermission):
    """Grants a request when the user holds the permission the view demands.

    The view declares a `permission_map` of action -> permission string:

        class CustomerViewSet(BaseModelViewSet):
            permission_map = {
                "list": Permissions.CUSTOMERS_VIEW,
                "retrieve": Permissions.CUSTOMERS_VIEW,
                "create": Permissions.CUSTOMERS_MANAGE,
                "update": Permissions.CUSTOMERS_MANAGE,
                "partial_update": Permissions.CUSTOMERS_MANAGE,
                "destroy": Permissions.CUSTOMERS_MANAGE,
            }

    A view with no `permission_map` (or an action absent from it) is
    authenticated-only — this class does NOT silently deny, because a missing
    entry is far more often an unfinished map than an intent to forbid, and a
    silent 403 on a working endpoint is the harder bug to find. `IsAuthenticated`
    is what keeps such a view from being public; see BaseModelViewSet.

    Plain `APIView`s have no `self.action` (verified — DRF sets it in
    `ViewSet.initialize_request`), so `permission_map` may also be keyed by
    lowercased HTTP method for those.
    """

    def has_permission(self, request, view) -> bool:
        required = self._required_permission(request, view)
        if required is None:
            return True
        return required in permissions_for(request.user)

    @staticmethod
    def _required_permission(request, view) -> str | None:
        mapping = getattr(view, "permission_map", None)
        if not mapping:
            return None
        action = getattr(view, "action", None)
        if action is not None and action in mapping:
            return mapping[action]
        return mapping.get(request.method.lower())
```

**Do not add a `code` or `message` attribute to `HasPermission`.** Verified: DRF's `check_permissions` (`rest_framework/views.py:336–341`) reads `permission.message`/`permission.code` and passes them to `permission_denied`, whose default already produces `default_code = "permission_denied"` — the code the frontend's `errors.json` already translates. A custom message would bypass § 18's translate-by-code rule.

**File: `backend/apps/accounts/models.py`** — add the `Role` model above `User`, and the field on `User`.

```python
from apps.core.models import TimeStampedModel
from apps.core.permissions import ALL_PERMISSIONS


class Role(TimeStampedModel):
    """A named bundle of permission strings.

    A row, not an enum: SEC-1 manages roles and SEC-2 edits their permissions
    through a UI, and neither can edit Python. `slug` is the stable
    identifier — code and fixtures reference the slug, never the primary key
    or the display name.
    """

    slug = models.SlugField(_("slug"), max_length=50, unique=True)
    name = models.CharField(_("name"), max_length=100)
    description = models.CharField(_("description"), max_length=255, blank=True)
    permissions = models.JSONField(_("permissions"), default=list, blank=True)
    # Seeded roles are referenced by slug in code and must not be deletable
    # from the admin. SEC-1 enforces this in its UI too.
    is_system = models.BooleanField(_("system role"), default=False)

    class Meta:
        verbose_name = _("role")
        verbose_name_plural = _("roles")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name

    def clean(self) -> None:
        """Reject a permission string no view can ever check.

        This is the guard that keeps the code half and the data half from
        drifting — without it, SEC-2's UI could grant `tickets.delete` years
        before any view declares it, and the grant would silently do nothing.
        """
        super().clean()
        if not isinstance(self.permissions, list):
            raise DjangoValidationError({"permissions": _("Permissions must be a list.")})
        unknown = sorted(set(self.permissions) - ALL_PERMISSIONS)
        if unknown:
            raise DjangoValidationError(
                {
                    "permissions": _("Unknown permissions: %(names)s")
                    % {"names": ", ".join(unknown)}
                }
            )
```

Add `from django.core.exceptions import ValidationError as DjangoValidationError` to the imports.

On `User`, add the field and a convenience predicate:

```python
    role = models.ForeignKey(
        "accounts.Role",
        verbose_name=_("role"),
        related_name="users",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
```

- **`on_delete=PROTECT`**, not `SET_NULL`: deleting a role that people still hold should fail loudly, not silently strip everyone's access.
- **`null=True`**: a user with no role holds no permissions. A superuser needs no role, and `createsuperuser` must keep working without prompting for one — verified that `REQUIRED_FIELDS` is `[]` and adding a nullable FK does not change that.

Update the `User` docstring: the *"AUTH-2 adds the role field/FK"* line is now satisfied — replace it with a line pointing at § 22.

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations accounts
```

Expect **one** file, `apps/accounts/migrations/0002_*.py`, creating `Role` and adding `User.role`. **Commit it** — `MigrationStateTests.test_no_pending_migrations` (`config/tests/test_settings.py:104`) fails the build otherwise.

**Create file: `backend/apps/accounts/migrations/0003_seed_roles.py`** — a data migration seeding the three roles the intake names.

```python
from django.db import migrations

from apps.core.permissions import Permissions

SEEDED_ROLES = [
    {
        "slug": "admin",
        "name": "Admin",
        "description": "Full access, including user and role administration.",
        "permissions": [
            Permissions.USERS_VIEW,
            Permissions.USERS_MANAGE,
            Permissions.ROLES_MANAGE,
        ],
    },
    {
        "slug": "manager",
        "name": "Manager",
        "description": "Can see the team; cannot change users or roles.",
        "permissions": [Permissions.USERS_VIEW],
    },
    {
        "slug": "agent",
        "name": "Agent",
        "description": "Day-to-day support work. Gains permissions as features land.",
        "permissions": [],
    },
]


def seed_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for spec in SEEDED_ROLES:
        Role.objects.update_or_create(
            slug=spec["slug"],
            defaults={**spec, "is_system": True},
        )


def unseed_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(slug__in=[s["slug"] for s in SEEDED_ROLES]).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_role_user_role")]
    operations = [migrations.RunPython(seed_roles, unseed_roles)]
```

`update_or_create` keyed on `slug`, not `create`: the migration must be safe to re-run against a database that already has the rows. Adjust the `dependencies` entry to the real name `makemigrations` produced.

**Importing `Permissions` into a migration is safe here and deliberate** — it is a module of plain string constants in `core`, with no model imports, so there is no `apps.get_model` violation and no circular import. It also means a renamed constant breaks the migration loudly instead of seeding a stale string. Note that `unseed_roles` will fail on `PROTECT` if any user still holds a seeded role; that is correct, and the reverse migration is not something to run on a populated database.

---

### 2 — Register the permission class defaults on the base viewset

**File: `backend/apps/core/views.py`** — give `BaseModelViewSet` the body it has been reserved for since story 02.

```python
from rest_framework.permissions import AllowAny, IsAuthenticated

from .permissions import HasPermission


class BaseModelViewSet(viewsets.ModelViewSet):
    """Single inheritance point for every domain ModelViewSet.

    Carries the project's authorization defaults so no viewset repeats them:
    a caller must be authenticated, and must hold the permission this
    viewset's `permission_map` demands for the action being performed.

    Declare `permission_map` as action -> permission string (see
    `apps.core.permissions.HasPermission`). An action with no entry is
    authenticated-only, NOT forbidden — a missing entry is usually an
    unfinished map, and a silent 403 is the harder bug to find. Return plain
    payloads from actions; the renderer adds the envelope.

    `DEFAULT_PERMISSION_CLASSES` stays `AllowAny` project-wide (see
    CONVENTIONS.md §13) — this base is what makes a domain endpoint closed by
    default, not the global setting.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map: dict[str, str] = {}
```

**`DEFAULT_PERMISSION_CLASSES` is deliberately left at `AllowAny`.** Flipping it to `IsAuthenticated` globally would immediately break `HealthView` and `ApiNotFoundView` unless they kept their explicit `AllowAny` — which they do (`apps/core/views.py:27` and `:57`), so it would *work*. It is still the wrong move in this story: the pattern this codebase has used since story 02 is *explicit per-view permissions*, `CONVENTIONS.md` § 13's "Open security note" documents that contract, and there is exactly **one** authenticated endpoint today (`MeView`). Closing the default is a one-line change worth making when there are enough endpoints for the default to be load-bearing; doing it now trades a real regression risk for no real safety. Task 8 rewrites § 13 to say this in as many words, so the next reader does not mistake it for an oversight.

---

### 3 — Expose role and permissions on `/auth/me/`

**File: `backend/apps/accounts/serializers.py`**

```python
from apps.core.permissions import permissions_for

from .models import Role


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("slug", "name")


class UserSerializer(serializers.ModelSerializer):
    """Deliberately NOT `BaseModelSerializer` — that base exists for
    `TimeStampedModel`'s `created_at`/`updated_at`, which `User` does not
    have. See Story 08 `## Context` item 5.
    """

    role = RoleSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "is_staff", "role", "permissions")
        read_only_fields = ("id", "is_staff", "role", "permissions")

    def get_permissions(self, user) -> list[str]:
        """The SAME resolution the API enforces with, including the superuser
        bypass — `permissions_for` is the single source. Returning only
        role-derived permissions here would hide controls from a superuser
        that the API would happily allow. See Story 09 `## Story Goal`.
        """
        return sorted(permissions_for(user))
```

`sorted()`, not the raw frozenset: a stable order keeps the JSON diffable and the frontend's `permissions` array deterministic.

**`role` is nested, `permissions` is flat.** The frontend needs the role's display name (for a future SEC-1 screen and for showing "you are an Agent") and needs permissions as a flat list to test membership. Sending the role's permissions *inside* the role object would make `can()` reach through two levels and would break the superuser case, where permissions do not come from a role at all.

**`MeView` needs no change** — it already serialises `request.user` through `UserSerializer`.

**Add `select_related`?** No. `MeView` serialises exactly one user; `role` is one extra query on one request. `select_related("role")` matters for a list endpoint, which SEC-1 owns.

---

### 4 — Register `Role` in the admin, and put role on the user form

Until SEC-1 ships, **Django admin is the only way to assign a role**, so this task is what makes the story usable rather than theoretical.

**File: `backend/apps/accounts/admin.py`** — add the `Role` admin and extend the existing `UserAdmin`.

```python
from .models import Role, User


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "permission_count", "is_system")
    search_fields = ("name", "slug")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"slug": ("name",)}

    @admin.display(description="Permissions")
    def permission_count(self, role) -> int:
        return len(role.permissions)

    def get_readonly_fields(self, request, obj=None):
        # A seeded role's slug is referenced by code and by fixtures; renaming
        # it would silently detach both.
        readonly = list(super().get_readonly_fields(request, obj))
        if obj is not None and obj.is_system:
            readonly.append("slug")
        return readonly

    def has_delete_permission(self, request, obj=None) -> bool:
        if obj is not None and obj.is_system:
            return False
        return super().has_delete_permission(request, obj)
```

On the existing `UserAdmin`, add `role` to the Permissions fieldset and to `list_display`:

```python
    list_display = ("email", "first_name", "last_name", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active", "is_superuser")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        (
            "Permissions",
            {
                "fields": (
                    "role",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
```

Keep `add_fieldsets` exactly as story 08 left it — adding `role` to the *create* form would make the `usable_password` flow harder to reason about for no gain, and a role is assigned right after creation anyway.

**`RoleAdmin` edits `permissions` as a raw JSON textarea.** That is deliberately unpolished: a checkbox list over `ALL_PERMISSIONS` is exactly what **SEC-2** is for (backlog line 691), and `Role.clean()` already rejects an invalid string with a field error, so the raw editor is safe rather than merely tolerable. Do not build the checkbox widget here.

---

## Frontend Tasks

### 5 — Types and the `can()` resolution

**File: `frontend/src/shared/auth/types.ts`** — extend `AuthUser` and `AuthContextValue`.

```ts
/** Mirrors `apps.accounts.serializers.RoleSerializer`. */
export type AuthRole = {
  slug: string
  name: string
}

/** Mirrors `apps.accounts.serializers.UserSerializer` verbatim — snake_case,
 * per CONVENTIONS.md §12. */
export type AuthUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  role: AuthRole | null
  /** Flat, already resolved by the backend — includes the superuser bypass.
   * Never derive permissions from `role` on the client. See CONVENTIONS.md §22. */
  permissions: string[]
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  /** UX only — the backend is the enforcement point (CONVENTIONS.md §12). */
  can: (permission: string) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
```

**Create file: `frontend/src/shared/auth/permissions.ts`** — the pure resolution, so non-React code and the provider share one implementation.

```ts
import type { AuthUser } from './types'

/**
 * Does this user hold this permission?
 *
 * Reads `user.permissions` — the flat list the backend already resolved,
 * superuser bypass included. Deliberately does NOT look at `role`: a
 * superuser has every permission and no role, so deriving from `role` here
 * would hide controls the API allows. See CONVENTIONS.md §22.
 */
export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false
  return user.permissions.includes(permission)
}
```

**File: `frontend/src/shared/auth/AuthProvider.tsx`** — expose `can`, memoised on the user:

```tsx
  const can = useCallback(
    (permission: string) => hasPermission(user, permission),
    [user],
  )

  return (
    <AuthContext.Provider value={{ user, status, can, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
```

Add `import { hasPermission } from './permissions'`. **No new `/auth/me/` fetch** — `permissions` arrives on the existing response, so both existing call sites (the boot sequence at line 30 and `login` at line 55) already carry it.

---

### 6 — The guard components

**Create file: `frontend/src/shared/auth/Can.tsx`**

```tsx
import type { ReactNode } from 'react'

import { useAuth } from './useAuth'

type CanProps = {
  permission: string
  children: ReactNode
  /** Rendered instead when the permission is absent. Default: nothing. */
  fallback?: ReactNode
}

/**
 * Renders `children` only when the user holds `permission`.
 *
 * The declarative form of `can()`, for the common "hide this button" case.
 * Hiding a control is UX, not security — the endpoint behind it enforces the
 * same permission independently (CONVENTIONS.md §12).
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = useAuth()
  return <>{can(permission) ? children : fallback}</>
}
```

**Create file: `frontend/src/shared/auth/RequirePermission.tsx`**

```tsx
import { Navigate, Outlet, useLocation } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { useAuth } from './useAuth'

/**
 * A path-less layout route that additionally requires a permission. Nest it
 * INSIDE `RequireAuth` — it does not re-check authentication, it only adds
 * the permission gate:
 *
 *   { element: <RequireAuth />, children: [
 *     { element: <RequirePermission permission="users.view" />, children: [...] },
 *   ]}
 */
export function RequirePermission({ permission }: { permission: string }) {
  const { status, can } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Loading />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!can(permission)) return <Navigate to="/" replace />
  return <Outlet />
}
```

**Redirect to `/`, not to a 403 page.** There is no 403 route in this app and inventing one is a design decision for the first feature that needs it. `replace` keeps the unauthorized URL out of history so Back does not bounce.

**File: `frontend/src/shared/auth/index.ts`** — export the new surface:

```ts
export { Can } from './Can'
export { RequirePermission } from './RequirePermission'
export { hasPermission } from './permissions'
export type { AuthUser, AuthRole, AuthContextValue } from './types'
```

Keep the existing `setAuthTokenProvider`/`setUnauthorizedHandler` bootstrap block at the top of the file untouched.

---

### 7 — The `isForbidden` getter

**File: `frontend/src/shared/lib/api/errors.ts`** — add one getter beside `isAuth` (line 45):

```ts
  /** 403 — authenticated, but not allowed. Distinct from `isAuth`, which is
   * "not signed in": a forbidden action must NOT trigger a re-login. */
  get isForbidden(): boolean {
    return this.code === 'permission_denied'
  }
```

**Do not add `permission_denied` to `isAuth`.** They mean different things and the difference is load-bearing: `isAuth` is "your session is the problem", `isForbidden` is "your role is the problem". Conflating them would send a user who lacks a permission to the login screen, where signing in again changes nothing.

**No `errors.json` change, no `API_ERROR_CODES` change.** Verified: `permission_denied` and `not_authenticated` are already in `API_ERROR_CODES` (`shared/lib/api/types.ts`) and already translated in both `en` and `ar`. This story adds no error code — unlike AUTH-1, which had to add `token_not_valid`.

**No interceptor change.** Verified from DRF source (`rest_framework/views.py:178–180`): an *unauthenticated* request to a permission-protected view raises `NotAuthenticated` (401 `not_authenticated`), and an *authenticated but unauthorized* one raises `PermissionDenied` (403 `permission_denied`). AUTH-1's refresh interceptor fires only on **401 + `token_not_valid`**, so neither of these triggers a refresh attempt. The two mechanisms compose correctly with no edit.

---

## Documentation Tasks

### 8 — `CONVENTIONS.md` § 13 and § 22, and the frontend README

**File: `CONVENTIONS.md`** — rewrite § 13 (lines 191–209) and **append** `## 22.`, leaving §0–§21 unrenumbered. Other files cite these by number (`.oxlintrc.json` cites § 15), so renumbering breaks references.

§ 13 currently says AUTH-2 "is not planned yet" and carries an "Open security note" that reads as an unfinished TODO. Rewrite it to:

- Point at § 21 for authentication and § 22 for authorization, both now landed.
- **Narrow the `AllowAny` note rather than deleting it.** It is still true and still important, but its scope has changed: a viewset subclassing `BaseModelViewSet` is now closed by default, so the standing hazard applies only to plain `APIView`s that set neither a base nor explicit `permission_classes`. State the condition under which the global default should finally flip (enough endpoints for it to be load-bearing) so the next reader sees a decision, not an oversight.

**Append `## 22. Authorization (roles & permissions)`** covering, in this order:

1. **The split**: permission vocabulary is code (`apps/core/permissions.py`), role→permission mapping is data (`Role.permissions`), user→role is data (`User.role`) — and the SEC-2 reason the mapping cannot be a Python dict.
2. **Views declare permissions, never roles.** With the reason: a role rename should not touch a single view.
3. **The `permission_map` convention**, with the copyable `CustomerViewSet` example from task 1's docstring.
4. **Grant-on-omission stated as a rule**, so nobody relies on omission as a deny.
5. **The superuser bypass**, and why `/auth/me/` must mirror it through the same `permissions_for`.
6. **`Role.clean()` guards forms, not programmatic writes** — a DRF serializer that writes `permissions` must validate them itself.
7. **Renaming a permission's string value is a data migration**, not a refactor.
8. **`has_object_permission` is the named extension point** for the first feature that needs row-level rules.
9. **The frontend contract**: `can()` / `<Can>` / `RequirePermission`, reading `user.permissions` and never `user.role`; and `isForbidden` being distinct from `isAuth`.
10. **The query-cache forward constraint**: TanStack Query keys do not include the user or role, so a role change mid-session leaves stale cached results until refetched — `queryClient.clear()` on that event is the fix when SEC-1 makes it reachable.

**File: `frontend/src/README.md`** — extend the existing § Authentication block (lines 67–78) rather than adding a new section: name `permissions.ts`, `Can.tsx`, and `RequirePermission.tsx`, state that `can()` reads the backend-resolved `permissions` list and never derives from `role`, and point at § 22. Update the § Related specs line (line 128 onward) to add § 22 beside § 21.

**Root `README.md`** — § Environment variables is **unchanged** (this story adds no variable). The § Error codes table (lines 358–372) already lists `permission_denied` (line 365) and `not_authenticated` (line 363), so this story's codes need no row.

**One fix-up this story should carry, since it is the doc's only auth gap:** that table is missing **`token_not_valid` | 401**, which story 08 added to `API_ERROR_CODES` and both `errors.json` files but never documented here. Add the row between `authentication_failed` and `permission_denied` to keep the table in wire order. Verified missing by grep.

---

## Edge Cases & Failure Modes

- **Superuser permissions must be resolved server-side, or the UI lies.** Verified: `is_superuser` short-circuits `has_perm` to `True` for any string, including `"totally.made_up"`. `permissions_for` returns `ALL_PERMISSIONS` for a superuser and `UserSerializer.get_permissions` uses that same function, so `/auth/me/` and `HasPermission` cannot disagree. Deriving `can()` from `user.role` on the client would break exactly this case — which is the case the only existing account (`admin@supportos.local`) is in.
- **A user with `role = null` holds nothing.** Every `can()` returns `false` and every mapped action 403s. That is the correct default for a freshly created user, and it is why task 4 puts `role` on the admin change form — without it, a new non-superuser account is inert with no obvious cause.
- **A missing `permission_map` entry grants, it does not deny.** Deliberate, and the riskier of the two options if chosen carelessly: an action absent from the map falls through to `IsAuthenticated`-only. The reasoning is that an unfinished map is far more common than an intent to forbid, and a silent 403 on a working endpoint is much harder to diagnose than an over-permissive endpoint caught in review. Verification Step 9 exercises this branch explicitly so it is a known behaviour, not a surprise. `CONVENTIONS.md` § 22 states it as a rule so nobody relies on omission as a deny.
- **`APIView` has no `self.action`.** Verified: DRF sets `self.action` in `ViewSet.initialize_request`, so `MeView` and any other plain `APIView` do not have it. `HasPermission._required_permission` falls back to a lowercased-HTTP-method key, and `getattr(view, "action", None)` never raises.
- **`Role.clean()` is not called by `save()`.** Django only runs `clean()` from `full_clean()`, which `ModelForm` (and therefore the admin) calls — but a bare `Role.objects.create(permissions=["bogus"])` in a shell or a migration bypasses it entirely. So the validation guards the admin and any future SEC-2 serializer, **not** programmatic writes. Do not read it as a database constraint. If a `RoleSerializer` ever accepts writes, it must validate `permissions` itself (DRF serializers do not call model `clean()`).
- **A permission string renamed in code silently degrades a stored role.** `Role.permissions` holds strings; renaming `Permissions.USERS_MANAGE`'s *value* leaves every role row pointing at the old string, which then fails `clean()` on the next admin save and — worse — grants nothing in the meantime. Renaming a permission value is a data migration, not a refactor. § 22 says so.
- **`on_delete=PROTECT` makes the reverse data migration fail once anyone holds a seeded role.** Correct behaviour (it stops a role deletion from silently stripping access), but it means `migrate accounts 0002` is not a safe rollback on a populated database. `## Migration / Rollback` covers the real path.
- **Importing `Permissions` into the seed migration couples it to code.** Intentional: a renamed constant breaks the migration loudly rather than seeding a string nothing checks. It is safe only because `apps/core/permissions.py` imports no models — keep it that way, or the migration will start failing at import time.
- **`permissions_for` duck-types `role`.** It lives in `core` and must not import `accounts` (that would invert the dependency `apps/README.md` establishes). `getattr(user, "role", None)` is what keeps `core` app-import-free; a type annotation naming `accounts.User` would reintroduce the coupling.
- **`AnonymousUser` has no `role` and no `is_superuser`… except it does.** Django's `AnonymousUser` defines `is_superuser = False` and `is_authenticated = False`, so `permissions_for` short-circuits on the `is_authenticated` check before touching `role`. Do not reorder those two guards.
- **`DEFAULT_PERMISSION_CLASSES` is still `AllowAny`, and that is now a *documented* decision rather than a TODO.** Any endpoint added between this story and the global flip must either subclass `BaseModelViewSet` (closed by default) or set `permission_classes` explicitly. An `APIView` that forgets both is public — the same standing hazard § 13 has carried since story 02, now narrowed to non-viewset views only.
- **`can()` is memoised on `user`, not on `permissions`.** `useCallback` with `[user]` is correct because `setUser` always replaces the object; a dep on `user.permissions` would be an array identity that changes on every fetch and defeat the memo. Story 06 hit `react(preserve-manual-memoization)` on a similar pattern — if `npm run lint` complains, hoist the value into a local before the dep array rather than disabling the rule.
- **A 403 must not send the user to the login screen.** `isForbidden` exists precisely so a future error handler can tell the two apart. Signing in again does not grant a permission, so treating 403 as an auth failure would produce an infinite login loop for an under-privileged user.
- **`RequirePermission` nested outside `RequireAuth` would double-guard.** It re-checks `status` so it is safe standalone, but nesting it *inside* `RequireAuth` (the documented arrangement) keeps the redirect-to-login logic in one place. Two components racing to `<Navigate>` to different targets is the failure mode to avoid.
- **Query cache is not permission-aware.** TanStack Query keys do not include the user or their role. If an account's role changes while the app is open, cached query results computed under the old permissions stay until refetched — the same class of forward constraint § 18 records for language. The moment a role change can happen in-session (SEC-1), `queryClient.clear()` on that event is the fix. Not reachable today: a role change requires Django admin plus a reload.
- **`Role` uses `TimeStampedModel`, so `BaseModelSerializer` is the right base for a future `RoleSerializer` that writes** — unlike `UserSerializer`, whose docstring explains why it is not. The read-only `RoleSerializer` in task 3 needs neither.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass, and `MigrationStateTests.test_no_pending_migrations` is what catches task 1's model changes shipping without their migration.
2. `ruff format --check .` / `ruff check .` on the new and changed Python.
3. `npm run build` — typechecks `AuthRole`, the extended `AuthUser`, `can` on `AuthContextValue`, and every new prop signature. A `<Can>` used without `permission` is a compile error.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl` — unchanged gates over the new files.
5. Real HTTP checks against three accounts (superuser, Admin-role, Agent-role) — Verification Steps 5–9. This is where the story's actual claim (the same permission decides both the API and the UI) gets tested; nothing static can see it.

---

## Migration / Rollback

**Two migrations, one schema and one data.** `0002_*` creates `Role` and adds `User.role`; `0003_seed_roles` inserts the three roles. Both are additive — `User.role` is nullable, so **no existing row needs a default and no database reset is required.** This is unlike story 08, whose `AUTH_USER_MODEL` swap forced a drop-and-recreate.

**Rollback of the code:** revert the commits. No `npm install` is needed (this story adds no package to either app — verified: nothing new in `requirements.txt` or `package.json`).

**Rollback of the schema** is where the care is needed. `migrate accounts 0002` runs `unseed_roles`, which deletes the seeded rows — and `on_delete=PROTECT` makes that **fail** if any user still holds one. The real sequence on a database with role assignments:

1. Clear the assignments first: `User.objects.update(role=None)`.
2. `python manage.py migrate accounts 0002` (unseeds), then `0001` (drops the column and the table).

On a database where nobody has been assigned a role yet, step 1 is a no-op and the reverse runs clean.

**Nothing outlives a rollback.** This story writes no `localStorage` key and no environment variable.

**Half-applied states to avoid:**

- **Task 1's model before its migration** → `manage.py test` fails on `test_no_pending_migrations`. Generate and commit them together.
- **`0003_seed_roles` before `apps/core/permissions.py` exists** → the migration fails at *import* time, not at run time, which makes every subsequent `manage.py` command fail rather than just the migrate. Write `permissions.py` first.
- **Task 3 (`/me/` exposes `permissions`) before task 5 (frontend types)** → harmless; the frontend ignores unknown JSON keys. The reverse order is the broken one: **task 5 before task 3** makes `user.permissions` `undefined` at runtime while typechecking clean, and `hasPermission` throws on `.includes`. Ship task 3 first.
- **Task 2 (`BaseModelViewSet` gains permission classes) with no subclass** → currently a no-op, since nothing subclasses it. Safe, and it is the point: the base is armed before the first domain endpoint arrives.
- **Task 4 skipped** → the story is untestable and unusable. Without the admin, a non-superuser role cannot be assigned at all, so Verification Steps 6–9 have no accounts to run against.
- **Deleting the harness before running Verification Steps 8–9** → they are the only thing that exercises `HasPermission` against a real request. Delete it after, and confirm with Step 12.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .` — all clean.
2. **Migrations apply forward on the existing database, with no reset:** `python manage.py migrate` — `0002` and `0003` apply; `python manage.py showmigrations accounts` shows all three. **No `DROP DATABASE` anywhere in this story.**
3. **The seeded roles exist with the right permissions:**

   ```powershell
   python manage.py shell -c "from apps.accounts.models import Role; [print(r.slug, r.is_system, sorted(r.permissions)) for r in Role.objects.all()]"
   ```

   Expect exactly `admin` (3 permissions), `manager` (1), `agent` (0), all `is_system=True`.
4. **`Role.clean()` rejects an unknown permission:**

   ```powershell
   python manage.py shell -c "from apps.accounts.models import Role; r=Role(slug='x',name='X',permissions=['bogus.perm']); r.full_clean()"
   ```

   Must raise `ValidationError` naming `bogus.perm`. Then confirm a **valid** list passes `full_clean()`.
5. **Backend regression:** `python manage.py test` reports **54** passing.
6. **Create the two non-superuser accounts** the remaining steps need:

   ```powershell
   python manage.py shell -c "
   from django.contrib.auth import get_user_model; from apps.accounts.models import Role
   U=get_user_model()
   for email, slug in [('mgr@supportos.local','manager'), ('agent@supportos.local','agent')]:
       u,_=U.objects.get_or_create(email=email, defaults={'role':Role.objects.get(slug=slug)})
       u.role=Role.objects.get(slug=slug); u.set_password('Sup3rSecret!'); u.save()
   print(list(U.objects.values_list('email','role__slug','is_superuser')))
   "
   ```
7. **`/auth/me/` reports role and permissions, per account.** With the server running, log each account in and read `/api/auth/me/`:

   ```powershell
   $t = (curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/ -H "Content-Type: application/json" -d '{\"email\":\"agent@supportos.local\",\"password\":\"Sup3rSecret!\"}' | ConvertFrom-Json).data.access
   curl.exe -s http://127.0.0.1:8000/api/auth/me/ -H "Authorization: Bearer $t"
   ```

   - `agent@` → `role: {slug: "agent", …}`, `permissions: []`
   - `mgr@` → `permissions: ["users.view"]`
   - `admin@` (superuser, **no role**) → `role: null` and **all three** permissions. This is the superuser-agreement check; if `permissions` is `[]` here, `get_permissions` is not using `permissions_for` and the UI would hide controls the API allows.
8. **`HasPermission` actually refuses, and returns the right code.** Build the harness (below), then, for a viewset whose `list` demands `users.view`:
   - No token → **401**, `error.code` = `not_authenticated`.
   - `agent@`'s token → **403**, `error.code` = `permission_denied`.
   - `mgr@`'s token → **200**.
   - `admin@`'s token → **200** (superuser bypass).

   All four bodies must be full envelopes. The 401-vs-403 split is DRF's own logic (`views.py:178–180`) and this step is what confirms it holds with `JWTAuthentication` global.
9. **An unmapped action falls through to authenticated-only.** On the same harness viewset, hit an action **absent** from `permission_map` with `agent@`'s token: expect **200**, not 403. This exercises the documented grant-on-omission branch deliberately.
10. **No ad-hoc role checks on the backend.** From `backend/`:

    ```powershell
    Select-String -Path apps\*\*.py -Pattern "\.role\s*==|is_staff|is_superuser" | Select-String -NotMatch "models.py|admin.py|permissions.py|serializers.py"
    ```

    Every remaining hit must be inside the sanctioned files. A role comparison in a view or a serializer's business logic is the failure this story exists to prevent.
11. **No bespoke role checks on the frontend.** From `frontend/`:

    ```powershell
    Select-String -Path src\**\*.tsx,src\**\*.ts -Pattern "user\.role|is_staff|\.permissions\.includes"
    ```

    Hits are allowed **only** in `src/shared/auth/`. A feature reading `user.role` directly is bypassing `can()`.
12. **The harness is gone.** `git status` shows no harness file and no leftover edit to `HealthPage.tsx`, `router.tsx`, or `api_urls.py`.
13. **The full frontend gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

**The harness** (the same throwaway pattern stories 06 and 07 used). Create `backend/apps/core/scratch_views.py` with a `BaseModelViewSet` subclass over `accounts.Role` — a real model with real data, so no fixture is needed:

```python
# TEMP: Story 09 verification harness — DELETE before committing.
from apps.accounts.models import Role
from apps.accounts.serializers import RoleSerializer

from .permissions import Permissions
from .views import BaseModelViewSet


class ScratchRoleViewSet(BaseModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    # `retrieve` deliberately omitted — Verification Step 9 uses it.
    permission_map = {"list": Permissions.USERS_VIEW}
```

Register it in `config/api_urls.py` with a DRF router at `scratch/roles/`, walk Steps 8–9, then **delete the file, the router registration, and the import.** A committed fixture with no consumer is the dumping-ground failure `apps/README.md` exists to prevent.

For the frontend half of the harness, temporarily render inside `HealthPage`:

```tsx
<Can permission="users.view" fallback={<p>{'no users.view'}</p>}>
  <p>{'has users.view'}</p>
</Can>
```

Log in as `agent@` (fallback shows) and `mgr@` (children show), confirming `can()` agrees with Step 8's HTTP results for the same accounts. Then delete it.

---

## Done Criteria

- [ ] `apps/core/permissions.py` exists with `Permissions`, `ALL_PERMISSIONS`, `permissions_for`, and `HasPermission`; it imports **no** models and no app package.
- [ ] `accounts.Role` exists (`slug` unique, `name`, `description`, `permissions` JSON, `is_system`), extends `TimeStampedModel`, and `clean()` rejects any string outside `ALL_PERMISSIONS`.
- [ ] `User.role` is an FK to `Role`, `null=True`, **`on_delete=PROTECT`**; `User`'s docstring no longer promises the role field as future work.
- [ ] Two migrations committed: the schema one, and `0003_seed_roles` seeding `admin`/`manager`/`agent` with `is_system=True` via `update_or_create` (re-runnable).
- [ ] **No database reset was required** — both migrations applied forward onto the existing story-08 database.
- [ ] `BaseModelViewSet` carries `permission_classes = [IsAuthenticated, HasPermission]` and a `permission_map` default, with a docstring stating that an unmapped action is authenticated-only rather than forbidden.
- [ ] `DEFAULT_PERMISSION_CLASSES` is **unchanged** (`AllowAny`), and § 13 explains that as a decision with its condition for changing — not as a leftover TODO.
- [ ] `HealthView` and `ApiNotFoundView` still set `authentication_classes = []` + `permission_classes = [AllowAny]` and are still reachable unauthenticated.
- [ ] `/api/auth/me/` returns nested `role` (`slug`, `name`) and flat `permissions`; `get_permissions` delegates to `permissions_for`, so a **superuser gets every permission** (Verification Step 7).
- [ ] Django admin registers `Role` (system roles undeletable, `slug` read-only when `is_system`) and `UserAdmin`'s change form includes `role`; `add_fieldsets` is unchanged from story 08.
- [ ] `AuthUser` gains `role: AuthRole | null` and `permissions: string[]`; `AuthContextValue` gains `can`.
- [ ] `shared/auth/permissions.ts` exports `hasPermission`, reading `user.permissions` and **never** deriving from `user.role`.
- [ ] `Can` and `RequirePermission` exist and are exported from `shared/auth/index.ts`; `RequirePermission` redirects to `/` on a permission miss and to `/login` when unauthenticated.
- [ ] `ApiRequestError.isForbidden` exists and is **separate** from `isAuth`; no new entry in `API_ERROR_CODES`, and **no change to either `errors.json`**.
- [ ] **No change to `client.ts`'s interceptors** — verified that a 403 and a 401 `not_authenticated` both correctly bypass AUTH-1's `token_not_valid`-only refresh path.
- [ ] Verified by real HTTP: no token → 401 `not_authenticated`; `agent@` → 403 `permission_denied`; `mgr@` → 200; `admin@` → 200 (Step 8). An unmapped action with `agent@` → 200 (Step 9).
- [ ] `can()` in the browser agrees with those HTTP results for the same two accounts.
- [ ] No role comparison outside `models.py`/`admin.py`/`permissions.py`/`serializers.py` on the backend (Step 10); no `user.role`/`permissions.includes` outside `src/shared/auth/` on the frontend (Step 11).
- [ ] `ScratchRoleViewSet`, its router registration, and the `HealthPage` `<Can>` block are all deleted; `git status` is clean of them.
- [ ] `CONVENTIONS.md` § 13 rewritten (AUTH-2 no longer "not planned"; the `AllowAny` note narrowed to non-viewset views) and `## 22. Authorization (roles & permissions)` **appended, with §0–§21 unrenumbered**. § 22 covers: the code-vocabulary / data-mapping split and the SEC-2 reason for it; why permissions not roles are what views declare; the `permission_map` convention with a copyable example; grant-on-omission stated as a rule; the superuser bypass and why `/me/` must mirror it; `Role.clean()` guarding forms but not programmatic writes; renaming a permission being a data migration; `has_object_permission` named as the extension point; and the query-cache forward constraint.
- [ ] `frontend/src/README.md` § Authentication extended for `permissions.ts`, `Can`, `RequirePermission`, and § Related specs cites § 22; root `README.md` § Environment variables **unchanged**.
- [ ] Root `README.md` § Error codes gains the **`token_not_valid` | 401** row story 08 left out — the one doc gap this story fixes in passing.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `00-overview.md` updated with this story, and EPIC 2 marked complete.

**STOP HERE. Report to the user and wait for confirmation. This completes EPIC 2 — `AUTHZ` is now whole (AUTH-1 authentication + AUTH-2 authorization). The next planned story is the start of EPIC 3 (Customer Management, CUST-1), which will be the first real consumer of `BaseModelViewSet`, `permission_map`, `DataTable`, and the form pattern all at once.**
