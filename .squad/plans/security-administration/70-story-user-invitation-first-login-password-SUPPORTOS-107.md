# Story 70 — New User Invitation & First-Login Password Setup (Story: SUPPORTOS-107)

## Prerequisites

- **Story 48 completed:** [48-story-users-roles-admin-SUPPORTOS-72.md](48-story-users-roles-admin-SUPPORTOS-72.md) (`SEC-1`). This story replaces the admin-supplied `password` field `UserAdminSerializer`/`UserFormPage.tsx` shipped there — see `## Context` for the exact current state of both.
- **Story 31 completed:** [../sla-automation/31-story-alerts-notifications-SUPPORTOS-63.md](../sla-automation/31-story-alerts-notifications-SUPPORTOS-63.md) (`SLA-4`). This story reuses its email infrastructure wholesale (`settings.EMAIL_BACKEND`/`DEFAULT_FROM_EMAIL`, `django.core.mail.EmailMessage`, a `@shared_task` in a new `apps/<app>/tasks.py` auto-discovered by `config/celery.py`) — **not** `apps.notifications.services.notify`/`Notification` itself, which is an in-app-alert record tied to an authenticated recipient and has no shape for a not-yet-active account. See `## Story Goal` for why.
- **Story 08 completed** (`AUTH-1`, [../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md](../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md)) — `User.is_active=False` already blocks a login attempt through Django's `ModelBackend.user_can_authenticate` (called internally by `TokenObtainPairSerializer`'s `authenticate()`), and `set_unusable_password()` blocks it a second, independent way. No change to the login endpoint is needed for either guard to hold.
- Verified backend baseline (this session, live): `python manage.py test` reports **54** passing, matching `CONVENTIONS.md` § 16's own citation. This story ships no migration, so `MigrationStateTests.test_no_pending_migrations` stays a no-op check, not a new risk.
- Verified: no invite/token/password-reset mechanism exists anywhere in this codebase today except `apps.communications.live_chat_adapter`'s unrelated `signing.dumps`/`signing.loads(..., max_age=...)` session-token pattern (`LIVE_CHAT_SALT`/`SESSION_MAX_AGE_SECONDS`, `apps/communications/live_chat_adapter.py:13-30`) — this story's token module (task 1 below) copies that pattern exactly, for a different payload.
- Verified: `backend/config/settings/base.py` has no `FRONTEND_URL` setting today (grep confirmed) — task 4 adds one. `CORS_ALLOWED_ORIGINS` already defaults to `http://localhost:5173` (`base.py:209-211`), so the new setting's default matches an already-established local origin, not a new guess.

---

## Story Goal

Replace `UserAdminSerializer.create`'s admin-supplied password with an emailed, self-service "set your password" step, so an admin creating a staff account never learns — and never has to relay out-of-band — that account's password.

1. **Backend** — `POST /api/users/` still creates the `User` row (unchanged endpoint, unchanged permission), but the account comes out **unusable**: `is_active=False` and an unusable password (`set_password(None)`), regardless of whatever the caller sends. A new `POST /api/auth/invite/confirm/` (`token`, `password`) is the only way to activate it. The invite email is queued through the exact infrastructure `SLA-4` already built (`EmailMessage`, `DEFAULT_FROM_EMAIL`, a new `apps/accounts/tasks.py` `@shared_task`), not a new provider or a second in-app-notification record.
2. **Frontend** — `UserFormPage.tsx`'s create form drops the `password` field (SEC-1 shipped it) and the now-inert `is_active` toggle (a new account is unusable no matter what an admin picks — leaving a control that silently does nothing is worse than removing it). A new public `SetPasswordPage` (opened from the emailed link, no session required) collects the new password and calls the confirm endpoint.

### Two verified findings that shape this story beyond the intake's own wording

**1. The invite token is single-use through a password-state check, not a nonce.** The token itself (`apps.accounts.tokens.make_password_token`) encodes only the user id and an expiry timestamp — the same minimal shape `LiveChatAdapter`'s session token uses. What makes it single-use is `InviteConfirmSerializer.validate` requiring **both** `is_active=False` **and** `not user.has_usable_password()` before accepting it — not `is_active=False` alone. This matters because `is_active` is a general-purpose field `UserViewSet.update` already lets an admin flip for unrelated reasons (deactivating someone for cause, long after their invite was accepted). If the confirm check only asked `is_active=False`, a still-cryptographically-valid invite token sitting in an old inbox — from before that later, unrelated deactivation — would let its holder "confirm" again and set a brand-new password on an account an admin explicitly disabled. Gating on `has_usable_password()` closes this: once an invite is consumed once, the flag flips permanently true and the same token can never succeed again, independent of any later `is_active` change. See `## Edge Cases`.

