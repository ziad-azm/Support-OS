# Story 42 — Portal Access & Customer Auth (Story: SUPPORTOS-55)

## Prerequisites

- **EPIC 2 (`AUTHZ`) complete:** [../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md](../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md) and [../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md](../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md). Verified landed and running on disk today: `accounts.User`/`accounts.Role`, `apps/core/permissions.py`'s `Permissions`/`permissions_for`/`HasPermission`, `apps/core/views.py`'s `BaseModelViewSet`, and the full `frontend/src/shared/auth/` module (`AuthProvider`, `useAuth`, `RequireAuth`, `RequirePermission`, `Can`, `hasPermission`) — this story extends every one of these, per `CONVENTIONS.md` §13's explicit rule (line 200–202): *"Never build a second auth flow, a second token store, a second `useAuth()`-shaped hook, or a second permission check — extend what is there."*
- **EPIC 1 (`I18N`/`UI`) complete:** [../internationalization-design-system/05-story-i18n-rtl-foundation-SUPPORTOS-9.md](../internationalization-design-system/05-story-i18n-rtl-foundation-SUPPORTOS-9.md) and [../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md](../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md) — `frontend/src/shared/i18n/` (namespace registration pattern), the `Direction.DirectionProvider` in `frontend/src/app/providers.tsx`, and `frontend/src/shared/ui/primitives/` (shadcn components) this story's shell reuses.
- **CUST-1 complete** (`.squad/plans/customer-management/10-story-customer-profiles-SUPPORTOS-28.md`) — `apps/customers/models.py`'s `Customer` model, verified today to have **no** relation to `accounts.User` and no login mechanism of any kind. Task 1 below is the first thing to add one.
- **TKT-1 complete** — `backend/apps/tickets/models.py:56-57`: `Ticket.customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="tickets")`. Confirms the FK name (`customer`) later portal stories (PORTAL-1/2/3) will filter on through this story's scoping mixin.
- **Backend `apps/portal/` already scaffolded, empty.** Verified via `backend/apps/README.md:74` (*"`portal` | Customer-facing self-service surface."*) and by listing the directory: `apps/portal/{__init__.py, apps.py, admin.py, models.py, views.py, migrations/__init__.py}` — every one of `admin.py`/`models.py`/`views.py` is a one-line `# Create your ... here.` placeholder, no `urls.py` or `serializers.py` exists yet. Already registered in `INSTALLED_APPS` (`backend/config/settings/base.py:66`). **This story does not need to add real endpoints here** — see `## Story Goal`'s scope note.
- **Frontend `features/portal/` does not exist yet** — verified via directory listing of `frontend/src/features/` (`auth/`, `customers/`, `health/`, `knowledge-base/`, `live-chat/`, `notifications/`, `tasks/`, `tickets/`, `web-form/`). Task 6 creates it, following the same `components/` + `locales/{en,ar}.json` shape every other feature uses.
- **Backlog scope boundary** — `SupportOs backlog.MD` lines 556–594 (EPIC 10 — Customer Portal): PORTAL-0 (this story) is followed by PORTAL-1 "Submit Tickets" (566), PORTAL-2 "Track Requests" (572), PORTAL-3 "View History" (578), PORTAL-4 "Access FAQs" (584), PORTAL-5 "Submit Feedback/CSAT" (590) — **all five depend on PORTAL-0** and none of their tasks belong here. This story ships the identity/scoping mechanism and an empty shell; it ships no ticket, KB, or feedback UI.
- Verified: `backend/apps/communications/views.py:203-219`'s `LiveChatStartView` docstring already names "PORTAL-0" as the story that will own "real customer authentication" — confirming the anonymous chat/web-form customer-creation path (`frontend/src/features/live-chat/`, `frontend/src/features/web-form/`) is a **separate, pre-existing, unauthenticated** customer-creation mechanism this story does not touch or supersede.

---

## Story Goal

Give a `Customer` a real login, and make "this data belongs to the logged-in customer" a mechanism every later portal story inherits — without inventing a second authentication or authorization system.

1. **A `Customer` can log in.** `Customer` gains a nullable one-to-one link to `accounts.User`. That `User` authenticates through the **exact same** `/api/auth/token/` / `/api/auth/token/refresh/` / `/api/auth/logout/` / `/api/auth/me/` endpoints, the same `JWTAuthentication`, and the same `frontend/src/shared/auth/` module every staff account already uses. No second token store, no second login form, no second `useAuth()`.
2. **A new seeded `Role` (`customer`)** carries exactly one new permission, `portal.access`, added to the existing code-defined vocabulary in `apps/core/permissions.py`. A `User` linked to a `Customer` is assigned this role — the same `Role`/`User.role` mechanism AUTH-2 already built, not a parallel "is this a customer" flag.
3. **A reusable scoping mechanism**, not a one-off check: `apps/core/views.py` gains `CustomerScopedModelViewSet`, a `BaseModelViewSet` subclass that filters its queryset to the caller's own linked `Customer` row, and `HasPermission` gains an object-level check (`has_object_permission`) as defense-in-depth for the rare custom `@action` that fetches an object outside `get_queryset()`. PORTAL-1 through PORTAL-5 subclass this instead of `BaseModelViewSet` the moment they need customer-scoped data — this story's whole "reused by all portal stories" promise lives in this one class.
4. **A portal frame.** A second top-level route tree in `frontend/src/app/router.tsx` (a sibling of the existing `RootLayout` tree, not nested inside it — see the finding below), a new `PortalLayout` shell (bilingual, RTL-correct, responsive by the same flex-wrap technique `RootLayout` already uses), gated by the **existing** `RequireAuth` + `RequirePermission permission="portal.access"` components, with a single placeholder landing page. No ticket, KB, or feedback content — those are PORTAL-1 through PORTAL-5.

