# Story 53 — System Configuration (Story: SUPPORTOS-75)

## Prerequisites

- **Story 48 (`SEC-1`), Story 49 (`SEC-2`), Story 52 (`SEC-3`) completed and implemented.** This story reuses the same authorization mechanism (`Permissions`, `HasPermission`, `permission_map`) and the same admin-only-permission grant-migration shape those stories established — no new authorization mechanism.
- **`apps/organization` is an untouched `startapp` scaffold today** — verified by reading every file in it: `models.py` is one comment line (`# Create your models here.`), `admin.py`/`views.py` are each one comment line, `migrations/` holds only `__init__.py`. It is already registered in `INSTALLED_APPS` (`backend/config/settings/base.py:58`, `"apps.organization",`, present since Story 01) and already has a correct `apps.py` (`name = "apps.organization"`). This is the first story to put real code in it.
- **`backend/apps/README.md`'s own app table (line 67) already names `organization`'s job**: *"Tenant/company records, teams, org-level settings."* This story is the first to actually build the "org-level settings" third of that promise — no new app, no README edit, per the same "belongs to exactly one business area → that app" placement rule Story 52 cited for `AuditLog`.
- **The intake's exact wording is "Settings model + admin UI"** (singular "model"), unlike Story 48's "User/role admin **API + UI**" (explicit two-surface title) — but this epic's own established norm (Stories 48/49/52, all building real API + frontend screens) is the stronger, closer precedent than the unrelated `sla-automation` epic's "config UI = Django admin only" pattern (`SLAPolicyAdmin`/`AssignmentRuleAdmin`/`EscalationRuleAdmin`, each citing the prior one — `.squad/plans/sla-automation/28-story-response-resolution-targets-SUPPORTOS-50.md:12`). This story builds a real `GET`/`PATCH` API endpoint plus a frontend settings screen, matching its own epic's pattern, **and** still registers a Django-admin fallback (`OrganizationSettingsAdmin`, task 5) — the same "both surfaces exist" choice Stories 48/49/52 made for `Role`/`User`/`AuditLog`.
- **Verified: no "department" or "branch" concept exists anywhere in this codebase.** Grepped `backend/apps/**/*.py` for `department`/`branch` (case-insensitive, excluding migrations) — the only matches (`core/exceptions.py`, `knowledge_base/views.py`, `tickets/assignment.py`) are unrelated words inside comments/control-flow (a coincidental substring match, not a domain concept). This story introduces both as configuration-only string lists with **no other model referencing them yet** — see `## Story Goal`, "Explicitly out of scope."
- **Verified: `Role.permissions` (`backend/apps/accounts/models.py:56`) is the direct, already-established precedent for "a list of strings that does not need its own table today"**: `models.JSONField(default=list, blank=True)`, validated both in `Role.clean()` (model) and `RoleAdminSerializer.validate_permissions` (serializer) — the same split this story's own `departments`/`branches` validation follows. Two brand-new normalized tables (`Department`, `Branch`) with zero consumers would be the kind of speculative structure `Role.permissions`'s own history argues against.
- **Verified: `apps/sla/policy.py::resolve_policy`** (read in full) resolves an `SLAPolicy` in two tiers today — an exact `(priority, category)` match, then a `(priority, category=None)` default — returning `None` when neither exists, which `compute_sla_status` (same file, lines 51-58) treats as "no SLA tracking for this ticket," rendered by `TicketSlaSection.tsx` (`frontend/src/features/tickets/components/TicketSlaSection.tsx:37-38`) as a plain "no policy" message, not an error. This story adds a **third, org-wide fallback tier** — see `## Story Goal` — making "SLA defaults" a real, wired feature rather than an inert settings field.
- **Verified: `compute_sla_status` (`apps/sla/policy.py:51-93`) reads only `policy.response_target_minutes`, `policy.resolution_target_minutes`, and `policy.id` (line 86, for the response's `policy_id`) off whatever `resolve_policy` returns** — nothing else. An **unsaved** `SLAPolicy(...)` instance (never `.save()`d) therefore works as a synthetic fallback with zero risk: `.id` reads `None` on an unsaved instance, which correctly signals "this came from the org default, not a configured policy row."
- **Verified: `frontend/src/features/tickets/types/ticketSla.ts`'s `TicketSla.policy_id` is currently typed `number`, not `number | null`** — this story's `resolve_policy` change makes a `null` `policy_id` a real, reachable value for the first time, so this type must widen (task 10).
- **Verified: no file-upload field is ever combined with a `JSONField` in one request anywhere in this codebase.** The only existing multipart upload, `frontend/src/features/customers/api/uploadAttachment.ts` (read in full), sends exactly two `FormData` fields — a stringified id and one `File` — via `Content-Type: undefined` to bypass axios's default JSON serialization (`Story 21 ## Prerequisites`, cited in that file's own comment). DRF's `JSONField.to_internal_value` does not parse a raw multipart string back into a list, so combining an uploaded logo file with this story's `departments`/`branches` array fields in one `PATCH` would need an untested, unprecedented parsing path. This story uses `logo_url` (a plain `URLField`), not an uploaded file, keeping `PATCH /api/settings/` a pure `application/json` request — see `## Story Goal` for the explicit scope call.
- **Verified: `frontend/src/shared/validation/schemas.ts` (72 lines, read in full) has `positiveInt(max?)` (a required coerced int) and `nullableEmail()`/`nullableString(max)` (an optional-becomes-`null` text pattern), but no nullable numeric helper.** Task 11 adds `nullablePositiveInt(max?)`, composing the same `z.union([z.literal(''), …]).transform(...)` shape `nullableEmail()` already uses, with `positiveInt`'s own `z.coerce.number().int().min(1)` validator inside the union.
- **Verified: `python manage.py test` currently reports 54 passing** (unchanged since Story 52). This story ships no test file (`CONVENTIONS.md` § 16, standing policy).

---

## Story Goal

Give the organization one admin-configurable settings record — display name, a logo URL, a list of department names, a list of branch names, and default SLA response/resolution targets — readable and editable through a real API endpoint and a new frontend screen, plus a Django-admin fallback. The SLA defaults are not inert: `apps/sla/policy.py::resolve_policy` consults them as a final fallback tier when no `SLAPolicy` row matches a ticket's priority/category at all, so a freshly-seeded system with zero configured `SLAPolicy` rows can still show *some* SLA status the moment an admin fills in the two default-minutes fields.

