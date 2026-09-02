# Story 85 — Portal Access Management (Story: SUPPORTOS-122)

## Prerequisites

- **CUST-1 completed:** [10-story-customer-profiles-SUPPORTOS-28.md](10-story-customer-profiles-SUPPORTOS-28.md). `Customer` model, `CustomerViewSet`, `CustomerSerializer`, `CustomerProfilePage.tsx` all landed and running.
- **PORTAL-0 completed:** [../customer-portal/42-story-portal-access-customer-auth-SUPPORTOS-55.md](../customer-portal/42-story-portal-access-customer-auth-SUPPORTOS-55.md). Verified landed and unchanged by this story: `Customer.user` (nullable `OneToOneField` to `accounts.User`, `related_name="customer_profile"`, `on_delete=SET_NULL` — `backend/apps/customers/models.py:51-58`), the seeded `Role(slug="customer", permissions=["portal.access"], is_system=True)` (`apps/accounts/migrations/0004_seed_customer_role.py`), and `Permissions.PORTAL_ACCESS` (`apps/core/permissions.py:35`). This story does **not** touch any of these — it only adds a staff-facing way to set/unset `Customer.user`, replacing the Django-admin-only path that story documented as intentionally temporary (`CONVENTIONS.md` §26, quoted below).
- **SEC-5 completed:** [../security-administration/70-story-user-invitation-first-login-password-SUPPORTOS-107.md](../security-administration/70-story-user-invitation-first-login-password-SUPPORTOS-107.md). This story reuses, unmodified: `apps/accounts/tokens.py` (`make_password_token`/`read_password_token`), `apps/accounts/tasks.py::send_invite_email` (mails `{FRONTEND_URL}/set-password?token=...`), `InviteConfirmSerializer`/`InviteConfirmView` at `POST /api/auth/invite/confirm/`. **No changes to any of these four** — the invite-confirm flow does not know or care whether the account it activates is staff or a portal customer; it only checks `is_active=False` and `not user.has_usable_password()` (`apps/accounts/serializers.py:194-202`).
- **`CONVENTIONS.md` §26** (lines 1778-1851) currently documents the gap this story closes, in its own words (lines 1846-1851): *"Provisioning is Django-admin-only, by design, until a later epic builds a screen... There is no self-service registration and no combined create-and-link form."* Task 9 rewrites this paragraph. Django admin's own `user` field on `CustomerAdmin` (`apps/customers/admin.py:15`) is **unchanged** — it stays available as a manual fallback, exactly like `RoleAdmin`/`UserAdmin` remain usable after their own API/UI equivalents shipped.
- Verified backend baseline: `Customer.email` is unique-when-present (`apps/customers/models.py:24-26`) and `User.email` is unique unconditionally (`apps/accounts/models.py:97`) — two independent unique columns with no cross-validation between them today. Task 2 below adds the guards this makes necessary (see `## Story Goal`'s "why the conflict checks exist" note).
- Verified: `admin`, `manager`, and `agent` all already hold `Permissions.CUSTOMERS_MANAGE` (`apps/customers/migrations/0002_grant_customer_permissions.py:8-11`) — this story adds **no new permission constant and no new role grant migration**; the new action reuses `customers.manage` verbatim, the same permission that already gates customer create/update/destroy.
- Verified: `rest_framework_simplejwt`'s `JWTAuthentication` rejects any access token belonging to an `is_active=False` user (`CHECK_USER_IS_ACTIVE` defaults to `True` in `.venv/Lib/site-packages/rest_framework_simplejwt/settings.py:47`, enforced at `.venv/Lib/site-packages/rest_framework_simplejwt/authentication.py:138`, and this project's `SIMPLE_JWT` setting in `backend/config/settings/base.py:193-204` does not override it). Revoking portal access by setting `is_active=False` is therefore an **immediate** cutoff for any still-live access token, not merely a block on the next login — see `## Edge Cases`.
- Verified: `AuditLog.Action` (`apps/accounts/models.py:172-181`) is a plain `TextChoices`; the precedent for adding a value is `apps/accounts/migrations/0007_alter_auditlog_action.py` (a pure `AlterField` on `choices`, no data change). Task 1 follows this exact shape.
- Verified: none of the eight existing `AuditLog.Action` labels have an Arabic translation in `backend/locale/ar/LC_MESSAGES/django.po` (grepped for three of them — no hits) — `action_display` already renders in English regardless of `Accept-Language`. This story's two new labels follow the same (unremarked) precedent; no `.po` work is in scope.
- Verified: `frontend/src/features/audit-log/types/auditLog.ts`'s `AUDIT_LOG_ACTIONS` array (lines 2-11) is a **frontend-owned, separate** copy of the action list, driving the `AuditLogListPage.tsx` filter dropdown (`t('actions.${value}')`, lines 93-97) — distinct from `action_display`, which is the backend's own label. Both need the two new values (task 8).

---

## Story Goal

Give a permission-gated `POST`/`DELETE` action on `CustomerViewSet` and a status indicator plus one button on `CustomerProfilePage`, so an agent can onboard or offboard a customer's portal login without ever opening Django admin.