### The finding that shapes the frontend task

**`RootLayout` is not a wrapper scoped to authenticated staff routes — it is the single top-level route element for the entire SPA**, verified by reading `frontend/src/app/router.tsx:7-257`: `RootLayout` sits at `path: '/'` and every route in the file — `login`, `chat`, `contact`, and everything under `<RequireAuth/>` — is a *child* of it, rendered inside its `<header>` (staff nav, `NotificationBell`, language/theme controls). Nesting a `/portal` route group under this same tree would render the customer-facing portal **inside the staff shell** — the staff header, the `NotificationBell` (an agent-only feature, `@/features/notifications/components/NotificationBell`), and `Can`-gated staff nav links would all wrap every portal page. That is wrong for a customer-facing surface and is not a cosmetic detail to fix later.

The fix task 7 makes: `/portal` is a **second, sibling top-level route object** in the same `createBrowserRouter([...])` array — its own `element: <PortalLayout />`, independent of `RootLayout`. Both trees still render inside the same `AppProviders` (verified: `frontend/src/main.tsx:22-27` wraps `<RouterProvider router={router}/>` in `<AppProviders>`, so `AuthProvider`, `Direction.DirectionProvider`, `ToastProvider`, `ConfirmProvider`, and `QueryClientProvider` cover both trees identically) — so `useAuth()`, direction, and toasts all work unchanged inside `PortalLayout`; only the **visual shell** is separate.

### Explicitly out of scope