**2. `apps.notifications.services.notify` is the wrong reuse target, even though it is "the shared notification service... reused by tasks, collaboration, SLA, AI" per its own docstring.** `notify()` creates an in-app `Notification` row against an authenticated `recipient` and a `Kind` enum with no case that fits "you have no account yet, here is how to activate it" — and its in-app half (a channel-layer push to `notifications_{recipient.id}`, a row a signed-in user reads via `NotificationViewSet`) is meaningless for someone who cannot sign in yet. What this story actually reuses from `SLA-4` is one layer down: the **email transport** (`settings.EMAIL_BACKEND`/`DEFAULT_FROM_EMAIL`, `django.core.mail.EmailMessage`, the `@shared_task`-in-`apps/<app>/tasks.py` convention `config/celery.py`'s `autodiscover_tasks()` already picks up with no wiring). `apps/accounts/tasks.py::send_invite_email` is this story's own task, sibling to `apps/notifications/tasks.py::send_notification_email` and `apps/sla/tasks.py`, not a caller of either.

### Explicitly out of scope

- **Resending an invite, or any "invite expired, contact an admin" self-service recovery.** A stuck invite is an ops/admin problem for now — see `## Edge Cases`.
- **Forgot-password / self-service reset for an already-active account (`SEC-7`).** This story's `apps.accounts.tokens` module is written so `SEC-7` can add its own salt and call `make_password_token`/`read_password_token` unmodified — see the intake's own "🔑 (the token mechanism the Password Self-Service epic's forgot-password story reuses)" — but `SEC-7` itself is not built here.
- **Change password for a signed-in user (`SEC-8`).** Unrelated flow, unbuilt.
- **A distinct "Invited (pending)" badge/status.** A pending account and a deliberately deactivated one both show today's existing `is_active: false` → "Inactive" badge on `UserListPage`. Building a third visible state is not asked for by the intake and is flagged, not built — see `## Edge Cases`.
- **Automated tests.** Standing policy (`CONVENTIONS.md` § 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-107/intake.md` — one description, two task blocks (backend invite issuance + confirm endpoint; frontend confirm UI + admin-form update), no attachments, no acceptance criteria. Done Criteria below derive from its own "the account stays unusable until they do" / "admins create accounts without ever handling a new user's password" framing.
2. `backend/apps/accounts/serializers.py` (all 207 lines) — `UserAdminSerializer` (lines 96-168) is what task 2 replaces in full; read its current `password` field (114-119), `Meta.fields` (123-136, `"password"` at 135), `validate_password`/`validate` (139-146), and `create`/`update` (148-168) — every one of these changes. `RoleAdminSerializer`, `RoleSerializer`, `UserSerializer`, `AuditLogSerializer`, `LogoutSerializer` are all **unchanged**.
3. `backend/apps/accounts/views.py` (all 300 lines) — `LogoutView` (27-48, the "no Authorization header, the body's token IS the credential" precedent task 3's `InviteConfirmView` copies), `UserViewSet.perform_create` (106-114, where task 5 adds the invite-email dispatch right after the existing `AuditLog.objects.create(...)` call), and the top-of-file import block (1-24, where `logging`, `InviteConfirmSerializer`, and `.tasks.send_invite_email` all get added).
4. `backend/apps/accounts/urls.py` (all 13 lines) — the `auth/`-prefixed, router-free module `LogoutView`/`MeView`/the two SimpleJWT views already live in. Task 4 adds one more `path()` here, not to `admin_urls.py` (that module is the permission-gated `/api/users/`/`/api/roles/`/`/api/audit-logs/` router — this is a pre-auth, `AllowAny` endpoint, the same category as `token/`/`logout/`).
5. `backend/apps/communications/live_chat_adapter.py:1-30` — `LIVE_CHAT_SALT`, `SESSION_MAX_AGE_SECONDS`, and `resolve_session_ticket`'s `signing.loads(token, salt=..., max_age=...)` / `except signing.BadSignature` shape. Task 1's `apps/accounts/tokens.py` copies this exactly (`signing.BadSignature` is the base class `signing.SignatureExpired` also raises from, verified — one `except` already covers both "tampered" and "expired" here).
6. `backend/apps/notifications/tasks.py` (all 39 lines) and `backend/apps/notifications/services.py` (all 60 lines) — `send_notification_email`'s `EmailMessage(subject=..., body=..., from_email=settings.DEFAULT_FROM_EMAIL, to=[...])` / `.send()` shape task 6's `send_invite_email` copies; `notify()`'s `try/except Exception: logger.exception(...)` best-effort wrapping around `send_notification_email.delay(...)` (`services.py:55-58`) is the shape task 5's invite-dispatch wrapping copies — and see `## Story Goal` finding 2 for why `notify()` itself is not called.
7. `backend/config/settings/base.py:206-224` (the `--- CORS ---` block) — where task 4 inserts the new `FRONTEND_URL` setting, matching `CORS_ALLOWED_ORIGINS`' own `http://localhost:5173` default (verified: no `FRONTEND_URL` exists today, confirmed by grep).
8. `backend/config/celery.py` (all 41 lines) — `app.autodiscover_tasks()` (line 30) is why `apps/accounts/tasks.py` (task 6) needs no registration; `CONVENTIONS.md` § 24's own line "`SLA-4` is the second feature to add its own `tasks.py` module... confirming `app.autodiscover_tasks()` needs no per-app registration" is what task 7 extends to a third.
9. `backend/apps/core/permissions.py:18-38` (`Permissions`) — confirms every constant this story needs (`USERS_MANAGE` on `create`, unchanged) already exists; this story adds **no new permission constant**.
10. `backend/.env.example:27-31` (the `--- API / CORS ---` block) — task 4 adds `FRONTEND_URL=http://localhost:5173` here, beside `CORS_ALLOWED_ORIGINS`.
11. `frontend/src/features/accounts/components/UserFormPage.tsx` (all 281 lines) — `baseShape`/`createSchema`/`editSchema` (33-42), `UserCreateForm` in full (81-184, especially the `password` `TextField` at 161-167 and the `SwitchField` at 156-160 — both removed), `UserEditForm` (186-280, **unchanged** except for the shared-shape refactor). This is SEC-1's exact current shipped state, not the plan text — verified by reading the live file, which already differs slightly from Story 48's own plan body (e.g. `roles.manage`-gated route split, an `ArticleFormPage`-style `t('actions.cancel', {ns:'common'})`).
12. `frontend/src/features/accounts/types/user.ts` (all 27 lines) — `UserCreateInput` (17-24, includes `password`/`is_active`, both removed) and `UserUpdateInput` (27, currently `Omit<UserCreateInput, 'password'>` — becomes its own explicit shape once `UserCreateInput` no longer has `is_active` to omit *from*).
13. `frontend/src/features/accounts/locales/en.json:1-26` and `ar.json:1-26` — the `users` namespace: `fields.password` (removed, no longer rendered anywhere), `created` (renamed `inviteSent`, copy changes from "created" to "an invite was sent").
14. `frontend/src/features/auth/components/LoginPage.tsx` (all 103 lines) — the public, unauthenticated `useAppForm` + `TextField` + `Card` shape task 9's `SetPasswordPage` follows exactly (schema, `useMutation`, `isValidationError`/`applyServerErrors`, no `QueryBoundary` — there is no query, only a mutation).
15. `frontend/src/features/web-form/components/WebFormPage.tsx` (all 149 lines) — the two-component "outer picks success-vs-form state, inner owns the form" split (37-58 is the outer `WebFormPage`, 60-149 is the inner `WebForm`) task 9's `SetPasswordPage`/`SetPasswordForm` split copies, including the `CheckCircle2Icon`/`text-success` success-card shape (41-55).
16. `frontend/src/shared/lib/api/client.ts` (all 175 lines) — `api.post<T>(url, payload)` (139-142), used unchanged by task 8's `confirmInvite`.
17. `frontend/src/shared/validation/serverErrors.ts` (all 53 lines) — `applyServerErrors` (28-53): a server field error for a form field that does not exist on the current form (e.g. `token` on a form whose only field is `password`) is pushed to the returned `unattached` array (lines 42-45) rather than silently dropped — this is what makes an invalid/expired-token error surface through `FormErrorSummary` with no special-case code in `SetPasswordPage`.
18. `frontend/src/app/router.tsx:8-41` — the `PublicLayout`'s existing three children (`login`, `chat`, `contact`), all unauthenticated. Task 10 adds a fourth, `set-password`.
19. `frontend/src/app/PublicLayout.tsx` (all 17 lines) — confirms the shell task 10's new route renders inside: no `Sidebar`, no nav, "a visitor who isn't signed in... should see a clean, standalone screen."
20. `frontend/src/README.md:89-100` (`## Authentication & authorization`) — line 98's "`src/features/auth/` holds `LoginPage`, built from `useAppForm` + `TextField` like any other form" is what task 11 extends to name `SetPasswordPage` too.
21. `CONVENTIONS.md` § 16 (lines 251-258, no automated tests — the **54** figure verified live this session), § 21 (lines 651-738, Authentication/JWT — task 11 appends one entry here, before the `---` at line 739), § 24 (lines 1453-1498, Celery/`tasks.py` — cites `SLA-4` as "the second feature to add its own `tasks.py` module," which this story's task 6 makes the third).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **An admin never sees or sets a new user's password.** | Intake | `UserAdminSerializer` has no `password` field at all; `create()` always calls `create_user(password=None, ...)`. |
| **The account stays unusable until the invite is completed.** | Intake | `create()` forces `is_active=False` regardless of caller input; `set_password(None)` marks the password unusable. Both independently block login (§ 21, § 13). |
| **The invite token is single-use and expiring.** | Intake | `signing.dumps`/`loads(..., max_age=...)` (expiry) + `InviteConfirmSerializer.validate`'s `not user.has_usable_password()` check (single-use) — see `## Story Goal` finding 1. |
| **Reuse `SLA-4`'s email delivery — no second email-sending mechanism.** | Intake | `apps/accounts/tasks.py::send_invite_email` uses the exact same `EmailMessage`/`DEFAULT_FROM_EMAIL`/`EMAIL_BACKEND` `apps/notifications/tasks.py::send_notification_email` already uses. No new setting, no new package. |
| **Through the standard API envelope/error model.** | Intake | `InviteConfirmView` is a plain `APIView` behind `envelope_exception_handler` like every other endpoint; a `serializers.ValidationError` on `validate()` renders as the normal `validation_error` envelope, field `token`. |
| **The backend enforces this even if the frontend is bypassed.** | § 22's general posture | `is_active`/password-unusable are forced server-side in `create()`, not left to the frontend omitting the fields. A hand-crafted `POST /api/users/` with `is_active: true` still comes out `is_active: false`. |

---

## Backend Tasks

### 1 — Invite token module

**Create file: `backend/apps/accounts/tokens.py`**

```python
"""Signed, time-limited tokens for account credential flows — SEC-5's
invite-confirm token. Reuses `django.core.signing.dumps`/`loads` with a
salt and `max_age`, the exact pattern `apps.communications.live_chat_adapter`
established (`LIVE_CHAT_SALT`/`SESSION_MAX_AGE_SECONDS`,
apps/communications/live_chat_adapter.py:13-30) for a different kind of
signed reference. SEC-7 (forgot-password, backlog — see
`.squad/plans/security-administration/00-overview.md`) is expected to reuse
`make_password_token`/`read_password_token` unmodified with its own salt,
per this story's own intake: "the token mechanism the Password
Self-Service epic's forgot-password story reuses".
"""

from django.core import signing

INVITE_SALT = "apps.accounts.invite"
# 3 days: long enough that someone invited on a Friday can still accept it
# the following Monday, short enough that a leaked invite email is not a
# standing liability. A plain constant, not an ENV var — the same
# internal-tuning-knob reasoning `SESSION_MAX_AGE_SECONDS` documents for
# itself.
INVITE_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 3


def make_password_token(user_id: int, *, salt: str = INVITE_SALT) -> str:
    return signing.dumps(user_id, salt=salt)


def read_password_token(
    token: str, *, salt: str = INVITE_SALT, max_age: int = INVITE_TOKEN_MAX_AGE_SECONDS
) -> int | None:
    """Verify a signed token and return the user id it names, or None if
    missing, tampered with, or expired. Mirrors
    `apps.communications.live_chat_adapter.resolve_session_ticket` exactly
    — `signing.BadSignature` is the base class `signing.SignatureExpired`
    raises from too, so one `except` already covers both.
    """
    if not token:
        return None
    try:
        return signing.loads(token, salt=salt, max_age=max_age)
    except signing.BadSignature:
        return None
```

---

### 2 — Replace `UserAdminSerializer`; add `InviteConfirmSerializer`

**File: `backend/apps/accounts/serializers.py`**

Add `from .tokens import read_password_token` to the import block (after `from .models import AuditLog, Role`).

Replace the entire `UserAdminSerializer` class (current lines 96-168) with:

```python
class UserAdminSerializer(serializers.ModelSerializer):
    """CRUD over `User` for SEC-1's admin screen. Deliberately NOT
    `BaseModelSerializer` — `User` has no `created_at`/`updated_at`, the
    same reason `UserSerializer` above is not (Story 08 `## Context` item 5).

    `is_staff`/`is_superuser` are read-only and shown only for display (e.g.
    explaining why an account with `role: null` still has full access, per
    `/auth/me/`'s own superuser note in `permissions_for`) — granting either
    is a Django-admin-only action, never exposed through this API.

    No `password` field — SEC-5 replaced the admin-supplied password with
    an emailed invite link (`InviteConfirmSerializer` below). `create()`
    always produces an unusable password and an inactive account; the
    account becomes usable only through a successful invite confirm.
    """

    role_name = serializers.CharField(source="role.name", read_only=True, allow_null=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "role",
            "role_name",
            "date_joined",
            "last_login",
        )
        read_only_fields = ("id", "is_staff", "is_superuser", "date_joined", "last_login")

    def create(self, validated_data):
        # `is_staff` is read-only on this serializer (never settable by the
        # caller) but must still default to `True` for a user created
        # through this "staff user administration" API — `create_user`
        # itself defaults `is_staff=False`, which would otherwise silently
        # produce an account unable to reach Django admin despite holding
        # whatever role/permissions were granted. Unchanged reasoning from
        # SEC-1.
        #
        # `password=None` makes `create_user` call `set_password(None)`,
        # which Django's own `AbstractBaseUser.set_password` turns into
        # `set_unusable_password()` — no `check_password` call can ever
        # succeed against this account until `InviteConfirmSerializer.save`
        # sets a real one.
        #
        # `is_active` is forced to `False` regardless of whatever the
        # caller sent — the field stays writable for `update()`, so an
        # already-active user can still be deactivated normally, but there
        # is no "create an already-active staff account" path left through
        # this API. See `## Story Goal`.
        validated_data["is_active"] = False
        return User.objects.create_user(password=None, is_staff=True, **validated_data)
```

Add `InviteConfirmSerializer` immediately after it (before `AuditLogSerializer`):

```python
class InviteConfirmSerializer(serializers.Serializer):
    """SEC-5's invite-confirm step. Exchanges a signed, time-limited token
    (`apps.accounts.tokens.read_password_token`) for a real password,
    activating the account `UserAdminSerializer.create` left pending.

    Deliberately checks `not user.has_usable_password()` in `validate`, not
    just `is_active=False` alone — a still-cryptographically-valid invite
    token sitting in an old inbox must not be replayable to reactivate an
    account an admin deactivated for cause *after* the original invite was
    already used. `has_usable_password()` only ever flips back to `True`
    through this endpoint (the sole caller of `set_password` for a pending
    account), so once an invite is consumed once, the same token can never
    succeed again regardless of any later `is_active` change. See
    `## Edge Cases`.
    """

    token = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        user_id = read_password_token(attrs["token"])
        user = User.objects.filter(pk=user_id, is_active=False).first() if user_id else None
        if user is None or user.has_usable_password():
            raise serializers.ValidationError(
                {"token": [_("This invite link is invalid or has expired.")]}
            )
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.is_active = True
        user.save(update_fields=["password", "is_active"])
        return user
```

`validate_password` reuses the same `django.contrib.auth.password_validation.validate_password` import already at the top of this file (previously used by the now-deleted `UserAdminSerializer.validate_password`) — no new import needed for it.

---

### 3 — `InviteConfirmView`

**File: `backend/apps/accounts/views.py`**

Add `import logging` as the first line of the file, and `logger = logging.getLogger(__name__)` immediately after the `User = get_user_model()` line (24). Add `InviteConfirmSerializer` into the existing `from .serializers import (...)` block, alphabetically after `AuditLogSerializer`:

```python
from .serializers import (
    AuditLogSerializer,
    InviteConfirmSerializer,
    LogoutSerializer,
    RoleAdminSerializer,
    UserAdminSerializer,
    UserSerializer,
)
```

Add `from .tasks import send_invite_email` beside the `.serializers` import (task 6 creates this module).

Insert a new view between `LogoutView` (ends line 48) and `MeView` (starts line 51):

```python
class InviteConfirmView(APIView):
    """Completes SEC-5's invite flow: exchanges the token mailed by
    `send_invite_email` (apps/accounts/tasks.py) for a real password,
    activating the account `UserAdminSerializer.create` left pending. No
    Authorization header — the token IS the credential, the same reasoning
    `LogoutView` above already documents for a differently-shaped case.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = InviteConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(None, status=status.HTTP_200_OK)
```

---

### 4 — Routing, `FRONTEND_URL`

**File: `backend/apps/accounts/urls.py`**

```python
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import InviteConfirmView, LogoutView, MeView

app_name = "accounts"

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("invite/confirm/", InviteConfirmView.as_view(), name="invite_confirm"),
]
```

Endpoint: `POST /api/auth/invite/confirm/`. `admin_urls.py` is unchanged — this is a pre-auth endpoint, the same category as `token/`/`logout/`, not the permission-gated `/api/users/` resource.

**File: `backend/config/settings/base.py`** — insert after the `CORS_ALLOW_HEADERS` list (currently ending line 224), before the `--- DRF ---` block:

```python
# --- Frontend (SEC-5) ----------------------------------------------------
# Used to build the "set your password" link in SEC-5's invite email
# (apps/accounts/tasks.py::send_invite_email). Same default origin
# CORS_ALLOWED_ORIGINS above already allows for local dev.
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")
```

**File: `backend/.env.example`** — add one line under `# --- API / CORS ---` (after `DRF_MAX_PAGE_SIZE=100`):

```
FRONTEND_URL=http://localhost:5173
```

---

### 5 — Dispatch the invite email from `UserViewSet.perform_create`

**File: `backend/apps/accounts/views.py`** — extend the existing `perform_create` (current lines 106-114), immediately after the existing `AuditLog.objects.create(...)` call:

```python
    def perform_create(self, serializer):
        super().perform_create(serializer)
        user = serializer.instance
        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.Action.USER_CREATED,
            target_user=user,
            target_label=user.get_full_name(),
        )
        # Best-effort, same commit-first idiom `apps.notifications.services.notify`
        # uses around its own `send_notification_email.delay(...)` call — a down
        # Redis/worker must never fail or roll back the already-created account.
        try:
            send_invite_email.delay(user.id)
        except Exception:
            logger.exception("Failed to queue invite email for user %s", user.id)
```

---

### 6 — `send_invite_email` task

**Create file: `backend/apps/accounts/tasks.py`**

```python
"""Background tasks — SEC-5. The third `tasks.py` module after
`apps/sla/tasks.py` (Stories 29-30) and `apps/notifications/tasks.py`
(Story 31, SLA-4) — `app.autodiscover_tasks()` (`config/celery.py`) finds
this module with no further wiring, confirming CONVENTIONS.md § 24's own
"the second feature to add its own tasks.py module" note a third time.
"""

import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMessage
from django.utils.translation import gettext_lazy as _

from .tokens import make_password_token

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task
def send_invite_email(user_id: int) -> None:
    """Emails a newly-created, pending staff account its "set your
    password" link. A no-op if the user row no longer exists — the API
    itself never deletes a `User` (Story 48's `UserViewSet` drops the
    `delete` verb entirely), but Django admin still can, mirroring
    `send_notification_email`'s own `DoesNotExist` guard (Story 31).
    """
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    token = make_password_token(user.id)
    link = f"{settings.FRONTEND_URL}/set-password?token={token}"
    email = EmailMessage(
        subject=str(_("Set up your SupportOS account")),
        body=str(
            _("Welcome to SupportOS. Set your password to activate your account: %(link)s")
            % {"link": link}
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    email.send()
```

---

## Documentation Tasks

### 7 — Append to `CONVENTIONS.md` § 21

**File: `CONVENTIONS.md`** — append after the existing last entry in § 21 (ends line 737, before the `---` at line 739). Do **not** renumber § 0-§ 27.

```markdown

**A single-use, expiring token is `is_active` plus a password-state check,
not a nonce.** `InviteConfirmSerializer` (Story 70, `SEC-5`) signs only a
user id and an expiry (`apps.accounts.tokens`, the same
`django.core.signing.dumps`/`loads(..., max_age=...)` shape
`live_chat_adapter`'s session token already established) — what makes it
single-use is requiring `not user.has_usable_password()` in `validate`,
never `is_active=False` alone. `is_active` is a general-purpose field any
`BaseModelViewSet.update` can flip for unrelated reasons; gating only on it
would let a stale-but-still-valid token reactivate an account an admin
disabled for cause after the original invite was already spent.
`has_usable_password()` only flips back to `True` through the one endpoint
that calls `set_password`, so it is the actual "has this token already been
used" signal. Reach for this pattern whenever a token grants a one-time
state transition on a field a normal admin action can also independently
flip.
```

**File: `frontend/src/README.md`** — extend line 98 (`## Authentication & authorization`) from *"`src/features/auth/` holds `LoginPage`, built from `useAppForm` + `TextField` like any other form."* to:

```markdown
`src/features/auth/` holds `LoginPage` and `SetPasswordPage` (SEC-5's
invite-confirm screen), both built from `useAppForm` + `TextField` like any
other form.
```

No change to root `README.md` — `FRONTEND_URL` is documented in `backend/.env.example` the same way every other `env()`-read setting already is; no new dependency, no new error code.

---

## Frontend Tasks

### 8 — API layer

**Create file: `frontend/src/features/auth/api/confirmInvite.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export type ConfirmInviteInput = {
  token: string
  password: string
}

export function confirmInvite(input: ConfirmInviteInput): Promise<void> {
  return api.post<void>('/auth/invite/confirm/', input)
}
```

**File: `frontend/src/features/accounts/types/user.ts`** — replace `UserCreateInput`/`UserUpdateInput` (current lines 16-27):

```ts
/** Create-only write shape. No `password` and no `is_active` — SEC-5's
 * `UserAdminSerializer.create` forces the account inactive with an
 * unusable password server-side no matter what is sent. */
export type UserCreateInput = {
  email: string
  first_name: string
  last_name: string
  role: number | null
}

/** Edit write shape. `is_active` is only ever settable here — deactivating
 * (or reactivating) an already-invited account, never creating one. */
export type UserUpdateInput = UserCreateInput & { is_active: boolean }
```

`frontend/src/features/accounts/api/createUser.ts` and `updateUser.ts` need no change — both are generic over the imported input types.

---

### 9 — Update `UserFormPage.tsx`; add `SetPasswordPage.tsx`

**File: `frontend/src/features/accounts/components/UserFormPage.tsx`**

Replace the schema block (current lines 33-45):

```ts
const baseShape = {
  email: email(),
  first_name: optionalString(150),
  last_name: optionalString(150),
  role: z.string(),
}

const createSchema = z.object(baseShape)
const editSchema = z.object({ ...baseShape, is_active: z.boolean() })

type CreateFormValues = z.output<typeof createSchema>
type EditFormValues = z.output<typeof editSchema>
```

In `UserCreateForm` (current lines 81-184):
- Drop `password` from `useAppForm`'s `defaultValues` (current lines 90-97) — becomes `{ email: '', first_name: '', last_name: '', role: ROLE_NONE } satisfies CreateFormValues`.
- Drop `is_active`/`password` from the `UserCreateInput` built in `onSubmit` (current lines 103-110) — becomes `{ email: values.email, first_name: values.first_name ?? '', last_name: values.last_name ?? '', role: values.role === ROLE_NONE ? null : Number(values.role) }`.
- Change the success toast from `t('users.created')` to `t('users.inviteSent')` (task 10 renames the locale key).
- Remove the `SwitchField` (current lines 156-160, `is_active`) and the `TextField` (current lines 161-167, `password`) from the rendered form entirely.
- Add one line of copy above the field list explaining the invite (new locale key, task 10): a `<p className="text-sm text-muted-foreground">{t('users.inviteHint')}</p>` placed inside `<CardContent>`, before the first `TextField`.

`UserEditForm` (current lines 186-280) is otherwise **unchanged** — `editSchema` still includes `is_active`, so its `defaultValues`/`onSubmit`/rendered `SwitchField` all keep working exactly as before; only the shared `baseShape` they're built from moved.

**Create file: `frontend/src/features/auth/components/SetPasswordPage.tsx`**

```tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2Icon, KeyRoundIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import * as z from 'zod'

import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'

import { confirmInvite } from '../api/confirmInvite'

const schema = z.object({ password: requiredString(128) })
type FormValues = z.output<typeof schema>

export function SetPasswordPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle asChild className="text-xl">
            <h1>{t('setPassword.invalidTitle')}</h1>
          </CardTitle>
          <CardDescription>{t('setPassword.invalidDescription')}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (done) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CheckCircle2Icon className="size-10 text-success" />
          <CardTitle asChild className="text-xl">
            <h1>{t('setPassword.successTitle')}</h1>
          </CardTitle>
          <CardDescription>
            {t('setPassword.successDescription')}{' '}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('setPassword.signIn')}
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <SetPasswordForm token={token} onDone={() => setDone(true)} />
}

function SetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const { t } = useTranslation('auth')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema, defaultValues: { password: '' } })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => confirmInvite({ token, password: values.password }),
    onSuccess: onDone,
    onError: (error) => {
      if (isValidationError(error)) {
        setFormErrors(applyServerErrors(form, error))
      }
    },
  })

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <KeyRoundIcon className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('setPassword.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('setPassword.subtitle')}</p>
      </div>
      <Card>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="flex flex-col gap-4"
            >
              <TextField
                control={form.control}
                name="password"
                label={t('setPassword.password')}
                type="password"
                autoComplete="new-password"
                autoFocus
              />
              <FormErrorSummary errors={formErrors} />
              <SubmitButton pending={mutation.isPending} size="lg" className="w-full">
                {t('setPassword.submit')}
              </SubmitButton>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
```

A `token` field error from `applyServerErrors` (e.g. an invalid/expired-token `validation_error`) lands in `unattached` — this form has no field named `token` — and is rendered by `FormErrorSummary`; no special-case handling needed (see `## Context` item 17).

---

### 10 — Locale changes

**File: `frontend/src/features/accounts/locales/en.json`** — remove `fields.password` (current line 19); change `"created": "User created."` to `"inviteSent": "Invitation sent."`; add one new key `"inviteHint": "They'll receive an email with a link to set their own password."` inside the `users` object.

**File: `frontend/src/features/accounts/locales/ar.json`** — identical structural change: remove `fields.password`, rename `created` → `inviteSent` (`"تم إرسال الدعوة."`), add `"inviteHint": "سيتلقى المستخدم بريدًا إلكترونيًا يحتوي على رابط لتعيين كلمة المرور الخاصة به."`.

**File: `frontend/src/features/auth/locales/en.json`** — add a new top-level `setPassword` object beside the existing `login`/`help`:

```json
"setPassword": {
  "title": "Set your password",
  "subtitle": "Choose a password to activate your account.",
  "password": "New password",
  "submit": "Set password",
  "successTitle": "Password set",
  "successDescription": "Your account is now active.",
  "signIn": "Sign in",
  "invalidTitle": "Invalid link",
  "invalidDescription": "This invite link is missing its token. Check the link in your email, or ask an admin to resend the invite."
}
```

**File: `frontend/src/features/auth/locales/ar.json`** — the same key set, translated:

```json
"setPassword": {
  "title": "تعيين كلمة المرور",
  "subtitle": "اختر كلمة مرور لتفعيل حسابك.",
  "password": "كلمة المرور الجديدة",
  "submit": "تعيين كلمة المرور",
  "successTitle": "تم تعيين كلمة المرور",
  "successDescription": "حسابك مفعّل الآن.",
  "signIn": "تسجيل الدخول",
  "invalidTitle": "رابط غير صالح",
  "invalidDescription": "يفتقر رابط الدعوة هذا إلى الرمز الخاص به. تحقق من الرابط في بريدك الإلكتروني، أو اطلب من أحد المسؤولين إعادة إرسال الدعوة."
}
```

Both locale files' JSON must stay `git diff`-minimal beyond these additions — do not reformat unrelated keys.

---

### 11 — Route

**File: `frontend/src/app/router.tsx`** — add a fourth child to the `PublicLayout`'s `children` array (current lines 18-39), alongside `login`/`chat`/`contact`:

```tsx
{
  path: 'set-password',
  lazy: async () => {
    const { SetPasswordPage } = await import('@/features/auth/components/SetPasswordPage')
    return { element: <SetPasswordPage /> }
  },
},
```

---

## Edge Cases & Failure Modes

- **A leaked-but-already-used invite link cannot reactivate a since-deactivated account.** `InviteConfirmSerializer.validate` requires `not user.has_usable_password()` in addition to `is_active=False` — see `## Story Goal` finding 1 and the appended `CONVENTIONS.md` § 21 entry. Without this, an admin deactivating a former employee days after their invite was already accepted would leave a working "reactivate + set any password" link sitting in that person's old inbox.
- **A tampered or expired token gives the same generic error as a nonexistent one.** `read_password_token` catches `signing.BadSignature` (whose subclass `signing.SignatureExpired` covers the timing case too, verified against `live_chat_adapter`'s identical `except` clause) and returns `None` either way; `InviteConfirmSerializer.validate` raises the same `{"token": [...]}` message regardless of which case it was — no information about *why* a token failed is leaked to an unauthenticated caller.
- **A weak or too-short password at confirm time is a field error on `password`, not `token`, and not a 500.** `InviteConfirmSerializer.validate_password` runs the same `django.contrib.auth.password_validation.validate_password` (`AUTH_PASSWORD_VALIDATORS`, `base.py:130`) `UserAdminSerializer.validate_password` used to run, translated the same way through `apps/core/exceptions.py`.
- **Two confirm requests racing on the same still-valid token.** Neither `validate()` nor `save()` takes a row lock (`select_for_update`) — the same "no `ATOMIC_REQUESTS`, no explicit locking" posture `RoleViewSet.destroy`'s own docstring already accepts for a different race. Worst case is a last-write-wins on which of two attacker- or user-submitted passwords ends up active; both requests necessarily presented the one legitimate token, so this is not a privilege gap, just an accepted, extremely low-probability UX oddity, not engineered around.
- **`is_active=False` alone was already sufficient to block login before this story** (Story 08/09's existing `authenticate()` → `ModelBackend.user_can_authenticate` path) — the unusable password this story additionally sets is defense in depth, not the only thing standing between a pending account and a successful login. Both must independently hold; neither depends on the other.
- **Celery worker or Redis down at invite-creation time.** `send_invite_email.delay(...)` is wrapped in the same `try/except Exception: logger.exception(...)` `notify()` already uses — `POST /api/users/` still returns `201` and the `User`/`AuditLog` rows still commit; only the email never gets queued. No retry/resend mechanism exists yet (explicitly out of scope) — an admin would need to recreate awareness out-of-band today, a known gap this story does not close.
- **`FRONTEND_URL` misconfigured in a deployed environment** produces a working, correctly-signed token behind a link pointing at the wrong origin — a deploy/ops checklist item, not a code defect; `dev.py`/`prod.py` carry no override, so it is read from `.env` in every environment exactly like `DEFAULT_FROM_EMAIL`.
- **A pending (not-yet-confirmed) account and a deliberately deactivated one are visually identical today** — both show `is_active: false` → the existing "Inactive" badge on `UserListPage`. This is accurate (neither can currently log in) but not distinguishing; building a separate "Invited" state is explicitly out of scope (see `## Story Goal`) and is flagged here rather than silently accepted as correct forever.
- **Visiting `/set-password` with no `token` query parameter** (a bookmarked bare URL, a copy-paste mistake) renders the "Invalid link" card immediately — no request is ever sent, since `SetPasswordPage` checks `token` before rendering `SetPasswordForm` at all.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass (verified live, pre-change, in `## Prerequisites`). No migration ships, so `MigrationStateTests.test_no_pending_migrations` stays a no-op check.
2. `ruff format --check .` / `ruff check .` on the new and changed Python (`tokens.py`, `tasks.py`, `serializers.py`, `views.py`, `urls.py`, `base.py`).
3. `npm run build` — typechecks the new `UserCreateInput`/`UserUpdateInput` shapes, both `UserFormPage` schemas, `ConfirmInviteInput`, and every new `t('auth:setPassword....')`/`t('accounts:users....')` key.
4. `npm run lint` (`react/jsx-no-literals` over `SetPasswordPage.tsx`/the changed `UserFormPage.tsx`), `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison script (`## Context` — the same one Story 10 Verification Step 4 introduced), run once against `frontend/src/features/accounts/locales/{en,ar}.json` and once against `frontend/src/features/auth/locales/{en,ar}.json`.
6. Real HTTP against the invite → confirm → login chain end to end, plus a real browser walkthrough in both languages — Verification Steps 5-13 below.

---

## Migration / Rollback

**No schema migration in this story.** `User.is_active` and `User.password` already exist (Story 08); `create()`'s new defaults and the new `InviteConfirmSerializer`/`InviteConfirmView`/`tokens.py`/`tasks.py` are pure code, plus one new setting (`FRONTEND_URL`, has a safe default) and one new frontend route.

**Rollback of the code:** revert the commits. No `pip install`/`npm install` — no new dependency in either app. A user created *before* rollback (unusable password, `is_active=False`, invite already emailed) stays exactly that way after a rollback — reverting the code does not retroactively give them a password, so an admin would need to intervene via Django admin (`UserAdmin`'s existing `usable_password`/`password1`/`password2` add-form fields, or the `is_active` checkbox) for any account caught mid-flight. Flag this to the user rather than silently accepting it if a rollback is ever needed after real invites have gone out.

**Half-applied states to avoid:**

- **Task 2/3/5 (serializer/view/dispatch changes) before task 4 (`urls.py` + `FRONTEND_URL`)** → `UserViewSet.perform_create` would reference `send_invite_email` (task 6) and `InviteConfirmView` would be unreachable at `/api/auth/invite/confirm/`; `POST /api/users/` would still create a correctly-pending account, but nothing could ever confirm it. Ship tasks 1-6 together.
- **Task 6 (`tasks.py`) before task 4's `FRONTEND_URL` setting** → `send_invite_email` raises `AttributeError` on `settings.FRONTEND_URL` the first time it actually runs (Celery logs the failure; `perform_create`'s own `try/except` around `.delay(...)` does **not** catch this — the task itself fails asynchronously, not the dispatching call). Add the setting in the same change as the task.
- **Task 9 (frontend components) before task 10 (locale keys)** → every new `t('auth:setPassword...')`/`t('accounts:users.inviteSent')`/`t('accounts:users.inviteHint')` call fails `tsc -b`, the same failure mode `CONVENTIONS.md` § 23 already documents for a components-before-locales ordering in a namespace a component imports.
- **Task 11 (route) before task 9 (`SetPasswordPage.tsx` exists)** → the lazy import resolves to a module that does not exist yet; the build fails on the import.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing.
3. **`en`/`ar` key sets match** for both the `accounts` and `auth` namespaces (`## Test Plan` item 5).
4. **Start Redis, a Celery worker, and the backend** (`redis-cli ping` → `PONG`; `celery -A config worker -l info --pool=solo` on Windows per `CONVENTIONS.md` § 24; `python manage.py runserver`).
5. **`POST /api/users/` creates a pending account with no password field accepted, and it cannot log in.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/users/ -H "Content-Type: application/json" -H "Authorization: Bearer $adminToken" -d '{\"email\":\"invitee@supportos.local\",\"first_name\":\"New\",\"last_name\":\"Hire\",\"role\":null}'
   ```

   Expect `201`, `is_active: false` in the response. Then: `python manage.py shell -c "from django.contrib.auth import get_user_model; u = get_user_model().objects.get(email='invitee@supportos.local'); print(u.is_active, u.has_usable_password())"` → `False False`. Then attempt a login: `POST /api/auth/token/` with any password → `401 authentication_failed`.
6. **The invite email is dispatched.** The Celery worker's console log (dev's console `EMAIL_BACKEND`, same as Story 31 Verification Step 5) prints the email with a `/set-password?token=...` link — copy the token out of it.
7. **A weak password is rejected at confirm.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/invite/confirm/ -H "Content-Type: application/json" -d '{\"token\":\"<token>\",\"password\":\"123\"}'
   ```

   Expect `validation_error` on field `password`.
8. **A valid confirm activates the account.** Repeat step 7 with `"password":"Sup3rSecret!"` → `200`. Then re-run step 5's shell check → `True True`. Then `POST /api/auth/token/` with `invitee@supportos.local` / `Sup3rSecret!` → `200`, a real `access`/`refresh` pair.
9. **The same token cannot be replayed.** Re-POST step 8's exact request again → `validation_error` on field `token` (not `200`, not `500`), proving single-use.
10. **A tampered token fails the same way as an expired one.** POST with `"token":"garbage"` → the same `{"token": [...]}` `validation_error`, not a 500 and not a different message.
11. **The full UI walkthrough, both languages.** `npm run dev` with the backend/worker/Redis up, signed in as `admin@`:
    - `/users/new` shows no password field and no active/inactive toggle; submitting shows the `t('users.inviteHint')` copy was visible before submit and a `t('users.inviteSent')` toast after; the new row shows the "Inactive" badge with no manual refresh.
    - Copy the invite link from the worker console into a **new private/incognito browser tab** (no session) at `/set-password?token=...` — the `SetPasswordPage` form renders (no `Sidebar`, no nav).
    - Submit a valid password → the success card renders with a working "Sign in" link.
    - Follow it to `/login`, sign in with the new account's email and the password just set → lands on the authenticated home page.
    - Visit `/set-password` with no `?token=` at all → the "Invalid link" card renders immediately, no request fires (check the Network tab).
    - Switch to Arabic: `/users/new`, `/set-password`, and the success/invalid-link cards are all fully translated, `dir="rtl"`, no hardcoded English left visible.
12. **No hardcoded strings, no leftover password-on-create references.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\accounts\components\UserFormPage.tsx,src\features\auth\components\SetPasswordPage.tsx -Pattern "'[A-Z][a-z]{3,}"
    Select-String -Path src\features\accounts\**\*.ts,src\features\accounts\**\*.tsx -Pattern "password"
    ```

    The first must return only non-user-facing hits; the second must return **nothing** under `features/accounts/` (the `password` field lives only in `features/auth/` now).
13. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `UserAdminSerializer` has no `password` field; `create()` always calls `User.objects.create_user(password=None, is_staff=True, **validated_data)` with `validated_data["is_active"]` forced to `False`, regardless of caller input.
- [ ] `InviteConfirmSerializer`/`InviteConfirmView` exist, reachable at `POST /api/auth/invite/confirm/`, `AllowAny`/no `Authorization` header, through the standard envelope/error model (Verification Steps 7-10).
- [ ] `apps/accounts/tokens.py` provides `make_password_token`/`read_password_token` using `django.core.signing.dumps`/`loads(..., max_age=...)`, mirroring `live_chat_adapter`'s pattern — no new third-party signing/JWT-for-this-purpose dependency.
- [ ] The invite-confirm check requires **both** `is_active=False` **and** `not user.has_usable_password()` — not `is_active=False` alone (Verification Step 9's replay check; `## Story Goal` finding 1).
- [ ] `apps/accounts/tasks.py::send_invite_email` reuses `settings.EMAIL_BACKEND`/`DEFAULT_FROM_EMAIL`/`django.core.mail.EmailMessage` — no new email provider, no new setting beyond `FRONTEND_URL`. Dispatched from `UserViewSet.perform_create`, best-effort (`try/except Exception: logger.exception`), never blocking or rolling back user creation.
- [ ] `FRONTEND_URL` added to `base.py` (default `http://localhost:5173`) and `.env.example` — no other settings file touched.
- [ ] No new `Permissions` constant, no new migration of any kind — verified by `git status`/`git diff` showing no new file under `apps/accounts/migrations/`.
- [ ] `UserFormPage.tsx`'s create form renders no `password` field and no `is_active` toggle; `UserCreateInput` has neither field in its type. `UserEditForm`/`UserUpdateInput` are otherwise unchanged, `is_active` still editable there.
- [ ] `frontend/src/features/auth/components/SetPasswordPage.tsx` exists, routed at `/set-password` inside `PublicLayout` (no `Sidebar`/nav), reads `token` from the query string, and renders a distinct "invalid link" state when it is absent.
- [ ] `frontend/src/features/auth/api/confirmInvite.ts` posts to `/auth/invite/confirm/` via the shared `api.post` helper — no second Axios instance, no `fetch()`.
- [ ] `users.inviteSent`/`users.inviteHint` added and `users.fields.password`/`users.created` removed from both `accounts` locale files; `auth.setPassword.*` added to both `auth` locale files; `en`/`ar` key sets match in both namespaces (Verification Step 3).
- [ ] Verified by real HTTP: pending-account creation and its double login-block (Step 5); invite email dispatch (Step 6); weak-password rejection at confirm (Step 7); successful confirm and login (Step 8); single-use replay rejection (Step 9); tampered-token rejection (Step 10).
- [ ] Both languages walk through cleanly end to end, RTL included (Step 11); no hardcoded strings, no stray `password` reference left under `features/accounts/` (Step 12).
- [ ] `CONVENTIONS.md` § 21 gains the appended single-use-token entry (§ 0-§ 27 unrenumbered); `frontend/src/README.md` line 98 names `SetPasswordPage` alongside `LoginPage`.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` updated with this story's row; `.squad/plans/00-index.md`'s `security-administration` NN range updated to include `70`.