1. **Backend.** `CustomerSerializer` exposes `portal_access_enabled: bool` (`customer.user_id is not None` — a plain column read, no join). A new `@action` on `CustomerViewSet`, `portal_access` (`POST` grants, `DELETE` revokes), gated by the existing `customers.manage` permission:
   - **Grant** creates (or reactivates) a `User` with `role=customer`, `is_staff=False`, `is_active=False`, an unusable password, linked via `Customer.user`, and dispatches `send_invite_email` — the exact same pending-account shape `UserAdminSerializer.create` already produces for staff, reusing the exact same task and the exact same confirm endpoint.
   - **Revoke** unlinks `Customer.user` and deactivates the underlying `User` (`is_active=False`) — both, not either, matching the intake's own "unlink/deactivate" wording.
   - Both actions write an `AuditLog` row (two new `Action` values), matching the audit trail every other `User`-mutating action in `UserViewSet` already leaves.
2. **Frontend.** `CustomerProfilePage.tsx` gains a "Portal access: Enabled/Disabled" badge and a Grant/Revoke button, gated by `<Can permission="customers.manage">` exactly like the existing Edit/Delete buttons on the same card.

### Why the conflict checks in `_grant_portal_access` exist — this is not defensive over-engineering

`Customer.email` is unique **among customers**; `User.email` is unique **among users**; nothing keeps the two columns in sync with each other. Three real, reachable states follow directly from that, and the first one is not hypothetical — it is a database-level `IntegrityError` waiting to happen, not just a UX nicety:

- **A `User` with `customer.email` already exists and is some *other* `Customer`'s linked account.** `Customer.user_id` carries a `UNIQUE` constraint (that is what a `OneToOneField` compiles to). Attempting `customer.user = existing_user; customer.save()` when `existing_user.id` already equals another `Customer.user_id` raises `IntegrityError` — a 500 — with no guard. This is the same class of bug `CustomerSerializer.email`'s own `UniqueValidator` exists to prevent for a different column (`apps/customers/serializers.py:36-43`'s own comment names the exact mechanism: DRF only auto-derives a `UniqueValidator` for a field it generates itself, so an overridden field must declare one by hand — the same "must check by hand or get an IntegrityError" lesson applies here, one level up, at the view).
- **A `User` with `customer.email` already exists and is a *staff* account (`is_staff=True`, no `customer_profile`).** Silently linking it would flip that person into `UserViewSet.get_queryset()`'s exclusion filter (`customer_profile__isnull=True`, `apps/accounts/views.py:190-199`) — an admin or agent would vanish from the staff Users list the moment this ran. A real, security-relevant regression, not a cosmetic one.
- **A `User` with `customer.email` already exists, has no `customer_profile`, and is not staff.** This is the ordinary "re-grant after a prior revoke" case — revoke below unlinks but does not delete the `User` row. This one is safe to reuse, and grant does so rather than failing or creating a second row that would collide on the unique `email` column anyway.

---

## Context — Read These Files First

1. `backend/apps/customers/models.py:7-79` — `Customer`, especially `email` (24-26, nullable-unique) and `user` (51-58, the OneToOne this story reads/writes but never alters the shape of).
2. `backend/apps/customers/serializers.py:11-78` — `CustomerSerializer`, especially `Meta.fields` (56-67) and the `email`/`external_id` `UniqueValidator` pattern (36-54) task 3's `portal_access_enabled` field sits beside, and whose "hand-declare or get an IntegrityError" lesson task 4's conflict checks apply at the view layer instead.
3. `backend/apps/customers/views.py:1-217` — `CustomerViewSet` in full, especially `permission_map` (32-44) and the `timeline` `@action` (52-69) — the project's only existing precedent for a custom `@action` on this viewset, including its own "keyed by the action's own method name, not the HTTP verb" note (39-42), which task 4's `portal_access` (two HTTP methods, one method name) also relies on.
4. `backend/apps/accounts/models.py:89-217` — `User` (89-133, especially `role`/`is_staff`/`is_active`) and `AuditLog` (136-217, especially `Action` at 172-181 and the two nullable `target_user`/`target_role` FKs at 191-206) — task 1 adds two `Action` values, task 4 writes two more `AuditLog` rows following `UserViewSet`'s exact shape.
5. `backend/apps/accounts/views.py:154-272` — `UserViewSet`, especially `get_queryset` (190-199, the `customer_profile__isnull=True` staff-only filter task 4's staff-conflict guard exists to keep true) and `perform_create` (201-216, the `AuditLog.objects.create(...)` then best-effort `send_invite_email.delay(...)` shape task 4 copies verbatim for the grant path).
6. `backend/apps/accounts/serializers.py:106-169` — `UserAdminSerializer`, especially `create()` (147-168) — `password=None` → `set_unusable_password()`, `is_active` forced `False` regardless of caller input. Task 4's grant path reproduces this exact pair of guarantees by hand (it cannot call this serializer directly — that path forces `is_staff=True`, wrong for a portal account).
7. `backend/apps/accounts/tasks.py:22-46` — `send_invite_email`. Reused with **zero changes** — it only needs `user.id`, mails a generic "set your password" link, and does not care whether `is_staff` is `True` or `False`.
8. `backend/apps/core/permissions.py:18-42` — confirms `Permissions.CUSTOMERS_MANAGE` (line 30) and `Permissions.PORTAL_ACCESS` (line 35) already exist; this story adds neither a new constant nor a new grant migration.
9. `backend/apps/customers/admin.py:13-18` — `CustomerAdmin.list_display` already includes `user` (Story 42 task 5); **unchanged** by this story — it remains a manual fallback.
10. `frontend/src/features/customers/components/CustomerProfilePage.tsx:1-108` — full file. The `<dl>` grid (61-78) is where the new status field is added; the `<Can permission="customers.manage">` button row (79-93) is where the new Grant/Revoke button is added, beside the existing Edit/Delete buttons it is gated identically to.
11. `frontend/src/features/tickets/components/TicketStatusControl.tsx:1-77` — the "plain mutation, no form, `mutate()` with an `onSuccess` toast, failure already toasted by the shared mutation error handler" pattern (comment at line 53-54) task 12's Grant/Revoke buttons copy — neither needs a confirm-dialog-free grant nor a confirm-gated revoke to touch `applyServerErrors` at all, since neither is a form.
12. `frontend/src/shared/lib/api/queryClient.ts:23-56` — confirms **every** mutation error is toasted globally (`MutationCache({ onError: handle })`, comment at line 46-48: *"Mutations always toast... silence reads as success"*) — task 12 needs no bespoke error handling for the grant/revoke buttons' failure path.
13. `frontend/src/features/customers/api/useCustomerMutations.ts:1-39`, `deleteCustomer.ts`, `createCustomer.ts`, `customerKeys.ts` — the exact one-function-per-file API-call shape and the "every write invalidates `customerKeys.all`" rule (stated in `.squad/plans/customer-management/00-overview.md`'s own "Cross-story contracts" list) task 6/7 copy verbatim.
14. `frontend/src/features/customers/types/customer.ts:1-19` — `Customer`/`CustomerInput`. Task 5 adds one read-only field to `Customer`; `CustomerInput` (the write shape) is **unchanged** — `portal_access_enabled` is never client-settable.
15. `frontend/src/features/audit-log/types/auditLog.ts:1-28` — `AUDIT_LOG_ACTIONS` (2-11) and `AuditLogAction`. Task 8 appends two values here, independently of the backend `AuditLog.Action` enum task 1 extends — these are two separate lists that must stay in sync by hand (no shared source), the same as every other entry in this file already is.
16. `frontend/src/features/audit-log/locales/en.json`/`ar.json` — the `actions.*` key map (lines 21-30 in both) mirrors `AUDIT_LOG_ACTIONS` one-for-one; task 8 adds two keys to both files.
17. `frontend/src/features/customers/locales/en.json`/`ar.json` — full files. The `contacts`/`notes`/`attachments` sibling objects (each: a title, an empty state, field labels, action labels, a delete-confirm pair, and toast copy) are the shape task 10's new `portalAccess` object copies.
18. `CONVENTIONS.md` lines 1846-1851 (the closing paragraph of §26) — the exact text task 9 rewrites; §26's heading and every other paragraph in it are unchanged, and §0-§25/§27+ are not renumbered.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **An agent grants/revokes portal access from the customer's own profile — no Django admin needed.** | Intake | `CustomerProfilePage.tsx`'s new button (task 12) calls `CustomerViewSet.portal_access` (task 4) directly; Django admin's `user` field stays only as an unused-by-default fallback. |
| **Grant reuses SEC-5's invite-email flow, role=customer.** | Intake | Task 4's `_grant_portal_access` produces the exact `is_active=False` + unusable-password shape `UserAdminSerializer.create` produces for staff, assigns `Role.objects.get(slug="customer")`, and calls the same `send_invite_email.delay(...)` — no second email mechanism, no second token scheme. |
| **Revoke unlinks and deactivates.** | Intake ("unlink/deactivate") | `_revoke_portal_access` sets `Customer.user = None` **and** the underlying `User.is_active = False` — both, matching the intake's own wording; see `## Edge Cases` for why both are needed rather than either alone. |
| **Gated the same way every other customer-management write already is.** | Existing `customers.manage` convention | `permission_map["portal_access"] = Permissions.CUSTOMERS_MANAGE` — no new permission constant, no new role grant migration; `admin`/`manager`/`agent` all already qualify. |
| **The backend enforces this even if the frontend is bypassed.** | `CONVENTIONS.md` §12/§22 posture | All three conflict guards (already-enabled, no-email, email-collides-with-another-account) live in the view, not the button's disabled state — the frontend's "no email → hide the Grant button" (task 12) is UX only. |
| **Visible, not just actionable.** | Intake ("status indicator... enabled/disabled") | `CustomerSerializer.portal_access_enabled` (task 3) is read on every `list`/`retrieve`, so the profile page's badge needs no separate fetch. |

---

## Backend Tasks

### 1 — Two new `AuditLog.Action` values

**File: `backend/apps/accounts/models.py`** — add to the `Action` `TextChoices` (172-181), after `ROLE_DELETED`:

```python
        ROLE_DELETED = "role_deleted", _("Role deleted")
        PORTAL_ACCESS_GRANTED = "portal_access_granted", _("Portal access granted")
        PORTAL_ACCESS_REVOKED = "portal_access_revoked", _("Portal access revoked")
```

**Generate the migration:**

```powershell
cd backend
python manage.py makemigrations accounts
```

Expect one file, `apps/accounts/migrations/0012_alter_auditlog_action.py` (the next number after `0011_grant_webhooks_permission.py`), a pure `AlterField` on `choices` — the exact shape of the existing `0007_alter_auditlog_action.py` precedent. **Commit it** — `MigrationStateTests.test_no_pending_migrations` fails the build otherwise.

---

### 2 — `portal_access_enabled` on `CustomerSerializer`

**File: `backend/apps/customers/serializers.py`** — add one field to `CustomerSerializer` (11-78) and to its `Meta.fields` (56-67):

```python
    portal_access_enabled = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = Customer
        fields = (
            "id",
            "name",
            "email",
            "phone",
            "company",
            "external_id",
            "portal_access_enabled",
            "created_at",
            "updated_at",
        )

    def get_portal_access_enabled(self, customer) -> bool:
        """Whether this customer has a linked portal-login `User`
        (`Customer.user`, Story 42). A plain column read — `user_id` lives on
        `Customer` itself, not behind a reverse accessor — so this adds no
        query. Read-only: writes go through `CustomerViewSet.portal_access`
        (task 4), never a PATCH on this field.
        """
        return customer.user_id is not None
```

Insert `portal_access_enabled` and the new `get_portal_access_enabled` method in the same relative position for both — directly after `external_id`'s own `validate_external_id` (76-78), before `ContactDetailSerializer`.

---

### 3 — `CustomerViewSet.portal_access`: grant and revoke

**File: `backend/apps/customers/views.py`** — extend the import block at the top of the file:

```python
import logging

from django.contrib.auth import get_user_model
from django.http import FileResponse
from django.utils.translation import gettext_lazy as _
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from apps.accounts.models import AuditLog, Role
from apps.accounts.tasks import send_invite_email
from apps.core.permissions import Permissions, permissions_for
from apps.core.views import BaseModelViewSet

from .models import Attachment, ContactDetail, Customer, Note
from .serializers import (
    AttachmentSerializer,
    ContactDetailSerializer,
    CustomerSerializer,
    NoteSerializer,
)
from .timeline import build_timeline

User = get_user_model()
logger = logging.getLogger(__name__)
```

Extend `CustomerViewSet.permission_map` (32-44), adding one entry after `"timeline"`:

```python
    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
        "timeline": Permissions.CUSTOMERS_VIEW,
        # One HTTP-method-agnostic entry: DRF sets `self.action` to the
        # decorated method's own name ("portal_access") for BOTH the `post`
        # and `delete` methods bound to it below — verified against the
        # installed DRF's `@action`/`MethodMapper` (rest_framework/decorators.py),
        # the same "keyed by method name, not verb" rule `timeline` above
        # already established for a single-method action.
        "portal_access": Permissions.CUSTOMERS_MANAGE,
    }
```

Add the action and its two private helpers directly after `timeline` (ends line 69), still inside `CustomerViewSet`:

```python
    @action(detail=True, methods=["post", "delete"], url_path="portal-access")
    def portal_access(self, request, pk=None):
        """CUST-5: staff-controlled portal onboarding, replacing the
        Django-admin-only path Story 42 left as intentionally temporary
        (`CONVENTIONS.md` §26). `POST` grants — reusing SEC-5's invite-email
        flow with `role=customer`; `DELETE` revokes — unlinking `Customer.user`
        and deactivating the underlying `User`, both, per the intake's own
        "unlink/deactivate" wording.
        """
        customer = self.get_object()
        if request.method == "POST":
            self._grant_portal_access(customer)
        else:
            self._revoke_portal_access(customer)
        return Response(CustomerSerializer(customer).data)

    def _grant_portal_access(self, customer: Customer) -> None:
        if customer.user_id is not None:
            raise ValidationError(
                {"non_field_errors": [_("Portal access is already enabled for this customer.")]}
            )
        if not customer.email:
            raise ValidationError(
                {"non_field_errors": [_("Add an email address before granting portal access.")]}
            )

        customer_role = Role.objects.get(slug="customer")
        existing = User.objects.filter(email=customer.email).first()

        if existing is not None:
            # `Customer.user_id` carries a UNIQUE constraint (the OneToOneField
            # compiles to one) — linking a User another Customer already holds
            # would raise IntegrityError with no guard. See `## Story Goal`.
            if getattr(existing, "customer_profile", None) is not None:
                raise ValidationError(
                    {
                        "non_field_errors": [
                            _(
                                "This email is already linked to another "
                                "customer's portal account."
                            )
                        ]
                    }
                )
            if existing.is_staff:
                raise ValidationError(
                    {
                        "non_field_errors": [
                            _(
                                "This email belongs to a staff account and cannot "
                                "also be used for portal access."
                            )
                        ]
                    }
                )
            # An orphaned, non-staff account with no current Customer link —
            # the ordinary "re-grant after a prior revoke" case. Reused, not
            # recreated: a second User row would collide on the unique `email`
            # column anyway.
            user = existing
            user.role = customer_role
            user.is_active = False
            user.set_password(None)
            user.save(update_fields=["role", "is_active", "password"])
        else:
            user = User.objects.create_user(
                email=customer.email,
                password=None,
                is_staff=False,
                is_active=False,
                role=customer_role,
                first_name=customer.name,
            )

        customer.user = user
        customer.save(update_fields=["user"])

        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.Action.PORTAL_ACCESS_GRANTED,
            target_user=user,
            target_label=customer.name,
        )
        # Best-effort, the same commit-first idiom `UserViewSet.perform_create`
        # already uses around its own `send_invite_email.delay(...)` call — a
        # down Redis/worker must never fail or roll back the already-created
        # link.
        try:
            send_invite_email.delay(user.id)
        except Exception:
            logger.exception("Failed to queue portal invite email for user %s", user.id)

    def _revoke_portal_access(self, customer: Customer) -> None:
        user = customer.user
        if user is None:
            raise ValidationError(
                {"non_field_errors": [_("Portal access is not enabled for this customer.")]}
            )
        customer.user = None
        customer.save(update_fields=["user"])
        user.is_active = False
        user.save(update_fields=["is_active"])

        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.Action.PORTAL_ACCESS_REVOKED,
            target_user=user,
            target_label=customer.name,
        )
```

`target_label=customer.name`, not `user.get_full_name()` (the pattern `UserViewSet` itself uses) — deliberate: this action is about the *customer*, and `user.get_full_name()` on a freshly created or still-pending account is frequently blank or just the email. Naming the customer is what makes the audit row legible.

`User.objects.create_user(..., is_active=False, ...)` — **`is_active=False` must be passed explicitly.** `UserManager.create_user` (`apps/accounts/models.py:26-29`) does not force it (only `UserAdminSerializer.create` does, by setting `validated_data["is_active"] = False` before calling `create_user` — verified at `apps/accounts/serializers.py:167`). Without it, the new account would default to `is_active=True` with merely an unusable password — and `InviteConfirmSerializer.validate` (`apps/accounts/serializers.py:196`) filters on `is_active=False` explicitly, so the invite link would never resolve to this user at all.

---

## Frontend Tasks

### 4 — `Customer` type

**File: `frontend/src/features/customers/types/customer.ts`** — add one field to `Customer` (1-11); `CustomerInput` (13-19) is unchanged:

```ts
export type Customer = {
  id: number
  name: string
  email: string | null
  phone: string
  company: string
  portal_access_enabled: boolean
  created_at: string
  updated_at: string
}
```

---

### 5 — API layer

**Create file: `frontend/src/features/customers/api/grantPortalAccess.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Customer } from '../types/customer'