- **PORTAL-1 through PORTAL-5** (ticket submission, ticket tracking, history, FAQ/KB browsing, CSAT feedback) — nothing here renders ticket or KB content. `PortalHomePage` (task 6) is an empty placeholder.
- **Self-service customer registration / sign-up.** Neither the intake nor the backlog names one. A staff member links a `Customer` to a `User` via Django admin — see `## Product rules` and task 5. A self-service flow is not this story's job and is not named anywhere in EPIC 10.
- **A customer-facing "my profile" endpoint or UI.** `Customer.name`/`email`/`phone` are not exposed through `/auth/me/` in this story; the portal shell greets the user by `AuthUser.email` (already available), matching what `RootLayout` does for staff today. Exposing a richer profile is deferred to whichever PORTAL-N story first needs to display one.
- **Password reset / "forgot password" for customers.** Not named in the intake; the existing staff auth has none either (AUTH-1's own explicit scope note).
- **A mobile drawer/hamburger navigation component.** Verified: `frontend/src/shared/ui/primitives/` has no `sheet.tsx` (drawer) primitive today. `PortalLayout`'s nav is currently a single "Home" link — building a drawer for one link is unjustified. "Responsive" here means the same flex-wrap layout technique `RootLayout` already uses; a real mobile nav pattern is a forward note for whichever PORTAL-N story is the first to add enough nav items to need one (see `## Edge Cases & Failure Modes`).
- **Row-level scoping for any endpoint other than the mechanism itself.** No portal API endpoints ship in this story (`apps/portal/` gets no `urls.py`/`serializers.py`/real views) — `CustomerScopedModelViewSet` is proven with a throwaway verification harness (the same pattern Stories 08/09 used), then deleted, exactly like AUTH-2's `ScratchRoleViewSet`.
- **Automated tests.** Standing policy, `CONVENTIONS.md` §16. See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/customer-portal/SUPPORTOS-55/intake.md` — two task blocks (customer auth + scoped access; portal shell UI), **no attachments, no acceptance criteria**. Done Criteria derive from the two **Outcome** lines: *"secure customer boundary reused by all portal stories"* and *"portal frame for all portal features."*
2. `SupportOs backlog.MD` lines 556–594 (EPIC 10) — read PORTAL-1 through PORTAL-5 before assuming anything beyond auth + an empty shell is in scope.
3. `backend/apps/accounts/models.py` — `Role` (41–86, especially `clean()` at 69–86) and `User` (89–134, especially the `role` FK at 106–113). Task 1's seeded role and task 2's `Customer.user` link both build directly on this.
4. `backend/apps/core/permissions.py` — full file (104 lines). `Permissions` class (18–34, task 1 adds one constant), `permissions_for` (44–59), and `HasPermission` (62–104, task 3 adds `has_object_permission`). Note `_required_permission`'s grant-on-omission behaviour (89–103) — it still applies to any new portal viewset that ships without its own `permission_map`.
5. `backend/apps/core/views.py` — full file (77 lines). `BaseModelViewSet` (12–31) is what task 3's `CustomerScopedModelViewSet` subclasses; do not modify `BaseModelViewSet` itself — every existing staff viewset must be unaffected.
6. `backend/apps/customers/models.py` — `Customer` (7–50) and its `clean()` (41–50). Task 2 adds a field here; do not touch `ContactDetail`/`Note`/`Attachment`.
7. `backend/apps/customers/admin.py` — `CustomerAdmin` (13–18, no explicit `fields`/`fieldsets`, so Django renders every model field automatically — task 5 only needs a `list_display` change).
8. `backend/apps/accounts/migrations/0003_seed_roles.py` — the exact seeding pattern (`SEEDED_ROLES` list, `update_or_create` keyed on `slug`, `RunPython` with a reverse function) task 1's new migration copies verbatim.
9. `backend/apps/customers/migrations/0002_grant_customer_permissions.py` — the cross-app data-migration pattern (`dependencies` naming the exact `accounts` migration that must run first) for a migration that grants permissions to a role from a different app.
10. `backend/config/api_urls.py` — full file (23 lines). **This story adds no new `include()` line** — `apps.portal.urls` does not exist yet and is not created here (see `## Story Goal` scope note); confirm this file is unchanged as part of verification.
11. `frontend/src/app/router.tsx` — full file (257 lines). The single top-level `path: '/'` route object (7–256) and its `RequireAuth`/`RequirePermission` nesting pattern (e.g. lines 44–82 for `customers.view`) is what task 7's new sibling route object copies the shape of — **not** what it nests inside.
12. `frontend/src/app/RootLayout.tsx` — full file (71 lines). The header/nav/`Outlet` structure `PortalLayout` (task 6) mirrors structurally; note `NotificationBell` (line 4, 53) and the `Can`-gated staff nav (22–48) are **not** reused — the portal shell has its own, much smaller, header.
13. `frontend/src/app/providers.tsx` — full file (56 lines) and `frontend/src/main.tsx` (29 lines) — confirms both route trees share one `AuthProvider`/`Direction.DirectionProvider`/`QueryClientProvider` stack; task 7 adds no new provider.
14. `frontend/src/shared/auth/types.ts` (30 lines), `RequirePermission.tsx` (31 lines), `AuthProvider.tsx` — read in full. **No changes in this story** — `AuthUser`, `can()`, `RequireAuth`, `RequirePermission` all work unmodified for a customer account, because a customer is just a `User` row with a different `role`.
15. `frontend/src/shared/i18n/resources.ts` — full file (67 lines). The exact two-import-plus-one-map-entry pattern (e.g. `customersEn`/`customersAr`, lines 3–4, 42, 56) task 6's `portal` namespace registration copies.
16. `frontend/src/shared/ui/ThemeToggle.tsx` (uses `DropdownMenu`/`Button`) and `frontend/src/shared/ui/LanguageSwitcher.tsx` (uses `Select`) — both reused verbatim inside `PortalLayout`, no props, no modification.
17. `CONVENTIONS.md` §13 (191–218, especially the "never build a second auth flow" rule at 200–202) and §22 (735–832, especially "Row-level rules are the named extension point" at 807–810, and the grant-on-omission rule at 780–784). Task 8 appends `## 26.`; sections 0–25 stay unrenumbered — `frontend/.oxlintrc.json` cites "§15" elsewhere.
18. `backend/apps/README.md` line 74 — `portal` app's one-line purpose statement, confirming the empty scaffold's intended future use without this story needing to fill it in yet.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Reuse `AUTHZ` — no second auth flow, token store, `useAuth()`, or permission check.** | Intake ("reuse AUTHZ"); `CONVENTIONS.md` §13 | A customer authenticates through the same `/api/auth/token/` endpoints as staff, gets the same JWT pair, and the frontend's existing `AuthProvider`/`useAuth()`/`RequireAuth` work unmodified. The only new things are a `Role` row, a `Permissions` constant, and a `Customer.user` link. |
| **Scope portal data to the logged-in customer, reusable by every later portal story.** | Intake ("scoping rule... reused by all portal stories") | `apps/core/views.py`'s `CustomerScopedModelViewSet` (task 3) — a `get_queryset()` override every PORTAL-N viewset subclasses, plus `HasPermission.has_object_permission` as the row-level extension point `CONVENTIONS.md` §22 (807–810) already names for exactly this case. |
| **Portal shell reuses `UI`/`I18N` — bilingual, RTL, responsive.** | Intake ("reusing UI/I18N") | `PortalLayout` (task 6) is built from the same `shared/ui/primitives/` components and `LanguageSwitcher`/`ThemeToggle` `RootLayout` already uses; it inherits direction/i18n for free from the shared `AppProviders` tree — no new CSS, no new provider. |
| **The backend owns authorization; the frontend check is UX only.** | `CONVENTIONS.md` §12 | `RequirePermission permission="portal.access"` only hides the route; `HasPermission` + `CustomerScopedModelViewSet.get_queryset()` are what actually restrict data, independently. |
| **An unmapped action grants; it does not deny.** | `CONVENTIONS.md` §22 | `CustomerScopedModelViewSet` declares no `permission_map` of its own — every subclass (PORTAL-1 onward) must declare one, or its actions fall through to authenticated-only, same as any other `BaseModelViewSet` subclass. Stated explicitly in task 3's docstring so the first portal feature story does not rediscover it the hard way. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | This story adds no environment variable and no new dependency. |

---

## Backend Tasks

### 1 — The `portal.access` permission and the seeded `customer` role

**File: `backend/apps/core/permissions.py`** — add one constant to the `Permissions` class (18–34), directly after `KNOWLEDGE_BASE_MANAGE`:

```python
    KNOWLEDGE_BASE_VIEW = "knowledge_base.view"
    KNOWLEDGE_BASE_MANAGE = "knowledge_base.manage"
    PORTAL_ACCESS = "portal.access"
```

`ALL_PERMISSIONS` (37–41) picks this up automatically — it is derived from `vars(Permissions)`, not a hand-maintained list.

**Create file: `backend/apps/accounts/migrations/0004_seed_customer_role.py`** — copies the exact pattern of `0003_seed_roles.py`, seeding one additional role:

```python
from django.db import migrations

from apps.core.permissions import Permissions

# Same reasoning as 0003_seed_roles: importing `Permissions` here is a plain
# string-constants module with no model imports, so there is no circular
# import and a renamed constant breaks this migration loudly rather than
# seeding a string nothing checks.
SEEDED_ROLES = [
    {
        "slug": "customer",
        "name": "Customer",
        "description": "A customer with portal login access. Holds no staff permissions.",
        "permissions": [Permissions.PORTAL_ACCESS],
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
    # Fails on PROTECT if any user still holds this role — correct, same as
    # 0003_seed_roles's reverse. See `## Migration / Rollback`.
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(slug__in=[spec["slug"] for spec in SEEDED_ROLES]).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_seed_roles")]

    operations = [migrations.RunPython(seed_roles, unseed_roles)]
```

A separate migration file from `0003_seed_roles.py`, not an edit to it — that file already shipped and is not this story's to change.

---

### 2 — Link a `Customer` to a login-capable `User`

**File: `backend/apps/customers/models.py`** — add one field to `Customer` (7–50), directly after `company` (line 31):

```python
    company = models.CharField(_("company"), max_length=200, blank=True)
    # SET_NULL, not PROTECT: contrast `accounts.User.role` (PROTECT — many
    # users share one role that must not vanish silently). This is a 1:1
    # link; losing portal login access must not block deleting or keeping
    # the underlying CRM identity. Nullable: most `Customer` rows have no
    # portal login at all — this field is opt-in, set by a staff member
    # through Django admin (see Story 42 task 5), not by a self-service flow.
    user = models.OneToOneField(
        "accounts.User",
        verbose_name=_("linked user account"),
        related_name="customer_profile",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
```

**Verified:** Django's reverse `OneToOneField` accessor raises `RelatedObjectDoesNotExist`, which is defined to also subclass `AttributeError` specifically so `getattr(obj, "customer_profile", None)` and `hasattr()` work without a try/except at every call site. Task 3 relies on exactly this.

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations customers
```

Expect one file, `apps/customers/migrations/0005_customer_user.py` (the next number after `0004_attachment_note.py`), adding the nullable `user` column. `makemigrations` will pick the dependency on the `accounts` app automatically — commit whatever it names; do not hand-edit it. **Commit this migration in the same change as the model field** — `MigrationStateTests.test_no_pending_migrations` (`backend/config/tests/test_settings.py`) fails the build otherwise, per every prior story's own note on this test.

This is purely additive (nullable column, no existing row affected) — **no database reset required**, unlike Story 08's `AUTH_USER_MODEL` swap.

---

### 3 — The reusable scoping mechanism

**File: `backend/apps/core/permissions.py`** — add `has_object_permission` to `HasPermission` (62–104), directly after the existing `has_permission` (89–93):

```python
    def has_permission(self, request, view) -> bool:
        required = self._required_permission(request, view)
        if required is None:
            return True
        return required in permissions_for(request.user)

    def has_object_permission(self, request, view, obj) -> bool:
        """Row-level half of the extension point CONVENTIONS.md §22 names.

        A no-op for every existing (staff) viewset: it only tightens the
        check when the caller is a portal customer, i.e. `request.user` has a
        linked `Customer` row. `CustomerScopedModelViewSet.get_queryset()`
        (apps/core/views.py) is the PRIMARY defence — DRF's own
        `get_object()` filters through `get_queryset()` before this method
        ever runs, so a mismatched pk already 404s, not 403s, for the
        standard list/retrieve/update/destroy actions. This method exists for
        the case that primary defence cannot cover: a custom `@action` that
        fetches an object directly (e.g. `Model.objects.get(pk=...)`) instead
        of through `self.get_object()`. Without it, such an action would leak
        another customer's row with no gate at all.
        """
        customer = getattr(request.user, "customer_profile", None)
        if customer is None:
            return True
        customer_field = getattr(view, "customer_field", "customer")
        return getattr(obj, f"{customer_field}_id", None) == customer.id
```

**File: `backend/apps/core/views.py`** — add one new class directly after `BaseModelViewSet` (12–31), **do not modify `BaseModelViewSet` itself**:

```python
class CustomerScopedModelViewSet(BaseModelViewSet):
    """Base for every portal-facing viewset — the mechanism the intake's
    "scoping rule... reused by all portal stories" refers to.

    Filters the queryset to the caller's own `customers.Customer` row (via
    `customer_profile`, the reverse side of `Customer.user`). A caller with
    no linked Customer (every staff account today) sees an empty queryset,
    not another customer's data and not a 500.

    Declares NO `permission_map` of its own — per HasPermission's own
    grant-on-omission rule (CONVENTIONS.md §22), a subclass that ships
    without declaring one is authenticated-only, not closed. Every PORTAL-N
    viewset must declare its own `permission_map` (typically
    `{"list": Permissions.PORTAL_ACCESS, ...}`), the same as any other
    `BaseModelViewSet` subclass.

    `customer_field` names the FK from this viewset's model to `Customer` —
    override it when the model's field is not literally named `customer`
    (`tickets.Ticket.customer` is; see `backend/apps/tickets/models.py:56`).
    """

    customer_field = "customer"

    def get_queryset(self):
        queryset = super().get_queryset()
        customer = getattr(self.request.user, "customer_profile", None)
        if customer is None:
            return queryset.none()
        return queryset.filter(**{self.customer_field: customer})
```

Import nothing new — `BaseModelViewSet` is already in the same file.

---

### 4 — No `apps/portal/` endpoints in this story

**Files: `backend/apps/portal/{models.py,views.py,admin.py}`** — **unchanged.** No `urls.py`, no `serializers.py`. `backend/config/api_urls.py` — **unchanged**, no new `include()` line. Verified reasoning: EPIC 10's own backlog breakdown gives every actual data endpoint (tickets, KB) to PORTAL-1 through PORTAL-4; this story's backend surface is entirely the auth/scoping mechanism in tasks 1–3, proven by a throwaway harness in `## Verification Steps`, not a real endpoint.

---

### 5 — Provisioning path: Django admin links a `Customer` to a `User`

**File: `backend/apps/customers/admin.py`** — add `"user"` to `CustomerAdmin.list_display` (13–18):

```python
@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "company", "user", "created_at")
    search_fields = ("name", "email", "company")
    readonly_fields = ("created_at", "updated_at")
    inlines = (ContactDetailInline,)
```

`CustomerAdmin` declares no explicit `fields`/`fieldsets` today (verified — it relies entirely on Django's default form generation), so the new `user` field appears on the edit form automatically; no further admin change is needed.

**The two-step provisioning path this story ships (document, do not automate):**

1. Django admin → Users → **Add user**: set email + password (`UserAdmin.add_fieldsets`, already built by Story 08); then edit it → Permissions fieldset → set **Role = Customer** (the role task 1 seeds).
2. Django admin → Customers → open the target `Customer` row → set the new **Linked user account** field to that `User` → save.

No self-service registration, no bulk-link tool, no combined form — see `## Story Goal`'s scope note. SEC-1-style admin screens over this (a proper "grant portal access" button) are a later epic's job, exactly as AUTH-2 left role assignment to Django admin until SEC-1.

---

## Frontend Tasks

### 6 — `frontend/src/features/portal/`: the shell and its namespace

**Create file: `frontend/src/features/portal/locales/en.json`**

```json
{
  "shell": {
    "title": "Customer Portal"
  },
  "home": {
    "title": "Welcome",
    "placeholder": "There is nothing here yet — check back soon."
  },
  "nav": {
    "home": "Home"
  }
}
```

**Create file: `frontend/src/features/portal/locales/ar.json`** — the same key structure, translated. Every key present in `en` must exist in `ar` (`CONVENTIONS.md` §18) — a missing key falls back silently to English.

**File: `frontend/src/shared/i18n/resources.ts`** — add the two imports (alphabetical among the existing feature imports, directly after the `notificationsAr`/`notificationsEn` pair and before `tasksAr`/`tasksEn` — verified current order at lines 11–14 is `notifications`, then `tasks`, then `tickets`, then `webForm`; `portal` sorts between `notifications` and `tasks`):

```ts
import notificationsAr from '@/features/notifications/locales/ar.json'
import notificationsEn from '@/features/notifications/locales/en.json'
import portalAr from '@/features/portal/locales/ar.json'
import portalEn from '@/features/portal/locales/en.json'
import tasksAr from '@/features/tasks/locales/ar.json'
import tasksEn from '@/features/tasks/locales/en.json'
```

And one entry per language in the `resources` map (35–63):

```ts
  en: {
    // ...unchanged entries...
    notifications: notificationsEn,
    portal: portalEn,
    tasks: tasksEn,
    // ...
  },
  ar: {
    // ...unchanged entries...
    notifications: notificationsAr,
    portal: portalAr,
    tasks: tasksAr,
    // ...
  },
```

**Create file: `frontend/src/features/portal/components/PortalLayout.tsx`**

```tsx
import { Link, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/shared/auth'
import { Button } from '@/shared/ui/primitives/button'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'

/**
 * The customer-facing shell — a sibling to `app/RootLayout.tsx`, not nested
 * inside it (see Story 42 `## Story Goal`'s router finding). Deliberately
 * smaller than `RootLayout`: no `NotificationBell` (staff-only), no
 * `Can`-gated multi-feature nav — there is exactly one portal feature
 * (this shell) until PORTAL-1 lands.
 *
 * Responsive via the same `flex flex-wrap` technique `RootLayout` uses, not
 * a mobile drawer — there is nothing to hide behind one yet. See
 * CONVENTIONS.md §26.
 */
export function PortalLayout() {
  const { t } = useTranslation('portal')
  const { user, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="container mx-auto flex flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold">{t('shell.title')}</span>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal">{t('nav.home')}</Link>
            </Button>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  {t('actions.logout', { ns: 'common' })}
                </Button>
              </>
            ) : null}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
```

`t('actions.logout', { ns: 'common' })` reuses the existing `common:actions.logout` key `RootLayout` already uses (`frontend/src/shared/i18n/locales/en/common.json`) — no duplicate logout copy.

**Create file: `frontend/src/features/portal/components/PortalHomePage.tsx`**

```tsx
import { useTranslation } from 'react-i18next'

export function PortalHomePage() {
  const { t } = useTranslation('portal')

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">{t('home.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('home.placeholder')}</p>
    </div>
  )
}
```

The explicit placeholder-copy pattern — not an empty `<div>` — matches how `HealthPage` (Story 03/05) served as the "first feature" worked example before real features existed.

---

### 7 — Wire `/portal` as a sibling top-level route

**File: `frontend/src/app/router.tsx`** — add a second top-level object to the `createBrowserRouter([...])` array (7–257), as a sibling of the existing `{ path: '/', element: <RootLayout />, ... }` object, **after** its closing `},` and **before** the array's closing `])` (line 257):

```tsx
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      // ...unchanged...
    ],
  },
  {
    path: 'portal',
    lazy: async () => {
      const { PortalLayout } = await import('@/features/portal/components/PortalLayout')
      return { element: <PortalLayout /> }
    },
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <RequireAuth />,
        children: [
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
            ],
          },
        ],
      },
    ],
  },