### The `OrganizationSettings` model — a singleton

**File: `backend/apps/organization/models.py`** — replace the one-line stub with:

```python
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


def _validate_string_list(value, field_name: str) -> None:
    if not isinstance(value, list):
        raise ValidationError({field_name: _("Must be a list of strings.")})
    if any(not isinstance(item, str) or not item.strip() for item in value):
        raise ValidationError({field_name: _("Every entry must be a non-empty string.")})


class OrganizationSettings(TimeStampedModel):
    """The one organization-wide settings record — SEC-4's "central
    configurable settings" backing branding, department/branch lists, and
    SLA defaults. A singleton: `load()` is the only supported way to get an
    instance, `save()` forces `pk=1`, and `delete()` is a no-op — the same
    "there is exactly one relevant row" shape `MeView`
    (apps/accounts/views.py:44-52) already established for a per-user
    singleton, generalized here to a per-deployment one. This is the first
    singleton model in this codebase; no third-party package (e.g.
    `django-solo`) is installed, so this is a small, self-contained
    implementation of the well-known "pk=1" pattern rather than a new
    dependency.

    `departments`/`branches` are `JSONField(default=list)` string lists,
    not separate `Department`/`Branch` tables — the same "a list of
    strings that doesn't need its own table today" call `Role.permissions`
    (apps/accounts/models.py:56) already made. Nothing else in this
    codebase references an individual department or branch yet; see this
    story's own `## Story Goal`, "Explicitly out of scope."

    `logo_url` is a plain URL, not an uploaded file — see `## Prerequisites`
    for why combining a file upload with this model's JSON list fields in
    one request would need an unprecedented parsing path in this codebase.
    """

    name = models.CharField(_("organization name"), max_length=150, blank=True)
    logo_url = models.URLField(_("logo URL"), max_length=500, blank=True)
    departments = models.JSONField(_("departments"), default=list, blank=True)
    branches = models.JSONField(_("branches"), default=list, blank=True)
    # Mirrors `SLAPolicy.response_target_minutes`/`resolution_target_minutes`
    # (apps/sla/models.py) exactly, but nullable: unlike a configured
    # `SLAPolicy` row (which always has both), the org-wide default is
    # opt-in — an admin who never fills these in gets exactly today's
    # behaviour (`resolve_policy` falling through to `None`).
    default_response_target_minutes = models.PositiveIntegerField(
        _("default response target (minutes)"), null=True, blank=True
    )
    default_resolution_target_minutes = models.PositiveIntegerField(
        _("default resolution target (minutes)"), null=True, blank=True
    )

    class Meta:
        verbose_name = _("organization settings")
        verbose_name_plural = _("organization settings")

    def __str__(self) -> str:
        return str(_("Organization settings"))

    def clean(self) -> None:
        """Guards the Django-admin form path — DRF does not call model
        `clean()`, so `OrganizationSettingsSerializer` (task 3) repeats
        this logic for the API path, the same split `Role.clean()`/
        `RoleAdminSerializer.validate_permissions` already establishes
        (CONVENTIONS.md § 22).
        """
        super().clean()
        _validate_string_list(self.departments, "departments")
        _validate_string_list(self.branches, "branches")
        if (
            self.default_response_target_minutes is not None
            and self.default_resolution_target_minutes is not None
            and self.default_resolution_target_minutes < self.default_response_target_minutes
        ):
            raise ValidationError(
                {
                    "default_resolution_target_minutes": _(
                        "Must be at least the default response target."
                    )
                }
            )

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        # There is nothing sensible for "delete the organization's
        # settings" to mean — the row is recreated with defaults on the
        # next `load()` anyway. A silent no-op, not an exception: mirrors
        # `RoleViewSet.destroy`'s "reject, do not 500" posture without
        # needing a view-layer guard, since there is no destroy action at
        # all (task 4).
        pass

    @classmethod
    def load(cls) -> "OrganizationSettings":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj
```

### Explicitly out of scope

- **No `Department`/`Branch` model, and no field on `User`/`Customer`/`Ticket` referencing one.** The intake says "backs branding/departments/branches/SLA defaults" — read as four **configuration categories** one settings record holds, not four new relational entities other models must adopt. Wiring a user or customer to a department/branch is a future story's job once something actually needs it, the same "ship the config, wire it in later" restraint `Role.permissions` itself demonstrates (validated against a fixed vocabulary, but nothing forces every `User` to declare one).
- **No logo file upload.** See `## Prerequisites`'s multipart/`JSONField` reasoning. `logo_url` accepts any URL, including one pointing at a file the admin uploaded through some other means (e.g. a public image host) — this story does not build that means.
- **No consumption of `name`/`logo_url` in the app shell.** `Sidebar.tsx`'s `t('app.name')` (`frontend/src/app/Sidebar.tsx:105`) is untouched — wiring the configured org name/logo into the header is a future story's job; this one ships the config screen only, the intake's literal "Settings model + admin UI," not "and use it everywhere branding appears."
- **No change to `SLAPolicy`, `AssignmentRule`, or `EscalationRule`.** Those stay exactly as Story 28/29/30 left them (Django-admin-only, category-scoped). This story's SLA defaults are a **new, additional, lower-priority fallback tier** underneath them, not a replacement.
- **Automated tests.** Standing policy (§ 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-75/intake.md` — one task block, no attachments, no acceptance criteria. Done Criteria derive from *"Settings model + admin UI (backs branding/departments/branches/SLA defaults) — Implement central configurable settings"* and *"Outcome: org-level configuration."*
2. `backend/apps/organization/{models,admin,views}.py` (each one line today) and `backend/apps/organization/migrations/` (only `__init__.py`) — confirm the empty-scaffold starting state before writing task 0/5/6/7.
3. `backend/apps/accounts/models.py:41-87` (`Role`, especially `permissions = models.JSONField(...)` at line 56 and `clean()` at lines 69-86) — the direct precedent for `departments`/`branches` as validated JSON string lists, not new tables.
4. `backend/apps/sla/models.py:1-66` (`SLAPolicy`, read in full) — `response_target_minutes`/`resolution_target_minutes` field shapes (lines 27-34) and `clean()`'s response-vs-resolution ordering check (lines 50-66), the exact pattern `OrganizationSettings.clean()` mirrors for its own default-minutes pair.
5. `backend/apps/sla/policy.py` (94 lines, read in full) — `resolve_policy` (lines 22-32) and `compute_sla_status` (lines 51-93, especially line 86's `"policy_id": policy.id`). Task 8 adds a third fallback tier to `resolve_policy`; `compute_sla_status` itself does not change.
6. `backend/apps/accounts/views.py:44-52` (`MeView`) and `backend/apps/core/views.py:90-111` (`PermissionCatalogView`) — the two precedents `SettingsView` (task 4) combines: "there is exactly one relevant object, expose it at a fixed URL with no id in the path" (`MeView`) plus "a plain `APIView` with a method-keyed `permission_map`" (`PermissionCatalogView`).
7. `backend/apps/accounts/serializers.py:20-70` (`RoleAdminSerializer`, especially `validate_permissions` at lines 121-136 of the now-implemented Story 49 file) — the exact `validate_<field>` + `serializers.ValidationError` shape task 3's `validate_departments`/`validate_branches` copy.
8. `backend/apps/core/permissions.py` — `Permissions` (18-36, eleven constants as of Story 52; task 2 appends a twelfth), `ALL_PERMISSIONS` (picked up by reflection, no edit needed).
9. `backend/apps/tickets/migrations/0002_grant_ticket_permissions.py` and `backend/apps/accounts/migrations/0006_grant_audit_log_permission.py` (both read in full) — the exact `GRANTS = {slug: [permissions]}` grant-migration shape task 7's new migration copies, scoped to `{"admin": [Permissions.SETTINGS_MANAGE]}`.
10. `backend/config/api_urls.py` (25 lines, read in full) — one new `include()` line, placed after `apps.accounts.admin_urls` and before `apps.customers.urls`.
11. `frontend/src/features/tickets/types/ticketSla.ts` (full file, 12 lines) — `policy_id: number` widens to `number | null` (task 10).
12. `frontend/src/shared/validation/schemas.ts` (72 lines, read in full) — `positiveInt` (57-61) and `nullableEmail` (50-55), the two building blocks task 11's `nullablePositiveInt` combines.
13. `frontend/src/features/customers/components/CustomerFormPage.tsx` — the `nullableEmail()`/`toDefaults`/`toInput` round-trip (`customer.email ?? ''` on the way in, the schema's own `'' → null` transform on the way out) task 13's default-minutes fields copy exactly.
14. `frontend/src/features/accounts/components/RoleFormPage.tsx` (full file, 219 lines, read this session) — the `FormField` render-prop composition for `permissions: string[]` (lines 176-208), the direct precedent for task 13's `departments`/`branches` list editor (a different UI — free-text add/remove, not a fixed checklist — but the same "bind an array directly via `FormField`, do not reach for `useFieldArray`" convention, since `useFieldArray` appears nowhere in this codebase).
15. `frontend/src/shared/ui/primitives/badge.tsx` (49 lines, read in full) — plain `<Badge>`, no built-in dismiss button; task 13 composes one manually (a `Badge` plus an inline icon button), not a new shared "removable badge" primitive, since this story has exactly one consumer.
16. `frontend/src/app/router.tsx` and `frontend/src/app/Sidebar.tsx` — the `RequirePermission permission="audit_log.view"` block and its sibling `<Can permission="audit_log.view">` `SidebarLink` (both added by Story 52) are the direct siblings tasks 15/16 add a new `settings.manage`-gated block/link next to.
17. `frontend/src/shared/i18n/resources.ts` — the explicit two-import-plus-two-map-entries-per-feature registration pattern task 17 follows for the new `organization` namespace.
18. `CONVENTIONS.md` § 20 (Forms & validation) and § 23 (Feature module conventions) — read both before tasks 11/18; task 18 appends one entry to § 23 documenting the singleton-model pattern.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Settings model backs branding/departments/branches/SLA defaults.** | Intake | One `OrganizationSettings` singleton (task 0) with `name`/`logo_url` (branding), `departments`/`branches` (JSON string lists), `default_response_target_minutes`/`default_resolution_target_minutes` (SLA defaults). |
| **Central configurable settings.** | Intake | A single `GET`/`PATCH /api/settings/` endpoint (task 4) and one frontend `SettingsPage` (task 13) — no per-category screens. |
| **Admin UI.** | Intake | Gated end to end by a new `Permissions.SETTINGS_MANAGE` (task 2), granted to the seeded `admin` role only (task 7) — the same admin-only posture `ROLES_MANAGE`/`AUDIT_LOG_VIEW` already have. |
| **Outcome: org-level configuration.** | Intake | SLA defaults are not inert: `resolve_policy` (task 8) actually falls through to them, so the setting has a real, observable effect on `GET /api/tickets/<id>/sla/`. |
| **The backend owns authorization; the frontend check is UX only.** | § 12, § 22 | The screen is reachable only via the `settings.manage`-gated `/settings` route (task 15); `SettingsView.permission_map` independently re-authorizes every request. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 0 — The `OrganizationSettings` model

**File: `backend/apps/organization/models.py`** — replace the stub with the full class from `## Story Goal`.

---

### 1 — Generate and verify the migration

Run `python manage.py makemigrations organization` from `backend/`. This is the app's **first-ever** migration (`0001_initial.py`) — verify the generated `CreateModel` matches task 0's field list exactly (in particular, `departments`/`branches` as `JSONField(default=list, blank=True)` and both `default_*_target_minutes` as `PositiveIntegerField(null=True, blank=True)`) before treating it as final. Do not hand-write it.

---

### 2 — `Permissions.SETTINGS_MANAGE`

**File: `backend/apps/core/permissions.py`** — one new constant, appended after `AUDIT_LOG_VIEW` (Story 52's own addition), per the file's own *"every feature story appends its own"* rule:

```python
    AUDIT_LOG_VIEW = "audit_log.view"
    SETTINGS_MANAGE = "settings.manage"
```

`ALL_PERMISSIONS` needs no edit — reflection picks up the new constant automatically.

---

### 3 — The settings serializer

**Create file: `backend/apps/organization/serializers.py`**

```python
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import OrganizationSettings


class OrganizationSettingsSerializer(BaseModelSerializer):
    """Read/write over the one `OrganizationSettings` row. `validate_departments`/
    `validate_branches` mirror `OrganizationSettings.clean()`'s own list-of-
    strings check for the API path — DRF does not call model `clean()`, the
    same split `RoleAdminSerializer.validate_permissions`/`Role.clean()`
    already establishes (CONVENTIONS.md § 22).
    """

    class Meta(BaseModelSerializer.Meta):
        model = OrganizationSettings
        fields = (
            "id",
            "name",
            "logo_url",
            "departments",
            "branches",
            "default_response_target_minutes",
            "default_resolution_target_minutes",
            "created_at",
            "updated_at",
        )

    def _validate_string_list(self, value, field_name: str):
        if not isinstance(value, list):
            raise serializers.ValidationError(_("Must be a list of strings."))
        if any(not isinstance(item, str) or not item.strip() for item in value):
            raise serializers.ValidationError(_("Every entry must be a non-empty string."))
        return value

    def validate_departments(self, value):
        return self._validate_string_list(value, "departments")

    def validate_branches(self, value):
        return self._validate_string_list(value, "branches")

    def validate(self, attrs):
        response = attrs.get(
            "default_response_target_minutes",
            getattr(self.instance, "default_response_target_minutes", None),
        )
        resolution = attrs.get(
            "default_resolution_target_minutes",
            getattr(self.instance, "default_resolution_target_minutes", None),
        )
        if response is not None and resolution is not None and resolution < response:
            raise serializers.ValidationError(
                {
                    "default_resolution_target_minutes": [
                        _("Must be at least the default response target.")
                    ]
                }
            )
        return attrs
```

`validate()` reads the **incoming** value from `attrs` when present, falling back to the **current** instance's value otherwise — this is what makes a `PATCH` that only sends `default_response_target_minutes` still validate correctly against the already-stored `default_resolution_target_minutes`, and vice versa. `self.instance` is always set here: `SettingsView` (task 4) never instantiates this serializer without one.

---

### 4 — The `SettingsView`

**File: `backend/apps/organization/views.py`** — replace the stub with:

```python
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions

from .models import OrganizationSettings
from .serializers import OrganizationSettingsSerializer


class SettingsView(APIView):
    """The one organization-wide settings record. `GET`/`PATCH` only, no
    id in the path — the same "there is exactly one relevant object" shape
    `MeView` (apps/accounts/views.py:44-52) already established, keyed by
    lowercased HTTP method rather than a DRF `action` the same way
    `PermissionCatalogView` (apps/core/views.py) is for a plain `APIView`.
    Any other verb 405s via Django's own `http_method_not_allowed` — only
    `get`/`patch` are defined, no `http_method_names` override needed.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"get": Permissions.SETTINGS_MANAGE, "patch": Permissions.SETTINGS_MANAGE}

    def get(self, request):
        return Response(OrganizationSettingsSerializer(OrganizationSettings.load()).data)

    def patch(self, request):
        settings_obj = OrganizationSettings.load()
        serializer = OrganizationSettingsSerializer(
            settings_obj, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
```

**Create file: `backend/apps/organization/urls.py`**

```python
from django.urls import path

from .views import SettingsView

app_name = "organization"

urlpatterns = [
    path("settings/", SettingsView.as_view(), name="settings"),
]
```

**File: `backend/config/api_urls.py`** — one new `include()`, after `apps.accounts.admin_urls` and before `apps.customers.urls`:

```python
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    path("", include("apps.accounts.admin_urls")),
    path("", include("apps.organization.urls")),
    path("", include("apps.customers.urls")),
```

Endpoint: `GET /api/settings/`, `PATCH /api/settings/`.

---

### 5 — Django admin registration (singleton-aware)

**File: `backend/apps/organization/admin.py`** — replace the stub with:

```python
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import reverse

from .models import OrganizationSettings


@admin.register(OrganizationSettings)
class OrganizationSettingsAdmin(admin.ModelAdmin):
    """A singleton admin — `has_add_permission` refuses a second row, and
    `changelist_view` skips straight to the one row's change form via
    `OrganizationSettings.load()`, so visiting the changelist never shows
    an "Add" button next to an empty list the way a normal model would.
    Coexists with `SettingsView` (the primary UI per this story's own
    intake wording "admin UI") the same way `RoleAdmin`/`UserAdmin`
    coexist with SEC-1/2's frontend.
    """

    readonly_fields = ("created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return not OrganizationSettings.objects.exists()

    def has_delete_permission(self, request, obj=None) -> bool:
        return False

    def changelist_view(self, request, extra_context=None):
        obj = OrganizationSettings.load()
        return redirect(
            reverse("admin:organization_organizationsettings_change", args=[obj.pk])
        )
```

---

### 6 — Wire SLA defaults into `resolve_policy`

**File: `backend/apps/sla/policy.py`** — extend the import line and `resolve_policy`:

```python
from apps.organization.models import OrganizationSettings
```

```python
def resolve_policy(ticket: Ticket) -> SLAPolicy | None:
    """The most specific policy for this ticket: an exact
    (priority, category) match if the ticket has a category and one
    exists, else the priority-only default (category=None), else the
    org-wide default from `OrganizationSettings` (SEC-4) if one is
    configured. `None` only when none of the three apply — SLA tracking
    remains opt-in, not guaranteed for every ticket.
    """
    if ticket.category_id is not None:
        specific = SLAPolicy.objects.filter(
            priority=ticket.priority, category_id=ticket.category_id
        ).first()
        if specific is not None:
            return specific
    default = SLAPolicy.objects.filter(priority=ticket.priority, category__isnull=True).first()
    if default is not None:
        return default
    return _org_default_policy()


def _org_default_policy() -> SLAPolicy | None:
    """An UNSAVED `SLAPolicy` built from `OrganizationSettings`'s two
    default-minutes fields, or `None` if either is unset. Never
    `.save()`d: `compute_sla_status` (below) only ever reads
    `.response_target_minutes`/`.resolution_target_minutes` off whatever
    `resolve_policy` returns, plus `.id` for the response's `policy_id` —
    `None` on an unsaved instance, which correctly tells a caller this
    came from the org default, not a configured `SLAPolicy` row. See this
    story's own `## Prerequisites`.
    """
    settings_obj = OrganizationSettings.load()
    if (
        settings_obj.default_response_target_minutes is None
        or settings_obj.default_resolution_target_minutes is None
    ):
        return None
    return SLAPolicy(
        response_target_minutes=settings_obj.default_response_target_minutes,
        resolution_target_minutes=settings_obj.default_resolution_target_minutes,
    )
```

`compute_sla_status` (same file) is **unchanged** — it already handles a `None` `policy.id` correctly, since it only ever reads it into the response dict, never dereferences it further.

No import cycle: `apps.sla.policy` already imports across apps (`apps.communications.models`, `apps.tickets.models`, per this file's own module docstring, lines 1-11); `apps.organization.models` has no reverse import of `apps.sla`, verified by this story's own task 0 (its only imports are `django.core.exceptions`, `django.db`, `django.utils.translation`, `apps.core.models`).

---

### 7 — Grant migration

**Create file: `backend/apps/organization/migrations/0002_grant_settings_permission.py`** — copies `backend/apps/accounts/migrations/0006_grant_audit_log_permission.py`'s exact shape:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: org-level configuration (branding, departments, branches,
# SLA defaults) is the same class of sensitive, infrequent, admin-facing
# change `Permissions.ROLES_MANAGE`/`AUDIT_LOG_VIEW` already restrict to
# `admin` alone. See the plan's `## Prerequisites`.
GRANTS = {
    "admin": [Permissions.SETTINGS_MANAGE],
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
        ("organization", "0001_auditlog"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

Fix the first `dependencies` entry to the **actual** generated name from task 1 (almost certainly `("organization", "0001_initial")` — `0001_auditlog` above is a placeholder typo to catch during review; verify against the real filename before running).

---

## Migration / Rollback

**Two migrations in `backend/apps/organization/migrations/`**, mirroring the schema-then-grant split Story 52 used within `apps/accounts`:

- **`0001_initial.py`** (schema, task 1, autogenerated) — `CreateModel` for `OrganizationSettings`.
- **`0002_grant_settings_permission.py`** (data, task 7, hand-written) — grants `settings.manage` to `admin`.

**Rollback of the code:** revert the commits, then `python manage.py migrate organization zero` to unwind both (the data migration's `revoke` runs first, then the schema migration drops the table). No `npm install`/`pip install` — no new dependency.

**Half-applied states to avoid:**

- **Task 6 (`resolve_policy`'s import of `OrganizationSettings`) before task 1's migration is applied** → `apps.organization.models.OrganizationSettings` still imports fine (Python import, not a query) even with no table yet; only *calling* `OrganizationSettings.load()` before migrating fails with `ProgrammingError: relation does not exist`. Migrate before starting the dev server or running any ticket-SLA request.
- **Task 4 (`SettingsView`) before task 3 (the serializer)** → `NameError` on `OrganizationSettingsSerializer`. Not a real risk in a single implementation pass.
- **The grant migration (0002) run against a fresh database with no `admin` role yet** → `Role.objects.filter(slug="admin").first()` returns `None`, and the `if role is None: continue` guard (copied from Story 52's own migration) skips it silently rather than raising — the grant becomes a no-op until `0003_seed_roles` (accounts) has actually run. The `dependencies` entry `("accounts", "0003_seed_roles")` (task 7) prevents this ordering from ever occurring in practice.

---

## Frontend Tasks

### 8 — Feature folder and types

**Create directory: `frontend/src/features/organization/`** (a new feature, matching the backend app name — the same one-feature-folder-per-Django-app-when-a-screen-exists convention `features/accounts` already follows for `apps.accounts`).

**Create file: `frontend/src/features/organization/types/settings.ts`**

```ts
/** Mirrors `apps.organization.serializers.OrganizationSettingsSerializer`'s
 * read shape. */
export type OrganizationSettings = {
  id: number
  name: string
  logo_url: string
  departments: string[]
  branches: string[]
  default_response_target_minutes: number | null
  default_resolution_target_minutes: number | null
  created_at: string
  updated_at: string
}

/** The write shape — no `id`/`created_at`/`updated_at`, all server-managed. */
export type SettingsInput = {
  name: string
  logo_url: string
  departments: string[]
  branches: string[]
  default_response_target_minutes: number | null
  default_resolution_target_minutes: number | null
}
```

---

### 9 — API hooks

**Create file: `frontend/src/features/organization/api/settingsKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const settingsKeys = featureKey('settings')
```

**Create file: `frontend/src/features/organization/api/getSettings.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { OrganizationSettings } from '../types/settings'

export function getSettings(): Promise<OrganizationSettings> {
  return api.get<OrganizationSettings>('/settings/')
}
```

**Create file: `frontend/src/features/organization/api/useSettings.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { getSettings } from './getSettings'
import { settingsKeys } from './settingsKeys'

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.resource('detail'),
    queryFn: getSettings,
  })
}
```

**Create file: `frontend/src/features/organization/api/updateSettings.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { OrganizationSettings, SettingsInput } from '../types/settings'

export function updateSettings(input: SettingsInput): Promise<OrganizationSettings> {
  return api.patch<OrganizationSettings>('/settings/', input)
}
```

**Create file: `frontend/src/features/organization/api/useUpdateSettings.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { updateSettings } from './updateSettings'
import { settingsKeys } from './settingsKeys'
import type { SettingsInput } from '../types/settings'

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SettingsInput) => updateSettings(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.all }),
  })
}
```

Copies `frontend/src/features/accounts/api/{roleKeys,getRole,useRole,updateRole,useRoleMutations}.ts`'s shapes exactly, adapted for a singleton (no `id` parameter anywhere).

---

### 10 — Widen `TicketSla.policy_id`

**File: `frontend/src/features/tickets/types/ticketSla.ts`** — one type change:

```ts
export type TicketSla = {
  policy_id: number | null
  response_target_minutes: number
  resolution_target_minutes: number
  response_due_at: string
  response_status: SlaDimensionStatus
  resolution_due_at: string
  resolution_status: SlaDimensionStatus
} | null
```

Update the file's own leading comment to mention the org-default case:

```ts
/** Mirrors `apps.sla.policy.compute_sla_status`'s return shape. `null`
 * means no `SLAPolicy` applies to this ticket's priority/category — a
 * normal outcome, not missing data. `policy_id: null` (inside a non-null
 * result) means the response came from `OrganizationSettings`'s SLA
 * defaults (SEC-4), not a configured `SLAPolicy` row. */
```

`TicketSlaSection.tsx` needs **no** change — it never reads `policy_id`.

---

### 11 — `nullablePositiveInt` schema helper

**File: `frontend/src/shared/validation/schemas.ts`** — one new function, appended after `positiveInt` (lines 57-61):

```ts
/** A number typed into a text input, for a NULLABLE database column. Empty
 * input becomes `null`, not `undefined` — same '' -> null reasoning as
 * `nullableString`/`nullableEmail`, combined with `positiveInt`'s own
 * coerced validator. */
export function nullablePositiveInt(max?: number) {
  const numberSchema =
    max === undefined
      ? z.coerce.number().int().min(1)
      : z.coerce.number().int().min(1).max(max)
  return z.union([z.literal(''), numberSchema]).transform((value) => (value === '' ? null : value))
}
```

---

### 12 — Locale files

**Create file: `frontend/src/features/organization/locales/en.json`**

```json
{
  "settings": {
    "title": "Organization Settings",
    "saved": "Settings saved.",
    "fields": {
      "name": "Organization name",
      "logoUrl": "Logo URL",
      "departments": "Departments",
      "branches": "Branches",
      "defaultResponseMinutes": "Default response target (minutes)",
      "defaultResolutionMinutes": "Default resolution target (minutes)"
    },
    "addDepartment": "Add department",
    "addBranch": "Add branch",
    "newItemPlaceholder": "Name",
    "remove": "Remove",
    "actions": { "save": "Save" }
  }
}
```

**Create file: `frontend/src/features/organization/locales/ar.json`** — the same key set, translated into Arabic, mirroring `frontend/src/features/accounts/locales/ar.json`'s existing translation style and tone.

---

### 13 — `SettingsPage`

**Create file: `frontend/src/features/organization/components/SettingsPage.tsx`**

```tsx
import { useState } from 'react'
import { PlusIcon, XIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { nullablePositiveInt, optionalString, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Input } from '@/shared/ui/primitives/input'
import { FormField, FormItem, FormLabel } from '@/shared/ui/primitives/form'
import { FormErrorSummary, TextField, useAppForm } from '@/shared/ui/form'
import { Loading } from '@/shared/ui/Loading'
import { PageHeader } from '@/shared/ui/PageHeader'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useSettings } from '../api/useSettings'
import { useUpdateSettings } from '../api/useUpdateSettings'
import type { OrganizationSettings, SettingsInput } from '../types/settings'

const schema = z.object({
  name: optionalString(150).transform((value) => value ?? ''),
  logo_url: optionalString(500).transform((value) => value ?? ''),
  departments: z.array(z.string()),
  branches: z.array(z.string()),
  default_response_target_minutes: nullablePositiveInt(),
  default_resolution_target_minutes: nullablePositiveInt(),
})

type FormValues = z.output<typeof schema>

function toDefaults(settings: OrganizationSettings): FormValues {
  return {
    name: settings.name,
    logo_url: settings.logo_url,
    departments: settings.departments,
    branches: settings.branches,
    default_response_target_minutes: settings.default_response_target_minutes,
    default_resolution_target_minutes: settings.default_resolution_target_minutes,
  }
}

function toSettingsInput(values: FormValues): SettingsInput {
  return { ...values }
}

/**
 * A local, single-consumer "string list" editor — bound directly via
 * `FormField`'s render prop, the same "compose primitives, do not reach for
 * `useFieldArray`" convention `RoleFormPage`'s permissions checklist
 * (Story 49) already established, since `useFieldArray` appears nowhere in
 * this codebase. Not a new `shared/ui/form/` component: this has exactly
 * one consumer today (`SettingsPage`), the same reasoning CONVENTIONS.md
 * § 23 already applies to `TicketConversation` and Story 49's checklist.
 */
function StringListField({
  label,
  addLabel,
  placeholder,
  value,
  onChange,
}: {
  label: string
  addLabel: string
  placeholder: string
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function addItem() {
    const trimmed = draft.trim()
    if (trimmed === '') return
    onChange([...value, trimmed])
    setDraft('')
  }

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div className="flex flex-wrap gap-2">
        {value.map((item, index) => (
          <Badge key={`${item}-${index}`} variant="secondary" className="gap-1">
            {item}
            <button type="button" onClick={() => onChange(value.filter((_, i) => i !== index))}>
              <XIcon className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addItem()
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <PlusIcon />
          {addLabel}
        </Button>
      </div>
    </FormItem>
  )
}

export function SettingsPage() {
  const query = useSettings()
  return (
    <div className="flex flex-col gap-4">
      <QueryBoundary query={query}>{(settings) => <SettingsForm settings={settings} />}</QueryBoundary>
    </div>
  )
}

function SettingsForm({ settings }: { settings: OrganizationSettings }) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const mutation = useUpdateSettings()

  const form = useAppForm({ schema, defaultValues: toDefaults(settings) })

  function onSubmit(values: FormValues) {
    mutation.mutate(toSettingsInput(values), {
      onSuccess: () => toast({ tone: 'success', message: t('settings.saved') }),
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <TextField control={form.control} name="name" label={t('settings.fields.name')} />
              <TextField
                control={form.control}
                name="logo_url"
                label={t('settings.fields.logoUrl')}
              />
              <TextField
                control={form.control}
                name="default_response_target_minutes"
                type="number"
                label={t('settings.fields.defaultResponseMinutes')}
              />
              <TextField
                control={form.control}
                name="default_resolution_target_minutes"
                type="number"
                label={t('settings.fields.defaultResolutionMinutes')}
              />
            </CardContent>
          </Card>
          <FormField
            control={form.control}
            name="departments"
            render={({ field }) => (
              <StringListField
                label={t('settings.fields.departments')}
                addLabel={t('settings.addDepartment')}
                placeholder={t('settings.newItemPlaceholder')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FormField
            control={form.control}
            name="branches"
            render={({ field }) => (
              <StringListField
                label={t('settings.fields.branches')}
                addLabel={t('settings.addBranch')}
                placeholder={t('settings.newItemPlaceholder')}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <FormErrorSummary errors={formErrors} />
          <Button type="submit" disabled={mutation.isPending}>
            {t('settings.actions.save')}
          </Button>
        </form>
      </Form>
    </>
  )
}
```

Add the missing `Form` import: `import { Form } from '@/shared/ui/primitives/form'` (alongside the existing `FormField`/`FormItem`/`FormLabel` import from the same module). `requiredString` is imported but unused in the snippet above if `name`/`logo_url` stay optional — **do not import it**; both fields use `optionalString`, since an organization may reasonably leave its name or logo blank until an admin fills them in (unlike `Role.name`, which is required at creation because a role is meaningless unnamed — a settings row already exists via `load()` regardless of whether these two fields are filled in).

**`Loading` is imported but unused in this version** — `QueryBoundary` already renders its own pending state (the same reasoning every other `QueryBoundary` consumer relies on); remove the unused import during implementation, or confirm `QueryBoundary`'s own contract first (`frontend/src/shared/ui/QueryBoundary.tsx`) if a custom pending UI is wanted instead.

---

### 14 — Route

**File: `frontend/src/app/router.tsx`** — one new `RequirePermission` block, added as a sibling immediately after the `audit_log.view` block Story 52 added:

```tsx
          {
            element: <RequirePermission permission="settings.manage" />,
            children: [
              {
                path: 'settings',
                lazy: async () => {
                  const { SettingsPage } =
                    await import('@/features/organization/components/SettingsPage')
                  return { element: <SettingsPage /> }
                },
              },
            ],
          },
```

---

### 15 — Sidebar nav entry

**File: `frontend/src/app/Sidebar.tsx`** — add `SettingsIcon` to the `lucide-react` import (alphabetically, between `SearchIcon` and `ShieldCheckIcon`), add `'organization'` to the `useTranslation([...])` namespace array, and add a new `<Can>` block immediately after the `audit_log.view` one Story 52 added:

```tsx
        <Can permission="audit_log.view">
          <SidebarLink
            to="/audit-log"
            icon={HistoryIcon}
            label={t('auditLog:title')}
            collapsed={collapsed}
          />
        </Can>
        <Can permission="settings.manage">
          <SidebarLink
            to="/settings"
            icon={SettingsIcon}
            label={t('organization:settings.title')}
            collapsed={collapsed}
          />
        </Can>
```

---

### 16 — Register the new locale namespace

**File: `frontend/src/shared/i18n/resources.ts`** — two new imports (alphabetically, between `notifications` and `portal`) and two new map entries in the same relative position:

```ts
import notificationsAr from '@/features/notifications/locales/ar.json'
import notificationsEn from '@/features/notifications/locales/en.json'
import organizationAr from '@/features/organization/locales/ar.json'
import organizationEn from '@/features/organization/locales/en.json'
import portalAr from '@/features/portal/locales/ar.json'
import portalEn from '@/features/portal/locales/en.json'
```

```ts
    notifications: notificationsEn,
    organization: organizationEn,
    portal: portalEn,
```

(and the mirrored `ar` block).

---

## Documentation Tasks

### 17 — `CONVENTIONS.md` § 23

Append one entry documenting the singleton-model pattern as a worked example for the next feature that needs "exactly one row of this configuration":

```markdown
**A "there is exactly one row" configuration table is a small, self-built
singleton, not a new dependency.** `OrganizationSettings` (Story 53,
`SEC-4`) is this codebase's first singleton model: `save()` forces `pk=1`,
`delete()` is a no-op, and `load()` (`get_or_create(pk=1)`) is the only
supported way to get an instance. No third-party package (e.g.
`django-solo`) is installed for this — the pattern is small enough to
own directly, the same "no new dependency" bias every other story in this
project has followed. `MeView` (Story 08) is the closer-to-hand precedent
for the *API* shape this pairs with: a `GET`/`PATCH` endpoint with no id
in the URL, because there is exactly one relevant object.
```

### 18 — `CONVENTIONS.md` § 20

Append one entry noting the new `nullablePositiveInt` helper:

```markdown
**`nullablePositiveInt(max?)`** (Story 53) is `positiveInt`'s coerced-number
validator combined with `nullableEmail`/`nullableString`'s `'' -> null`
transform — for a nullable numeric database column edited through a text
input, the same shape `OrganizationSettings.default_response_target_minutes`/
`default_resolution_target_minutes` need.
```

Do not renumber § 0-§ 26.

---

## Edge Cases & Failure Modes

- **The settings row does not exist yet on a fresh database** (no seed migration creates it — see `## Prerequisites`, "no premature migration"). The first `GET /api/settings/` after a fresh `migrate` calls `OrganizationSettings.load()`, which `get_or_create(pk=1)`s it with every default (`name=""`, `logo_url=""`, `departments=[]`, `branches=[]`, both SLA defaults `None`) — a 200 with an "empty" settings object, not a 404 or 500.
- **A `PATCH` with `departments: "not-a-list"`** (a hand-crafted request, e.g. a bare string instead of an array) — `validate_departments` raises `serializers.ValidationError`, landing as a `validation_error` field error on `departments`, not a 500.
- **`default_response_target_minutes` sent without `default_resolution_target_minutes` in the same `PATCH`, when the stored resolution value is now smaller than the new response value** — `OrganizationSettingsSerializer.validate()`'s fallback-to-`self.instance` read (task 3) catches this: the comparison uses the *stored* resolution value when the request omits it, so the invariant is enforced across partial updates, not just full ones.
- **Clearing a default to "no SLA default"**: sending `"default_response_target_minutes": null` explicitly clears it (DRF's `PositiveIntegerField(allow_null=True)`, derived from the model's own `null=True`); omitting the key leaves it unchanged — the same "omission ≠ clearing" rule `CONVENTIONS.md` § 23 already documents for nullable fields (Story 49's own edge case list makes the identical point for `permissions`).
- **A ticket's priority/category has no `SLAPolicy` row AND the org defaults are only half-configured** (e.g. `default_response_target_minutes` set, `default_resolution_target_minutes` still `None`) — `_org_default_policy()` returns `None` in this case (both-or-nothing), so `compute_sla_status` still returns `None` rather than fabricating a policy with an undefined resolution target.
- **Deleting the settings row via `OrganizationSettings.objects.all().delete()` in a shell** (bypassing the model's own `.delete()` no-op, since a QuerySet's bulk `.delete()` does not call the instance method) — the next `load()` simply recreates it with defaults; no code path anywhere assumes the row, once created, can never disappear.
- **Two concurrent `PATCH /api/settings/` requests** — the last write wins, the same "no optimistic locking anywhere in this project" posture every other admin-editable model already has (`Role`, `User`); not a new gap this story introduces.
- **A `departments`/`branches` entry containing only whitespace** (e.g. `"   "`) — `_validate_string_list`'s `not item.strip()` check rejects it as not "a non-empty string," the same trim-then-check discipline `requiredString`'s `.trim().min(1)` already applies on the frontend.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check`, `python manage.py makemigrations --check --dry-run` (confirms task 0's model is fully captured by the two new migrations), `python manage.py migrate`.
2. `python manage.py test` reports **54** passing — unchanged.
3. `ruff format --check .` / `ruff check .` on the changed Python.
4. `npm run build` — typechecks the new `OrganizationSettings`/`SettingsInput` types, the widened `TicketSla.policy_id`, and `nullablePositiveInt`'s inferred return type.
5. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
6. The `en`/`ar` key-set comparison, extended to cover the new `organization` namespace.
7. Real HTTP, using `admin@supportos.local` (superuser) and `agent@supportos.local` (holds neither `settings.manage`):
   - `GET /api/settings/` with no token → 401; as `agent@` → 403; as `admin@` → 200 with all-default values on a fresh database.
   - `PATCH /api/settings/` as `admin@` with `{"name": "Acme Support", "departments": ["Sales", "Support"]}` → 200, and a follow-up `GET` reflects both changes with `branches` still `[]`.
   - `PATCH` with `{"departments": "bogus"}` → `validation_error` on `departments`.
   - `PATCH` with `{"default_response_target_minutes": 120, "default_resolution_target_minutes": 60}` (resolution < response) → `validation_error` on `default_resolution_target_minutes`.
8. Real HTTP against `apps/sla/policy.py::resolve_policy`'s new fallback tier: pick a ticket priority with **no** `SLAPolicy` row at all (verify via Django admin or `SLAPolicy.objects.filter(...)`), confirm `GET /api/tickets/<id>/sla/` returns `null` before any default is configured, `PATCH /api/settings/` with both default-minutes fields set, then confirm the same `GET` now returns a non-null SLA status with `"policy_id": null`.
9. The full UI walkthrough, both languages: `npm run dev` with the backend up, signed in as `admin@` — `/settings` loads the form pre-filled from the current record, adding/removing a department or branch updates the badge list live, saving persists (reload to confirm), and a resolution-target error surfaces under the right field. Switch to Arabic and confirm the form and badges render correctly in RTL.

---

## Verification Steps

1. **Backend checks, migrations, and formats clean:** from `backend/` with the venv active — `python manage.py check`, `python manage.py makemigrations --check --dry-run`, `python manage.py migrate`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing.
3. **`en`/`ar` key sets match**, including the new `organization` namespace.
4. **The settings endpoint's permission gate:**

   | Request | no token | `agent@supportos.local` (no `settings.manage`) | `admin@supportos.local` (superuser) |
   |---|---|---|---|
   | `GET /api/settings/` | 401 `not_authenticated` | 403 `permission_denied` | 200 |
   | `PATCH /api/settings/` | 401 | 403 `permission_denied` | 200 |

5. **Validation and round-trip**, per `## Test Plan` items 7-8.
6. **The full UI walkthrough, both languages**, per `## Test Plan` item 9.
7. **No hardcoded application strings introduced.** From `frontend/`:

   ```powershell
   Select-String -Path src\features\organization\components\SettingsPage.tsx -Pattern "'[A-Z][a-z]{3,}"
   ```

   Any hit must be inside a comment or a non-JSX context, not a JSX text node.
8. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `OrganizationSettings` model exists in `backend/apps/organization/models.py`, singleton-enforced (`save()` forces `pk=1`, `delete()` is a no-op, `load()` is the documented accessor), with `name`/`logo_url`/`departments`/`branches`/`default_response_target_minutes`/`default_resolution_target_minutes`.
- [ ] `Permissions.SETTINGS_MANAGE = "settings.manage"` exists, appended after `AUDIT_LOG_VIEW`; granted to the seeded `admin` role only via a new data migration.
- [ ] `SettingsView` (`apps/organization/views.py`) is `GET`/`PATCH` only, gated on `SETTINGS_MANAGE`, registered at `/api/settings/` via `apps/organization/urls.py` and `config/api_urls.py`.
- [ ] `OrganizationSettingsSerializer` validates `departments`/`branches` as string lists and enforces the response-vs-resolution ordering across partial updates.
- [ ] `OrganizationSettingsAdmin` registered, singleton-aware (`has_add_permission` refuses a second row, `changelist_view` redirects to the one row).
- [ ] `apps/sla/policy.py::resolve_policy` gains the org-default fallback tier; `compute_sla_status` is unchanged; `frontend/src/features/tickets/types/ticketSla.ts`'s `policy_id` is `number | null`.
- [ ] `frontend/src/features/organization/` exists with `types/settings.ts`, `api/{settingsKeys,getSettings,useSettings,updateSettings,useUpdateSettings}.ts`, `components/SettingsPage.tsx`, `locales/{en,ar}.json`.
- [ ] `nullablePositiveInt` added to `frontend/src/shared/validation/schemas.ts`.
- [ ] `/settings` route exists in `router.tsx`, gated by `RequirePermission permission="settings.manage"`; a new "Organization Settings" (or equivalent translated label) link exists in `Sidebar.tsx`, gated by `<Can permission="settings.manage">`, using `SettingsIcon`.
- [ ] `frontend/src/shared/i18n/resources.ts` registers the new `organization` namespace for both languages.
- [ ] Two new migrations in `apps/organization/migrations/`: `0001_initial.py` (schema) and `0002_grant_settings_permission.py` (data).
- [ ] Verified by real HTTP: the permission gate table (Step 4); validation and round-trip (Step 5, `## Test Plan` items 7-8); the SLA-defaults fallback tier actually changing a ticket's `GET .../sla/` response from `null` to a real status with `policy_id: null` once configured.
- [ ] Both languages walk through cleanly in the UI (Step 6).
- [ ] `CONVENTIONS.md` § 20 and § 23 each gain one appended entry — appended in place, § 0-§ 26 unrenumbered.
- [ ] `python manage.py test` reports **54** passing; `python manage.py makemigrations --check --dry-run` reports no pending changes; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding.** This is the last planned story in the `security-administration` feature (`SEC-1` through `SEC-4`, all four now planned).