export function grantPortalAccess(customerId: number): Promise<Customer> {
  return api.post<Customer>(`/customers/${customerId}/portal-access/`)
}
```

**Create file: `frontend/src/features/customers/api/revokePortalAccess.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { Customer } from '../types/customer'

export function revokePortalAccess(customerId: number): Promise<Customer> {
  return api.delete<Customer>(`/customers/${customerId}/portal-access/`)
}
```

**File: `frontend/src/features/customers/api/useCustomerMutations.ts`** — add two hooks, following `useDeleteCustomer`'s exact shape:

```ts
import { grantPortalAccess } from './grantPortalAccess'
import { revokePortalAccess } from './revokePortalAccess'

export function useGrantPortalAccess(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => grantPortalAccess(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useRevokePortalAccess(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => revokePortalAccess(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}
```

---

### 6 — `CustomerProfilePage.tsx`: the status badge and the button

**File: `frontend/src/features/customers/components/CustomerProfilePage.tsx`**

Add two imports:

```tsx
import { Badge } from '@/shared/ui/primitives/badge'
import { useToast } from '@/shared/ui/toast/useToast'

import { useGrantPortalAccess, useRevokePortalAccess } from '../api/useCustomerMutations'
```

Inside `CustomerProfilePage`, beside the existing `deleteMutation`:

```tsx
  const { toast } = useToast()
  const grantMutation = useGrantPortalAccess(id)
  const revokeMutation = useRevokePortalAccess(id)

  function handleGrantPortalAccess() {
    grantMutation.mutate(undefined, {
      onSuccess: () => toast({ tone: 'success', message: t('portalAccess.granted') }),
      // A failure is already toasted by the shared mutation error handler —
      // CONVENTIONS.md §21.
    })
  }

  async function handleRevokePortalAccess() {
    const confirmed = await confirm({
      title: t('portalAccess.revokeConfirm.title'),
      description: t('portalAccess.revokeConfirm.description'),
      destructive: true,
    })
    if (!confirmed) return
    revokeMutation.mutate(undefined, {
      onSuccess: () => toast({ tone: 'success', message: t('portalAccess.revoked') }),
    })
  }
```

In the `<dl>` grid (61-78), add one more entry after `createdAt`:

```tsx
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('portalAccess.label')}</dt>
                      <dd>
                        <Badge variant={customer.portal_access_enabled ? 'success' : 'secondary'}>
                          {t(
                            customer.portal_access_enabled
                              ? 'portalAccess.enabled'
                              : 'portalAccess.disabled',
                          )}
                        </Badge>
                      </dd>
                    </div>
```

In the `<Can permission="customers.manage">` button row (79-93), add the Grant/Revoke control after the existing Delete button:

```tsx
                      {customer.portal_access_enabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={revokeMutation.isPending}
                          onClick={() => void handleRevokePortalAccess()}
                        >
                          {t('portalAccess.revoke')}
                        </Button>
                      ) : customer.email ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={grantMutation.isPending}
                          onClick={handleGrantPortalAccess}
                        >
                          {t('portalAccess.grant')}
                        </Button>
                      ) : (
                        <span className="self-center text-sm text-muted-foreground">
                          {t('portalAccess.noEmailHint')}
                        </span>
                      )}