```

`RequireAuth`/`RequirePermission` imports (line 5) are already in scope — no new import needed for them.

**No change to the existing `path: '/'` tree** — verified this is the correct fix for the double-shell problem in `## Story Goal`, not a restructuring of the staff routes.

---

### 8 — `CONVENTIONS.md` § 26

**File: `CONVENTIONS.md`** — append `## 26. Customer portal identity & scoping`, **after** `## 25. Design intelligence (DSN, EPIC 8)` (currently the last section, starting at line 1430). Do not renumber §0–§25. Cover, in this order:

1. **A customer is a `User` row, not a second identity system.** `Customer.user` (nullable `OneToOneField`) links a CRM identity to a login-capable account; `customer_profile` is the reverse accessor. A `Customer` with `user = None` cannot log in — most rows.
2. **The `customer` role carries exactly one permission, `portal.access`.** Seeded the same way `admin`/`manager`/`agent` are (`apps/accounts/migrations/0004_seed_customer_role.py`). Adding more portal-facing permissions later is a `Permissions` constant plus a role-permission grant migration — the same two-step pattern `0002_grant_customer_permissions.py` used for staff.
3. **`CustomerScopedModelViewSet` (`apps/core/views.py`) is the base for every portal viewset.** Its `get_queryset()` filtering is the PRIMARY scoping mechanism; `HasPermission.has_object_permission` is the secondary, defense-in-depth layer for the rare custom `@action` that bypasses `get_object()`. State clearly: a custom `@action` MUST route through `self.get_object()`/`self.get_queryset()`, never a raw `Model.objects.get(...)` — that bypasses the primary defence entirely and leaves only the object-permission check to catch a leak.
4. **`customer_field` is the seam.** Default `"customer"` (matches `Ticket.customer`); a future portal model with a differently named FK overrides it.
5. **The frontend gate is `RequirePermission permission="portal.access"`** — no new component. The portal route tree is a sibling of `RootLayout`'s, not nested in it — link to `frontend/src/app/router.tsx`'s structure and state why (no staff chrome must leak into customer-facing pages).
6. **Provisioning is Django-admin-only, by design, until a later epic builds a screen** — mirror the language `CONVENTIONS.md` §22 already uses for role assignment before SEC-1.

**File: `backend/apps/README.md`** — no change needed; line 74 already describes `portal`'s purpose accurately and this story does not put real endpoints there yet.

---

## Edge Cases & Failure Modes

- **A staff account (no `customer_profile`) hitting a `CustomerScopedModelViewSet`-based endpoint gets an empty list, not an error and not another customer's data.** `get_queryset()` returns `.none()` when `customer_profile` is `None` — verified this is the correct default for the only accounts that exist before this story ships (all staff, all `customer_profile = None`).
- **A customer with `role = None` (a `Customer.user` created but never assigned the `customer` role) holds no permissions at all**, including `portal.access` — `RequirePermission` redirects them to `/` (root, the unguarded staff `HealthPage`) after login, which is a confusing but harmless landing (no sensitive data). This is the same "role = null holds nothing" behaviour AUTH-2 already documented for staff; task 5's two-step provisioning instructions exist specifically to prevent creating an inert account.
- **A logged-in customer navigating directly to `/login` (bypassing `/portal`) lands on `/` after login, not `/portal`.** `LoginPage`'s `from` redirect (`frontend/src/features/auth/components/LoginPage.tsx:31`) defaults to `/` when there is no `location.state.from`; that only gets set when `RequireAuth` itself performs the redirect (i.e., the visitor first tried to reach a guarded route). Not a security issue (`/` is the harmless `HealthPage`), and not fixed in this story — the expected customer entry point is a link/bookmark to `/portal`, which does carry `state.from` correctly.
- **`has_object_permission` alone is not sufficient scoping for `list`.** DRF never calls `has_object_permission` per-row for a list action — only `get_queryset()` scoping does that. `CustomerScopedModelViewSet.get_queryset()` is therefore load-bearing for `list`, and `has_object_permission` is strictly a defense-in-depth addition for custom `@action`s, not a replacement. State this plainly in the task 3 docstring so a future contributor does not "simplify" by dropping the queryset override in favor of the object-permission check.
- **`getattr(request.user, "customer_profile", None)` on an `AnonymousUser`.** Django's `AnonymousUser` has no `customer_profile` attribute at all (it is not a real model instance), so `getattr(..., None)` returns `None` safely — but `HasPermission.has_permission`'s existing `IsAuthenticated` (via `BaseModelViewSet.permission_classes`, unchanged) already rejects an anonymous request before `has_object_permission` is ever reached. No new failure mode; verified consistent with `permissions_for`'s existing `is_authenticated` guard (`apps/core/permissions.py:52-53`).
- **`Customer.user` is `SET_NULL`, so deleting a `User` silently detaches the `Customer` from its login** — the `Customer` CRM record survives (correct: it may have tickets, notes, attachments referencing it via `PROTECT`/`CASCADE`), but the customer can no longer sign in until re-linked. Deliberate; contrast `User.role`'s `PROTECT`, which fails loudly instead because many users can share one role.
- **Two staff members independently re-running task 1's data migration is safe.** `update_or_create` keyed on `slug`, matching `0003_seed_roles.py`'s own re-runnable pattern.
- **`RequirePermission` redirects an unauthorized visitor to `/`, not a portal-specific "access denied" page.** There is no such page in this app for staff routes either (`CONVENTIONS.md` §22) — consistent, not a gap introduced here.
- **No mobile drawer nav yet.** `PortalLayout`'s single "Home" link wraps naturally at narrow widths via `flex flex-wrap`; the first PORTAL-N story that adds enough nav items to overflow a single row is the one that should introduce a `sheet.tsx` (drawer) primitive under `shared/ui/primitives/` — none exists today, and inventing one for a single link is not justified.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — clean, and the existing suite reports the same passing count as before this change plus no new failures; `MigrationStateTests.test_no_pending_migrations` (`backend/config/tests/test_settings.py`) is what catches task 2's model change shipping without its migration.
2. `ruff format --check .` / `ruff check .` on the new and changed Python.
3. `npm run build` — typechecks the new `PortalLayout`/`PortalHomePage` components and the `resources.ts` map; a mistyped `t()` key against the `portal` namespace is a compile error.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl` — unchanged gates over the new files.
5. Real HTTP + browser checks proving the scoping mechanism actually restricts data across two customer accounts — Verification Steps 4–8. This is where the story's real claim (a customer sees only their own row) gets tested; nothing static can see it.

---

## Migration / Rollback

**Two additive migrations, no reset.** `apps/accounts/migrations/0004_seed_customer_role.py` (data — seeds one `Role` row) and `apps/customers/migrations/0005_customer_user.py` (schema — one nullable column). Neither requires the kind of database reset Story 08's `AUTH_USER_MODEL` swap needed.

**Rollback of the code:** revert the commits. No `npm install`/`pip install` needed — this story adds no new package to either app (verified: nothing new in `requirements.txt` or `package.json`).

**Rollback of the schema:**

1. `python manage.py migrate customers 0004_attachment_note` — drops the `user` column. Safe on a fresh rollback; if any `Customer.user` was actually set, that link is simply lost (the `Customer` and `User` rows themselves are untouched — `SET_NULL` semantics mean no cascade risk here either way).
2. `python manage.py migrate accounts 0003_seed_roles` — runs `unseed_roles`, deleting the `customer` role. **Fails if any `User` still holds it** (`on_delete=PROTECT` on `User.role`) — clear those assignments first (`User.objects.filter(role__slug="customer").update(role=None)`), matching the exact reverse-migration caution `0003_seed_roles.py` itself already documents.

**Half-applied states to avoid:**

- **Task 1's `Permissions.PORTAL_ACCESS` constant before the migration that references it** → the migration fails at import time (same failure mode Story 09 documented for `0003_seed_roles` importing `apps/core/permissions.py`). Write the constant first.
- **Task 2's model field before its migration** → `MigrationStateTests.test_no_pending_migrations` fails the build. Commit together.
- **Task 3's `CustomerScopedModelViewSet` with no subclass** → currently a no-op, since nothing subclasses it yet (same as `BaseModelViewSet` itself between Stories 02 and 09). Safe, and it is the point — the base is armed before PORTAL-1 arrives.
- **Task 7's router change without task 6's components** → `npm run build` fails on the missing lazy-imported modules. Ship task 6 first.
- **Deleting the verification harness (below) before running Verification Steps 6–8** → they are the only thing that exercises `CustomerScopedModelViewSet` against real data. Delete it after, confirmed by Step 9.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` — `python manage.py check`, `ruff format --check .`, `ruff check .` — all clean.
2. **Migrations apply forward on the existing database, with no reset:** `python manage.py migrate` — `accounts.0004_seed_customer_role` and `customers.0005_customer_user` apply; `python manage.py showmigrations accounts customers` shows both applied. **No `DROP DATABASE` anywhere in this story.**
3. **The seeded `customer` role exists with exactly one permission:**

   ```powershell
   python manage.py shell -c "from apps.accounts.models import Role; r=Role.objects.get(slug='customer'); print(r.name, r.is_system, r.permissions)"
   ```

   Expect `Customer True ['portal.access']`.