```

The `customer.email`-gated hint is **UX only** — the backend's own `_grant_portal_access` rejects a missing email independently (task 3); this just avoids a round-trip that would always fail with a predictable message.

---

### 7 — Customers locale: `portalAccess`

**File: `frontend/src/features/customers/locales/en.json`** — add a new top-level object, after `notFound` and before `contacts`:

```json
  "portalAccess": {
    "label": "Portal access",
    "enabled": "Enabled",
    "disabled": "Disabled",
    "grant": "Grant portal access",
    "revoke": "Revoke portal access",
    "noEmailHint": "Add an email address to grant portal access.",
    "granted": "Portal access granted. An invite email was sent.",
    "revoked": "Portal access revoked.",
    "revokeConfirm": {
      "title": "Revoke portal access?",
      "description": "The customer will no longer be able to sign in to the portal."
    }
  },
```

**File: `frontend/src/features/customers/locales/ar.json`** — the same key structure, in the same position:

```json
  "portalAccess": {
    "label": "الوصول إلى البوابة",
    "enabled": "مفعّل",
    "disabled": "غير مفعّل",
    "grant": "منح الوصول إلى البوابة",
    "revoke": "إلغاء الوصول إلى البوابة",
    "noEmailHint": "أضف بريدًا إلكترونيًا لمنح الوصول إلى البوابة.",
    "granted": "تم منح الوصول إلى البوابة. تم إرسال دعوة عبر البريد الإلكتروني.",
    "revoked": "تم إلغاء الوصول إلى البوابة.",
    "revokeConfirm": {
      "title": "هل تريد إلغاء الوصول إلى البوابة؟",
      "description": "لن يتمكن العميل بعد الآن من تسجيل الدخول إلى البوابة."
    }
  },