4. **Create two customer accounts and link them**, the two-step path task 5 documents:

   ```powershell
   python manage.py shell -c "
   from django.contrib.auth import get_user_model
   from apps.accounts.models import Role
   from apps.customers.models import Customer
   U = get_user_model()
   role = Role.objects.get(slug='customer')
   for email, cust_name in [('cust1@example.com', 'Customer One'), ('cust2@example.com', 'Customer Two')]:
       u, _ = U.objects.get_or_create(email=email, defaults={'role': role})
       u.role = role; u.set_password('Sup3rSecret!'); u.save()
       c, _ = Customer.objects.get_or_create(name=cust_name, defaults={'user': u})
       c.user = u; c.save()
   print(list(U.objects.filter(role__slug='customer').values_list('email', 'customer_profile__name')))
   "
   ```
5. **`/auth/me/` reports `portal.access` for a customer, and nothing else:**

   ```powershell
   $t = (curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/ -H "Content-Type: application/json" -d '{\"email\":\"cust1@example.com\",\"password\":\"Sup3rSecret!\"}' | ConvertFrom-Json).data.access
   curl.exe -s http://127.0.0.1:8000/api/auth/me/ -H "Authorization: Bearer $t"
   ```

   Expect `role: {slug: "customer", ...}` and `permissions: ["portal.access"]` — no staff permissions.
6. **The scoping mechanism actually restricts a list to the caller's own row.** Build the harness (below), then, with `cust1@`'s token, GET the harness list endpoint: expect exactly the ticket belonging to `Customer One`, never `Customer Two`'s. Repeat with `cust2@`'s token: expect exactly `Customer Two`'s ticket.
7. **A plain staff account (no `portal.access`) is denied at the permission layer, not the queryset layer.** GET the harness list endpoint with a staff token that holds no `portal.access` permission: expect `403 permission_denied` — `HasPermission.has_permission` denies before `get_queryset()` ever runs.
8. **`get_queryset()`'s `customer is None` branch returns an empty list, not an error, for an authenticated account that holds `portal.access` but has no linked `Customer`.** Temporarily grant the `customer` role to a staff account with no `customer_profile`, then GET the harness endpoint with its token: expect `200` with an empty result set, not a 500 and not another customer's data. Revert the temporary role grant immediately after.
9. **No token, and a customer missing the role, both fail correctly.** No `Authorization` header → 401 `not_authenticated`. A third `User` linked to a `Customer` but with `role = None` → 403 `permission_denied` on the harness endpoint.
10. **The harness is gone.** `git status` shows no harness file and no leftover router/urls edit beyond tasks 1–8's real changes.
11. **Frontend builds and lints clean:** from `frontend/` — `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` — all exit 0.
12. **The portal shell renders standalone, in both languages and both directions.** With the backend running and `cust1@`/`Sup3rSecret!` available: `npm run dev`, visit `http://localhost:5173/portal`. Unauthenticated, this redirects to `/login`; after logging in with the customer account, it lands back on `/portal` (not `/`) showing `PortalHomePage`, **with no staff header, no `NotificationBell`, and no staff nav links visible**. Switch language: the shell's own copy (`shell.title`, `nav.home`, `home.title`, `home.placeholder`) becomes Arabic, `document.documentElement` shows `dir="rtl"`.
13. **A staff account visiting `/portal` is redirected to `/`, not shown the shell.** Log in as `admin@supportos.local` (or any account without the `customer` role), then navigate to `/portal`: `RequirePermission` redirects to `/`.