```

---

### 8 — Audit-log frontend: two new action values

**File: `frontend/src/features/audit-log/types/auditLog.ts`** — extend `AUDIT_LOG_ACTIONS` (2-11):

```ts
export const AUDIT_LOG_ACTIONS = [
  'user_created',
  'user_role_changed',
  'user_status_changed',
  'user_deleted',
  'role_created',
  'role_renamed',
  'role_permissions_changed',
  'role_deleted',
  'portal_access_granted',
  'portal_access_revoked',
] as const
```

**File: `frontend/src/features/audit-log/locales/en.json`** — extend the `actions` object (21-30):

```json
    "role_deleted": "Role deleted",
    "portal_access_granted": "Portal access granted",
    "portal_access_revoked": "Portal access revoked"
```

**File: `frontend/src/features/audit-log/locales/ar.json`** — the same two keys, translated:

```json
    "role_deleted": "تم حذف الدور",
    "portal_access_granted": "تم منح الوصول إلى البوابة",
    "portal_access_revoked": "تم إلغاء الوصول إلى البوابة"
```

These drive only the filter dropdown (`AuditLogListPage.tsx:93-97`) — the table's own `action` column reads `row.action_display`, the backend's label from task 1, unaffected by this task.

---

## Documentation Tasks

### 9 — `CONVENTIONS.md` §26

**File: `CONVENTIONS.md`** — replace the closing paragraph of §26 (lines 1846-1851):

```markdown
**Provisioning is Django-admin-only, by design, until a later epic builds a
screen.** A staff member creates a `User`, assigns it the `customer` role,
then links it to a `Customer` row's `user` field — the same
admin-first-until-SEC-1 pattern § 22 already documents for staff role
assignment. There is no self-service registration and no combined
create-and-link form.
```

with:

```markdown
**Provisioning is a staff-facing action on the customer profile — `CUST-5`
(Story 85).** `CustomerViewSet.portal_access` (`POST` grants, `DELETE`
revokes, gated on `customers.manage`) is the primary path: grant creates or
reuses a `User(role=customer, is_staff=False)` in exactly the same
`is_active=False` + unusable-password pending state `SEC-5`'s
`UserAdminSerializer.create` leaves for a new staff account, and dispatches
the same `send_invite_email` task; revoke unlinks `Customer.user` and sets
`User.is_active = False` together. Django admin's `Customer.user` field
(Story 42) is unchanged and still usable as a manual fallback — the same
role Django admin keeps for `Role`/`User` after `SEC-1`/`SEC-2` shipped their
own screens over those. Still no self-service registration: only a staff
member with `customers.manage` can grant or revoke.
```

§26's heading and every other paragraph are unchanged; §0-§25 and §27+ are not renumbered.

---

## Edge Cases & Failure Modes

- **Revoke must set BOTH `Customer.user = None` and `User.is_active = False` — either alone leaves a gap.** Unlinking alone (`Customer.user = None`) would leave the `User` row fully active with a real password: nothing stops that person from logging in, it would simply no longer resolve to a `Customer` for portal-scoping purposes (`CustomerScopedModelViewSet.get_queryset()` would then return `.none()` for them — silent data denial, not a revoked login, the opposite of the intake's "revoke"). Deactivating alone (`User.is_active = False`, leaving `Customer.user` set) would correctly block login but leave `portal_access_enabled` reading `True` — a status indicator lying to staff about whether access is off. Both together close both gaps.
- **Revoke is immediate for a live session, not just the next login.** Verified: `JWTAuthentication` checks `is_active` on every authenticated request (`CHECK_USER_IS_ACTIVE=True` by default, unmodified by this project's `SIMPLE_JWT` setting). A customer mid-session when revoked gets `401` on their very next API call — no separate token-blacklisting step is needed for this story's purposes, the same guarantee `SEC-5`'s pending accounts already rely on.
- **Re-granting after a revoke reuses the same `User` row rather than creating a second one.** `User.email` is unique; a naive "always `create_user`" would raise `IntegrityError` the second time the same customer is granted, revoked, and granted again. `_grant_portal_access`'s `existing = User.objects.filter(email=customer.email).first()` branch is what makes re-grant idempotent-safe rather than a 500 on the second attempt.
- **Granting an email already used by another customer's portal account is rejected with a clean `400`, not an `IntegrityError`.** `Customer.user_id` is unique (the `OneToOneField`'s own constraint) — see `## Story Goal`'s worked-through reasoning. Verification Step 6 exercises this by hand.
- **Granting an email that belongs to a staff account is rejected, not silently linked.** Linking a staff `User` as a `customer_profile` would make `UserViewSet.get_queryset()`'s `customer_profile__isnull=True` filter (Story 48) exclude that person from the staff Users list entirely — a real, security-relevant regression this guard exists specifically to prevent, not a defensive nicety. Verification Step 7.
- **Granting with no email on the `Customer` record is rejected server-side, independent of the frontend's disabled-button UX.** `CONVENTIONS.md` §12's "the backend owns authorization/validation" posture — a hand-crafted `POST` with no email on the customer still gets the same `400`, not a `500` from `create_user(email=None, ...)` colliding with `User.email`'s `NOT NULL` constraint.
- **A Celery worker or Redis outage at grant time never blocks the grant itself.** `send_invite_email.delay(...)` is wrapped in the same `try/except Exception: logger.exception(...)` `UserViewSet.perform_create` already uses — the `Customer.user` link and the `AuditLog` row both commit regardless; only the email never gets queued. No resend mechanism exists (same standing gap `SEC-5` already carries, not newly introduced here).
- **`AuditLog.target_label` is the customer's name, not the linked user's** — deliberately different from `UserViewSet`'s own `user.get_full_name()` convention, because a freshly created or still-pending account's name is frequently blank. See task 3's inline note.
- **The two new `AuditLog.Action` labels are English-only, matching every existing label.** No `.po` entry is added for either — verified none of the eight existing labels have one either; `action_display` has never been translated for this table.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing suite must still pass; `MigrationStateTests.test_no_pending_migrations` is what catches task 1's `choices` change shipping without its migration.
2. `ruff format --check .` / `ruff check .` on the new and changed Python.
3. `npm run build` — typechecks the new `Customer.portal_access_enabled`, `grantPortalAccess`/`revokePortalAccess`, the two new mutation hooks, and every new `t('customers:portalAccess....')`/`t('auditLog:actions.portal_access_...')` key.
4. `npm run lint`, `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison (the same script `.squad/plans/customer-management/10-story-customer-profiles-SUPPORTOS-28.md` Verification Step 4 introduced), run against `frontend/src/features/customers/locales/{en,ar}.json` and again against `frontend/src/features/audit-log/locales/{en,ar}.json`.
6. Real HTTP across the full grant → invite → confirm → login → revoke chain, plus the three conflict cases — Verification Steps 2-9 below.

---

## Migration / Rollback

**One migration, additive, no reset.** `apps/accounts/migrations/0012_alter_auditlog_action.py` only changes the `choices` metadata on an existing `CharField` — no column type change, no data migration, no existing row affected.

**Rollback of the code:** revert the commits. No `pip install`/`npm install` — no new dependency in either app.

**Rollback of the schema:** `python manage.py migrate accounts 0011_grant_webhooks_permission` reverses the `choices` metadata change. Safe regardless of whether any `PORTAL_ACCESS_GRANTED`/`PORTAL_ACCESS_REVOKED` rows exist — `AlterField` on `choices` alone does not constrain existing data, so rows with those action values remain readable (Django does not validate stored values against `choices` at the database level), they simply would not re-validate through a form using the old choice list. Not a concern in practice since this migration is not expected to be rolled back after real grants/revokes have happened.

**Half-applied states to avoid:**

- **Task 1's `Action` values before their migration** → `MigrationStateTests.test_no_pending_migrations` fails the build. Commit together.
- **Task 3 (`portal_access` action) before task 1 (`AuditLog.Action` values)** → `AuditLog.Action.PORTAL_ACCESS_GRANTED` raises `AttributeError` the first time the action runs. Ship task 1 first.
- **Task 6/7 (frontend button/locale) before task 4/5 (`Customer` type/API layer)** → `t('customers:portalAccess...')` calls and the `Customer.portal_access_enabled` reference fail `tsc -b`. Ship 4-5 before 6-7.
- **Task 9's `CONVENTIONS.md` rewrite shipped without the code it describes** → a future reader hits a documented behaviour that does not exist yet. Ship last, after Verification Steps 2-9 pass.

---

## Verification Steps

1. **Backend checks and formats clean, and migrate cleanly:** from `backend/` — `python manage.py check`, `ruff format --check .`, `ruff check .`, then `python manage.py migrate` (expect `accounts.0012_alter_auditlog_action` to apply), then `python manage.py test`.
2. **`portal_access_enabled` reads correctly and costs no extra query.** With the server running and a customer that has no linked user: `curl.exe -s http://127.0.0.1:8000/api/customers/<id>/ -H "Authorization: Bearer $agentToken"` → `portal_access_enabled: false`.
3. **Grant with no email is rejected.** `curl.exe -s -X POST http://127.0.0.1:8000/api/customers/<id>/portal-access/ -H "Authorization: Bearer $agentToken"` against a customer whose `email` is `null` → `400 validation_error`, `non_field_errors` naming the missing email.
4. **Grant creates a pending account and sends the invite.** Set the customer's email first (`PATCH .../customers/<id>/`), then repeat step 3's `POST` → `200`, `portal_access_enabled: true` in the response. Then: `python manage.py shell -c "from apps.customers.models import Customer; c=Customer.objects.get(pk=<id>); print(c.user.is_staff, c.user.is_active, c.user.has_usable_password(), c.user.role.slug)"` → `False False False customer`. Celery worker console shows the invite email with a `/set-password?token=...` link.
5. **The invite confirms and the account logs in, exactly like a staff invite.** Copy the token from step 4's email, `POST /api/auth/invite/confirm/` with a valid password → `200`; then `POST /api/auth/token/` with the customer's email/new password → `200`, a real token pair. `GET /api/auth/me/` with that token → `role: {slug: "customer"}`, `permissions: ["portal.access"]`.
6. **Granting an email already linked to another customer is rejected.** Create a second customer with no email, `PATCH` its email to the *same* email used in step 4, then `POST .../portal-access/` for it → `400`, `non_field_errors` naming the conflict — not a `500`.
7. **Granting a staff account's email is rejected.** `POST .../portal-access/` for a customer whose `email` matches an existing staff account's `email` (e.g. `agent@supportos.local`) → `400`, `non_field_errors` naming the staff-account conflict. Confirm via Django shell that the staff account's `role`/`customer_profile` are unchanged afterward.
8. **Revoke unlinks and deactivates, and the customer is logged out immediately.** With the customer from step 5 signed in (a live access token in hand), `DELETE http://127.0.0.1:8000/api/customers/<id>/portal-access/ -H "Authorization: Bearer $agentToken"` → `200`, `portal_access_enabled: false`. Then, with the customer's own still-unexpired access token, `GET /api/auth/me/` → `401` (not `403`) — proving the deactivation is enforced by `JWTAuthentication` itself, immediately.
9. **Re-granting after a revoke reuses the same account, not a second one.** Repeat step 4's `POST` for the same customer → `200`; `python manage.py shell -c "from django.contrib.auth import get_user_model; print(get_user_model().objects.filter(email='<email>').count())"` → `1`, not `2`. A fresh invite email is sent (Celery console).
10. **Every `AuditLog` row lands correctly.** `GET /api/audit-logs/?action=portal_access_granted` and `?action=portal_access_revoked` (as `admin@`) each return the rows from steps 4/5/9 and step 8, `target_label` matching the customer's name.
11. **No ad-hoc permission check bypassed.** No token → `401 not_authenticated` on both `POST` and `DELETE .../portal-access/`. A token for a role without `customers.manage` → `403 permission_denied` on both.
12. **The full UI walkthrough, both languages.** `npm run dev` with the backend/worker/Redis up, signed in as `agent@`: open a customer with no email → "Portal access: Disabled" badge, no Grant button, the "add an email" hint shown instead. Add an email, save, reopen the profile → Grant button appears; click it → success toast, badge flips to "Enabled", button becomes Revoke. Click Revoke → confirm dialog appears, confirm → success toast, badge flips back to "Disabled". Switch to Arabic: badge text, button labels, and the confirm dialog are all translated, `dir="rtl"`.
13. **`en`/`ar` key sets match** for both `customers` and `auditLog` namespaces (`## Test Plan` item 5).
14. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `AuditLog.Action` gains `PORTAL_ACCESS_GRANTED`/`PORTAL_ACCESS_REVOKED`; `apps/accounts/migrations/0012_alter_auditlog_action.py` applies with no data change.
- [ ] `CustomerSerializer.portal_access_enabled` reflects `customer.user_id is not None`, read-only, present on `list` and `retrieve`.
- [ ] `CustomerViewSet.portal_access` (`POST`/`DELETE`, `url_path="portal-access"`) exists, gated by `permission_map["portal_access"] = Permissions.CUSTOMERS_MANAGE` — no new `Permissions` constant, no new role-grant migration.
- [ ] Grant produces a `User(role=customer, is_staff=False, is_active=False)` with an unusable password, reuses an existing orphaned account instead of creating a duplicate on re-grant, and rejects (400, not 500) a missing email, an email already linked to another customer, and an email belonging to a staff account (Verification Steps 3, 6, 7, 9).
- [ ] Revoke sets `Customer.user = None` **and** the underlying `User.is_active = False`; a revoked customer's live access token fails with `401` on its very next request (Verification Step 8).
- [ ] Both grant and revoke write an `AuditLog` row with the correct `Action` and `target_label = customer.name` (Verification Step 10).
- [ ] The invite email is dispatched via the unmodified `send_invite_email` task, and `POST /api/auth/invite/confirm/` activates the account exactly as it does for a staff invite (Verification Step 5) — no changes to `tokens.py`, `InviteConfirmSerializer`, or `InviteConfirmView`.
- [ ] `frontend/src/features/customers/types/customer.ts`'s `Customer` gains `portal_access_enabled: boolean`; `CustomerInput` is unchanged.
- [ ] `grantPortalAccess.ts`/`revokePortalAccess.ts` + `useGrantPortalAccess`/`useRevokePortalAccess` exist, following the existing one-function-per-file and invalidate-`customerKeys.all` conventions.
- [ ] `CustomerProfilePage.tsx` shows an Enabled/Disabled badge and a Grant/Revoke button, gated by `<Can permission="customers.manage">` exactly like the existing Edit/Delete buttons; Revoke goes through a confirm dialog, Grant does not; a missing email hides the Grant button behind an explanatory hint (UX only — the backend enforces this independently).
- [ ] `frontend/src/features/audit-log/types/auditLog.ts`'s `AUDIT_LOG_ACTIONS` and both `auditLog` locale files' `actions` maps include the two new values; the audit-log filter dropdown and the table's `action_display` column both show them correctly (Verification Step 10).
- [ ] `en`/`ar` key sets match in both `customers` and `auditLog` namespaces (Verification Step 13).
- [ ] `CONVENTIONS.md` §26's closing paragraph is rewritten per task 9; §0-§25/§27+ are not renumbered.
- [ ] `python manage.py test` passes; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/customer-management/00-overview.md` updated with this story's row.