**The harness** (the same throwaway pattern Stories 08/09 used). **Use `Ticket`, not `Customer`, as the scoped model** — verified: `Customer` has no self-referential relation, so scoping it to itself via `customer_field = "id"` fails at the ORM level (`id` is a plain `AutoField`, not a `ForeignKey`, so `Customer.objects.filter(id=<Customer instance>)` raises `TypeError: Field 'id' expected a number but got <Customer: ...>` — `AutoField.get_prep_value` has no instance-coercion behaviour; only `ForeignKey.get_prep_value` does that). `Ticket.customer` is a real FK and is also exactly what PORTAL-1 will scope on, making it a more faithful proof than a self-reference hack. Create `backend/apps/core/scratch_views.py`:

```python
# TEMP: Story 42 verification harness — DELETE before committing.
from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketSerializer

from .permissions import Permissions
from .views import CustomerScopedModelViewSet


class ScratchPortalTicketViewSet(CustomerScopedModelViewSet):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    # customer_field left at the default ("customer") — Ticket.customer is a
    # real FK, so no override needed.
    permission_map = {"list": Permissions.PORTAL_ACCESS}
```

Register it in `config/api_urls.py` with a `DefaultRouter` at `scratch/portal-tickets/`, create one `Ticket` per test customer (`subject`, `description`, `customer=<Customer instance>` are the only required fields), walk Verification Steps 6–9, then **delete the file, the router registration, and the import** — confirmed by Step 10.

---

## Done Criteria

- [ ] `Permissions.PORTAL_ACCESS = "portal.access"` exists in `apps/core/permissions.py`; `ALL_PERMISSIONS` picks it up automatically.
- [ ] `apps/accounts/migrations/0004_seed_customer_role.py` seeds a `Role(slug="customer", permissions=["portal.access"], is_system=True)`, re-runnable via `update_or_create`.
- [ ] `Customer.user` is a nullable `OneToOneField` to `accounts.User` (`related_name="customer_profile"`, `on_delete=SET_NULL`), migrated via `apps/customers/migrations/0005_customer_user.py`, with **no database reset**.
- [ ] `HasPermission.has_object_permission` exists, is a no-op for any user without a `customer_profile`, and denies access to an object whose `customer_field` does not match the caller's own `Customer`.
- [ ] `CustomerScopedModelViewSet` exists in `apps/core/views.py`, subclasses `BaseModelViewSet` unmodified, filters `get_queryset()` to the caller's `customer_profile`, and returns an empty queryset (not an error) for any user without one.
- [ ] `apps/portal/` (`models.py`, `views.py`, `admin.py`) is **unchanged** from its scaffold; `config/api_urls.py` has **no** new `include()` line.
- [ ] `CustomerAdmin.list_display` includes `user`; the field is editable on the existing default admin form with no other admin change.
- [ ] Verified by real HTTP across two customer accounts (Step 6): each sees only their own ticket through the harness; a plain staff account (no `portal.access`) is denied at the permission layer with 403 (Step 7); an account with `portal.access` but no `customer_profile` gets an empty `200` list, not an error (Step 8); no token → 401; a role-less customer → 403 (Step 9).
- [ ] `frontend/src/features/portal/` exists with `components/{PortalLayout.tsx,PortalHomePage.tsx}` and `locales/{en,ar}.json`, registered in `shared/i18n/resources.ts`.
- [ ] `frontend/src/app/router.tsx` has a **second, sibling** top-level route (`path: 'portal'`), not nested inside the existing `path: '/'` `RootLayout` tree; gated by the existing `RequireAuth` + `RequirePermission permission="portal.access"` with no new guard component.
- [ ] Visiting `/portal` unauthenticated redirects to `/login` and back to `/portal` after a customer logs in (Step 12); a staff account visiting `/portal` is redirected to `/` (Step 13).
- [ ] The portal shell shows no staff chrome (`NotificationBell`, staff nav) and renders correctly in both languages/directions (Step 12).
- [ ] `CONVENTIONS.md` has a new `## 26. Customer portal identity & scoping` — **appended, with §0–§25 unrenumbered**.
- [ ] `ScratchPortalTicketViewSet`, its router registration, and its import are all deleted; `git status` is clean of them (Step 10).
- [ ] `python manage.py check`/`test`, `ruff format --check .`, `ruff check .`, `npm run build`, `npm run lint`, `npm run format:check`, `npm run check:rtl` all exit 0.
- [ ] `.squad/plans/customer-portal/00-overview.md` updated with this story; `.squad/plans/00-index.md` updated with the `customer-portal` feature row.

**STOP HERE. Report to the user and wait for confirmation before proceeding to PORTAL-1 (Submit Tickets), which is the first real consumer of `CustomerScopedModelViewSet`.**
