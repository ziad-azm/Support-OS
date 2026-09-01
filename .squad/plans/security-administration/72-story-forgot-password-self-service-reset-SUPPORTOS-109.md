# Story 72 — Forgot Password / Self-Service Reset (Story: SUPPORTOS-109)

## Prerequisites

- **Story 08 completed** (`AUTH-1`, [../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md](../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md)) — login/refresh/logout only, per the intake's own framing. `LoginPage.tsx`'s current `help.lockedOut` copy ("Ask an admin to reset it") is the entire story before this one.
- **Story 70 completed:** [70-story-user-invitation-first-login-password-SUPPORTOS-107.md](70-story-user-invitation-first-login-password-SUPPORTOS-107.md) (`SEC-5`). This story reuses and **generalizes** (not duplicates) its token utility — `apps/accounts/tokens.py` — exactly as that story's own docstring anticipated: *"SEC-7... is expected to reuse `make_password_token`/`read_password_token` unmodified with its own salt."* This story keeps both function signatures call-compatible for SEC-5's existing call sites while widening what they accept, because a genuine correctness gap — not a style preference — makes literal reuse insufficient; see `## Story Goal` finding 1.
- **Story 31 completed** (`SLA-4`, [../sla-automation/31-story-alerts-notifications-SUPPORTOS-63.md](../sla-automation/31-story-alerts-notifications-SUPPORTOS-63.md)) — this story's `send_password_reset_email` task reuses its email infrastructure wholesale, the same way SEC-5's `send_invite_email` already does.
- **Story 71 completed:** [71-story-user-account-deletion-SUPPORTOS-108.md](71-story-user-account-deletion-SUPPORTOS-108.md) (`SEC-6`). Unrelated in mechanism, but the most recent change to `apps/accounts/views.py` — read it as the current baseline (`UserViewSet` now has a real `destroy`; `apps/accounts/urls.py` now has five paths, not four).
- Verified backend baseline (this session, live): `python manage.py test` reports **54** passing, matching `CONVENTIONS.md` § 16's own citation.
- Verified: no rate-limiting package is installed (`backend/requirements.txt`, 13 lines, checked in full) — `djangorestframework`'s own built-in `rest_framework.throttling.ScopedRateThrottle` is sufficient and already exercised by this codebase's exception-handling contract (see next finding), so no new dependency.
- Verified: `backend/apps/core/tests/test_exceptions.py::test_throttled_keeps_retry_after_header` (lines 82-87) already asserts `envelope_exception_handler` turns a `rest_framework.exceptions.Throttled` into a `429` envelope with `code: "throttled"` and a preserved `Retry-After` header — written in Story 02/04 as part of the exception-handler contract itself, before any view actually throttled anything. This story is the first to exercise that path for real.
- Verified: `frontend/src/shared/lib/api/types.ts:18` (`API_ERROR_CODES`) already lists `'throttled'`, and both `frontend/src/shared/i18n/locales/{en,ar}/errors.json:16` already carry a translated message for it ("Too many requests. Please wait and try again." / the Arabic equivalent) — pre-registered, unused until this story. The shared `MutationCache`-driven toast (`t(error.code, { defaultValue: error.message })`, `frontend/src/app/providers.tsx:25-29`) will render it automatically; **no new frontend error-code work is needed for throttling.**

---

## Story Goal

Give a user who forgot their password a real way back in, without an admin, and without ever revealing whether a given email belongs to a real account.

1. **Backend** — `POST /api/auth/password-reset/request/` (email in, rate-limited, always `200`) queues an email — via the exact `SLA-4` infrastructure `send_invite_email` already uses — only when the email belongs to a real, active, `has_usable_password()` account; silently does nothing otherwise. `POST /api/auth/password-reset/confirm/` (token + new password) verifies the signed token and sets the new password on an **already-active** account — the opposite precondition from `InviteConfirmView`, which only ever accepts a pending, `is_active=False` one.
2. **Frontend** — `LoginPage.tsx` gains a "Forgot password?" link (replacing the now-inaccurate `help.lockedOut` admin-reset copy). It leads to a request form → a generic confirmation screen (never "check your inbox, `x@y.com`!", never "no account found"), and a separate reset-confirm page (opened from the emailed link) to set the new password — both built from the exact `SetPasswordPage`/`WebFormPage` two-state shape SEC-5 already established.

### Two verified findings that shape this story beyond the intake's own wording

**1. `make_password_token`/`read_password_token` cannot be reused *literally unmodified* — their single-use guarantee doesn't transfer, so the fix is a genuine, minimal generalization, not a second mechanism.** SEC-5's invite token is single-use because the *account's own state* (`is_active=False` → `True`, `has_usable_password()` `False` → `True`) provides a natural "already used" signal — `InviteConfirmSerializer.validate` checks that state, not anything inside the token. A forgot-password token has no equivalent: the account is *already* active with a *usable* password before, during, and after a reset — there is no state transition to gate on. Without a fix, the exact same reset link could be replayed indefinitely until it expires. The fix: widen `make_password_token`/`read_password_token` from "sign/verify an int" to "sign/verify any JSON-serialisable payload" — a change to what SEC-5's own call sites are *allowed* to pass through them, not to their behavior for the (unchanged) int payload SEC-5 already passes — and add one new pure function, `password_fingerprint(user)`, a one-way digest of `user.password` embedded in the reset token's payload. Once `set_password()` changes `user.password`, every previously-issued token's baked-in digest stops matching, making the token single-use with no second stored "used" flag — the same technique Django's own `default_token_generator` uses (hashing over `user.password`), reimplemented on this project's own `signing.dumps`/`loads` utility instead of pulling that generator in. See `## Edge Cases` for why this is a *digest* of the hash, never the hash (or a slice of it) directly.
**2. Only the request endpoint is throttled — not confirm — matching the intake's own precise wording and the codebase's existing `InviteConfirmView` precedent.** The intake's backend task says "rate-limit the request endpoint," not both. `PasswordResetConfirmView`'s own security already rests on an unguessable, short-lived, single-use signed token (the same posture `InviteConfirmView` already has, also unthrottled) — a rate limit on *that* endpoint would protect against nothing a signed token doesn't already prevent, while a rate limit on *request* protects against real abuse (spamming a stranger's inbox, or using response timing/shape as an enumeration oracle at volume).

### Explicitly out of scope

- **Change password for an already-signed-in user (`SEC-8`).** A different flow (no token, no email) — unbuilt.
- **Timing-attack-proof constant-time responses for the request endpoint.** The response is always identical in *shape and status* regardless of whether the email is registered (the actual, meaningful protection the intake asks for), but no attempt is made to equalize response *latency* between the "queue an email" and "do nothing" branches — the same non-goal virtually every real-world implementation of this pattern accepts, and Django's own password hashing already dominates any such signal for the login endpoint this project already ships. Flagged, not silently assumed solved.
- **Locking or alerting on repeated failed reset-confirm attempts.** Only the *request* endpoint is throttled — see finding 2. A confirm attempt with a wrong/expired token just fails, unthrottled, the same as `InviteConfirmView` today.
- **Automated tests.** Standing policy (`CONVENTIONS.md` § 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-109/intake.md` — one description, two task blocks (backend request/confirm endpoints; frontend forgot/reset UI), no attachments, no acceptance criteria. Its own "Shares its token mechanism with SEC-5's invite flow" line is what `## Story Goal` finding 1 works out precisely.
2. `backend/apps/accounts/tokens.py` (all 43 lines) — `INVITE_SALT`/`INVITE_TOKEN_MAX_AGE_SECONDS` (15-21), `make_password_token`/`read_password_token` (24-42, task 1 widens both), and the module's own top docstring (1-11, already names SEC-7 as an expected caller — task 1 rewrites it to describe the actual, now-two-shape design).
3. `backend/apps/accounts/serializers.py` (all 239 lines) — `InviteConfirmSerializer` (162-200) is the exact structural precedent (`token`/`password` fields, `validate_password`, `validate` resolving to `attrs["user"]`, a `save()` that bypasses `create`/`update`) task 2's `PasswordResetConfirmSerializer` follows, with the described precondition flipped (`is_active=True`, fingerprint match instead of `not has_usable_password()`). The top-of-file `from .tokens import read_password_token` (line 10) is where task 2 also imports `make_password_token`/`password_fingerprint`/`RESET_SALT`/`RESET_TOKEN_MAX_AGE_SECONDS`.
4. `backend/apps/accounts/tasks.py` (all 43 lines) — `send_invite_email` in full is the exact shape task 3's `send_password_reset_email` copies (`EmailMessage`, `settings.DEFAULT_FROM_EMAIL`, the `try: user = User.objects.get(...) except User.DoesNotExist: return` guard), including its own `apps/accounts/tasks.py` module docstring (1-6, "the third `tasks.py` module... confirming... a third time" — task 3 makes it a fourth, worth one more line, not a new claim).
5. `backend/apps/accounts/views.py` (current, post-SEC-6 state — 85-171 is `UserViewSet`, `LogoutView`/`InviteConfirmView`/`MeView` are lines 33-83) — `InviteConfirmView` (57-73) is the exact `APIView` shape (`authentication_classes: list = []`, `permission_classes = [AllowAny]`, `serializer.is_valid(raise_exception=True)`, `serializer.save()`, `Response(None, status=status.HTTP_200_OK)`) task 4's two new views copy; one of them additionally sets `throttle_classes`/`throttle_scope`, a pattern with no precedent anywhere yet in this codebase.
6. `backend/apps/accounts/urls.py` (all 14 lines) — the `auth/`-prefixed, router-free module every pre-auth endpoint lives in; task 5 adds two more `path()` entries here, following `invite/confirm/`'s exact placement pattern.
7. `backend/apps/core/tests/test_exceptions.py:82-87` (`test_throttled_keeps_retry_after_header`) — proof the envelope/throttle interaction already works with zero new code in `apps/core/exceptions.py`.
8. `backend/config/settings/base.py:233-274` (the `--- DRF ---` block, `REST_FRAMEWORK` dict) — task 6 adds one key, `DEFAULT_THROTTLE_RATES`; no other REST_FRAMEWORK key changes.
9. `frontend/src/features/auth/components/SetPasswordPage.tsx` (all 118 lines) — the exact two-state (invalid-link / form / success) shape both `ForgotPasswordPage.tsx` (task 9, two states: form / success) and `ResetPasswordPage.tsx` (task 10, three states, identical to this file's own shape) copy, including the `useSearchParams()` token-read pattern and the `applyServerErrors`-to-`FormErrorSummary` fallback for an unattached `token` field error.
10. `frontend/src/features/auth/components/LoginPage.tsx` (all 103 lines) — the password `TextField` (70-76, task 8 inserts a "Forgot password?" link immediately after it) and the footer `help.lockedOut` line (96, task 8 removes it — no longer accurate once a real flow exists).
11. `frontend/src/features/auth/api/confirmInvite.ts` (10 lines) — the exact `api.post<void>(url, input)` shape task 11's `requestPasswordReset.ts`/`confirmPasswordReset.ts` copy.
12. `frontend/src/app/router.tsx:40-48` (the `PublicLayout` children array, ending with `set-password`) — task 12 appends two more entries, `forgot-password` and `reset-password`, following the exact `lazy: async () => { const { X } = await import(...); return { element: <X /> } }` pattern.
13. `frontend/src/shared/lib/api/types.ts:7-20` (`API_ERROR_CODES`) and `frontend/src/shared/i18n/locales/{en,ar}/errors.json` (`throttled` key) — confirms no frontend error-code work is needed for the 429 case (`## Prerequisites`).
14. `frontend/src/README.md:89-100` (`## Authentication & authorization`) — task 7 extends the sentence naming which components live in `src/features/auth/`.
15. `CONVENTIONS.md` § 16 (lines 251-258, no automated tests — the **54** figure verified live this session), § 21 (lines 651-753, Authentication/JWT — the SEC-5 single-use-token entry Story 70 appended, lines ~727-753, is what task 7 adds a sibling entry beside; ends line 753, before the `---` at 755).

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Request a reset by email; receive a time-limited link; set a new password.** | Intake | `PasswordResetRequestView`/`PasswordResetConfirmView`, `ForgotPasswordPage`/`ResetPasswordPage`. |
| **Reuse SEC-5's token utility — no second token/email mechanism.** | Intake constraint | `apps/accounts/tokens.py`'s `make_password_token`/`read_password_token` widened, not duplicated; `send_password_reset_email` reuses `send_invite_email`'s exact `EmailMessage`/`DEFAULT_FROM_EMAIL`/`EMAIL_BACKEND` shape. |
| **Rate-limit the request endpoint.** | Intake constraint | `PasswordResetRequestView.throttle_classes = [ScopedRateThrottle]`, `throttle_scope = "password_reset_request"`, `DEFAULT_THROTTLE_RATES["password_reset_request"] = "5/hour"`. |
| **Never reveal whether an email is registered.** | Intake constraint | `PasswordResetRequestView` always returns `200`; `PasswordResetRequestSerializer.save()` is a silent no-op for a non-existent/inactive/unusable-password account. The frontend's success screen is identical regardless (`forgotPassword.successDescription`, phrased conditionally: "If an account exists for that email..."). |
| **Through the standard API envelope/error model.** | Intake constraint | Both views are plain `APIView`s behind `envelope_exception_handler`, unmodified. |
| **Update `LoginPage`'s admin-reset copy once this ships.** | Intake constraint | `help.lockedOut` removed; a real "Forgot password?" link takes its place. |
| **Reuse FORM/UI/I18N.** | Intake constraint | `useAppForm`, `TextField`, `SubmitButton`, `FormErrorSummary`, `Card`/`CardHeader`/`CardDescription` — no new shared component. |

---

## Backend Tasks

### 1 — Widen `apps/accounts/tokens.py`; add `password_fingerprint`

**File: `backend/apps/accounts/tokens.py`** — replace the file in full:

```python
"""Signed, time-limited tokens for account credential flows. Reuses
`django.core.signing.dumps`/`loads` with a salt and `max_age`, the exact
pattern `apps.communications.live_chat_adapter` established
(`LIVE_CHAT_SALT`/`SESSION_MAX_AGE_SECONDS`,
apps/communications/live_chat_adapter.py:13-30) for a different kind of
signed reference.

Two callers, two salts, one shared signing pair:
- SEC-5 (`InviteConfirmSerializer`) signs a bare user id under
  `INVITE_SALT` — single-use is enforced by the account's own
  `is_active`/`has_usable_password()` state, not by anything in the token
  itself.
- SEC-7 (`PasswordResetRequestSerializer`/`PasswordResetConfirmSerializer`)
  signs `[user_id, password_fingerprint(user)]` under `RESET_SALT` — an
  already-active account has no natural "unused" state to gate on, so
  `password_fingerprint` (below) bakes the current password hash's digest
  into the payload instead: once `set_password()` runs, the digest baked
  into any previously-issued token stops matching. The same technique
  Django's own `default_token_generator` uses (hashing over
  `user.password`), reimplemented on this module's own
  `signing.dumps`/`loads` instead of pulling that generator in.

`make_password_token`/`read_password_token` themselves are payload-agnostic
— `signing.dumps`/`loads` already accept and return any JSON-serialisable
value, so widening from "an int" (SEC-5's only need) to "an int, or a
two-element list" (SEC-7's need) changes what gets passed through them,
not their own behaviour for SEC-5's existing, unchanged call site.
"""

import hashlib

from django.core import signing

INVITE_SALT = "apps.accounts.invite"
# 3 days: long enough that someone invited on a Friday can still accept it
# the following Monday, short enough that a leaked invite email is not a
# standing liability. A plain constant, not an ENV var — the same
# internal-tuning-knob reasoning `SESSION_MAX_AGE_SECONDS` documents for
# itself.
INVITE_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 3

RESET_SALT = "apps.accounts.password_reset"
# 1 hour: a forgotten-password link is acted on right away or not at
# all — unlike an invite, there is no "was away for the weekend" case to
# allow for, and a shorter window narrows a leaked-email liability window
# further still.
RESET_TOKEN_MAX_AGE_SECONDS = 60 * 60


def make_password_token(payload, *, salt: str = INVITE_SALT) -> str:
    return signing.dumps(payload, salt=salt)


def read_password_token(
    token, *, salt: str = INVITE_SALT, max_age: int = INVITE_TOKEN_MAX_AGE_SECONDS
):
    """Verify a signed token and return its payload, or None if missing,
    tampered with, or expired. Mirrors
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


def password_fingerprint(user) -> str:
    """A one-way digest of `user.password` (the stored hash) — never the
    hash, or any slice of it, directly: `signing.dumps` SIGNS its payload,
    it does not encrypt it, so anything embedded in a token is visible
    (base64-decodable) inside the emailed link. Embedding this digest in a
    reset token (SEC-7) is what makes the token single-use with no second
    stored "used" flag — see this module's own top docstring.
    """
    return hashlib.sha256(user.password.encode()).hexdigest()[:16]
```

`InviteConfirmSerializer`'s existing call, `read_password_token(attrs["token"])` (`serializers.py:186`), is unaffected — it still passes no `salt`/`max_age`, still resolving to `INVITE_SALT`/`INVITE_TOKEN_MAX_AGE_SECONDS`, still receiving back a plain int.

---

### 2 — `PasswordResetRequestSerializer`, `PasswordResetConfirmSerializer`

**File: `backend/apps/accounts/serializers.py`** — extend the existing `from .tokens import read_password_token` line (10) to:

```python
from .tokens import RESET_SALT, RESET_TOKEN_MAX_AGE_SECONDS, make_password_token, password_fingerprint, read_password_token
```

Add both classes immediately after `InviteConfirmSerializer` (current lines 162-200), before `AuditLogSerializer`:

```python
class PasswordResetRequestSerializer(serializers.Serializer):
    """SEC-7's "forgot password" request step. Deliberately reveals
    nothing about whether `email` belongs to a real, active account:
    `save()` is a silent no-op for a non-existent, inactive, or
    already-unusable-password email — `PasswordResetRequestView` returns
    the identical `200` in every case, whatever `save()` did or didn't do.
    """

    email = serializers.EmailField()

    def save(self, **kwargs):
        # Exact-match `email=`, not `iexact` — deliberately matching
        # Django's own `ModelBackend`/`get_by_natural_key` login lookup,
        # which is already case-sensitive on the stored value. Making
        # only this endpoint case-insensitive would let a mis-cased email
        # request (and complete) a reset for an account it still couldn't
        # log into afterward — a worse inconsistency than staying
        # case-sensitive throughout.
        user = User.objects.filter(email=self.validated_data["email"], is_active=True).first()
        if user is None or not user.has_usable_password():
            return
        try:
            send_password_reset_email.delay(user.id)
        except Exception:
            logger.exception("Failed to queue password-reset email for user %s", user.id)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """SEC-7's reset-confirm step — the forgot-password counterpart to
    `InviteConfirmSerializer`, above, with the precondition flipped: this
    only ever accepts an ALREADY-active account (`is_active=True`), never
    a pending one, and checks `password_fingerprint` equality instead of
    `has_usable_password()` for single-use — see `apps.accounts.tokens`'s
    own module docstring for why an active account needs a different
    single-use mechanism than a pending one.
    """

    token = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        payload = read_password_token(
            attrs["token"], salt=RESET_SALT, max_age=RESET_TOKEN_MAX_AGE_SECONDS
        )
        user = None
        if isinstance(payload, list) and len(payload) == 2:
            user_id, fingerprint = payload
            candidate = User.objects.filter(pk=user_id, is_active=True).first()
            if candidate is not None and password_fingerprint(candidate) == fingerprint:
                user = candidate
        if user is None:
            raise serializers.ValidationError(
                {"token": [_("This reset link is invalid or has expired.")]}
            )
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.save(update_fields=["password"])
        return user
```

`PasswordResetRequestSerializer.save()` references `send_password_reset_email` and `logger` — task 3 creates the former, and add `import logging` + `logger = logging.getLogger(__name__)` at the top of `serializers.py` (this file has neither today — verified by reading it in full).

---

### 3 — `send_password_reset_email` task

**File: `backend/apps/accounts/tasks.py`** — extend the existing `from .tokens import make_password_token` line to:

```python
from .tokens import RESET_SALT, make_password_token, password_fingerprint
```

Update the module docstring's "third `tasks.py` module" note to "fourth" is unnecessary — that note is about `tasks.py` *modules*, not tasks within one; no change needed there. Append, after `send_invite_email`:

```python
@shared_task
def send_password_reset_email(user_id: int) -> None:
    """Emails a "reset your password" link — SEC-7. A no-op if the
    account no longer qualifies by the time this runs (deleted,
    deactivated, or its password made unusable since the request) —
    `PasswordResetRequestView` already returned its generic 200
    regardless, so silently doing nothing here is correct, not a
    swallowed bug. Mirrors `send_invite_email`'s own `DoesNotExist` guard.
    """
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return
    if not user.is_active or not user.has_usable_password():
        return

    token = make_password_token([user.id, password_fingerprint(user)], salt=RESET_SALT)
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    email = EmailMessage(
        subject=str(_("Reset your SupportOS password")),
        body=str(
            _(
                "Someone requested a password reset for your SupportOS "
                "account. If this was you, set a new password here: "
                "%(link)s"
            )
            % {"link": link}
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    email.send()
```

---

### 4 — `PasswordResetRequestView`, `PasswordResetConfirmView`

**File: `backend/apps/accounts/views.py`**

Add `from rest_framework.throttling import ScopedRateThrottle` to the import block. Extend the existing `from .serializers import (...)` block to include `PasswordResetConfirmSerializer, PasswordResetRequestSerializer` (alphabetically, after `LogoutSerializer`, before `RoleAdminSerializer`).

Insert both views immediately after `InviteConfirmView` (current lines 57-73), before `MeView`:

```python
class PasswordResetRequestView(APIView):
    """SEC-7's "forgot password" first step. Never reveals whether
    `email` belongs to a real, active account — returns the identical
    `200` either way; `PasswordResetRequestSerializer.save()` is a silent
    no-op for a non-existent, inactive, or already-unusable-password
    account. Rate limited (`throttle_scope`, `DEFAULT_THROTTLE_RATES` in
    `config/settings/base.py`) — the one thing that actually needs a
    limit here, since an unlimited version could be abused to spam a
    given inbox or as a brute-force enumeration timing oracle at volume.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset_request"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(None, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """SEC-7's reset-confirm step: exchanges the token mailed by
    `send_password_reset_email` (apps/accounts/tasks.py) for a new
    password on an already-active account — the opposite precondition
    from `InviteConfirmView` above, which only ever accepts a pending,
    `is_active=False` one. No Authorization header — the token IS the
    credential, the same reasoning `LogoutView` above documents. Not
    throttled — see `## Story Goal` finding 2.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(None, status=status.HTTP_200_OK)
```

---

### 5 — Routing

**File: `backend/apps/accounts/urls.py`**

```python
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    InviteConfirmView,
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
)

app_name = "accounts"

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
    path("invite/confirm/", InviteConfirmView.as_view(), name="invite_confirm"),
    path(
        "password-reset/request/",
        PasswordResetRequestView.as_view(),
        name="password_reset_request",
    ),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password_reset_confirm",
    ),
]
```

Endpoints: `POST /api/auth/password-reset/request/`, `POST /api/auth/password-reset/confirm/`.

---

### 6 — Throttle rate

**File: `backend/config/settings/base.py`** — add one key to the existing `REST_FRAMEWORK` dict (current lines 241-274), after `"TEST_REQUEST_DEFAULT_FORMAT": "json",`:

```python
    # SEC-7: the request endpoint is the only throttled view in this
    # project today. Keyed by IP for an anonymous caller (DRF's own
    # `ScopedRateThrottle` default `get_ident` behavior) — a plain
    # constant, not an ENV var, the same internal-tuning-knob reasoning
    # `apps.accounts.tokens.RESET_TOKEN_MAX_AGE_SECONDS` documents for
    # itself.
    "DEFAULT_THROTTLE_RATES": {"password_reset_request": "5/hour"},
```

---

## Documentation Tasks

### 7 — Append to `CONVENTIONS.md` § 21

**File: `CONVENTIONS.md`** — append after the existing last entry in § 21 (ends line 753, before the `---` at line 755). Do **not** renumber § 0-§ 27.

```markdown

**When a token's account has no natural "already used" state to gate on,
bake a digest of that state into the token's own payload instead.**
SEC-5's invite token (the entry directly above) is single-use because the
account itself transitions from pending to active. SEC-7's password-reset
token has no such transition available — the account is already active,
with a usable password, throughout. `password_fingerprint`
(`apps/accounts/tokens.py`) closes this by embedding a one-way digest of
`user.password` in the signed payload: once `set_password()` changes that
value, every previously-issued token's baked-in digest silently stops
matching, with no second stored "used" flag anywhere. The digest, never
the hash (or a slice of it) directly — `signing.dumps` signs, it does not
encrypt, so anything in the payload is visible to whoever holds the
token. This is the same technique Django's own `default_token_generator`
uses; reach for it whenever this project needs a single-use token for a
resource with no natural pending→active transition to check instead.
```

**File: `frontend/src/README.md`** — extend line 98-100 (`## Authentication & authorization`) from *"`src/features/auth/` holds `LoginPage` and `SetPasswordPage` (SEC-5's invite-confirm screen), both built from `useAppForm` + `TextField` like any other form."* to:

```markdown
`src/features/auth/` holds `LoginPage`, `SetPasswordPage` (SEC-5's
invite-confirm screen), and `ForgotPasswordPage`/`ResetPasswordPage`
(SEC-7's self-service reset), all built from `useAppForm` + `TextField`
like any other form.
```

---

## Frontend Tasks

### 8 — `LoginPage.tsx`: "Forgot password?" link

**File: `frontend/src/features/auth/components/LoginPage.tsx`** — insert immediately after the password `TextField` (current lines 70-76), before `<FormErrorSummary errors={formErrors} />` (line 77):

```tsx
              <div className="text-end">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t('login.forgotPassword')}
                </Link>
              </div>
```

Remove the footer's `<span>{t('help.lockedOut')}</span>` line (current line 96) — the `help.prompt`/`help.contact`/`help.chat` lines above it are unrelated (a non-staff visitor's links) and stay exactly as they are.

---

### 9 — `ForgotPasswordPage.tsx`

**Create file: `frontend/src/features/auth/components/ForgotPasswordPage.tsx`**

```tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2Icon, MailQuestionIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as z from 'zod'

import { email } from '@/shared/validation/schemas'
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

import { requestPasswordReset } from '../api/requestPasswordReset'

const schema = z.object({ email: email() })
type FormValues = z.output<typeof schema>

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CheckCircle2Icon className="size-10 text-success" />
          <CardTitle asChild className="text-xl">
            <h1>{t('forgotPassword.successTitle')}</h1>
          </CardTitle>
          <CardDescription>
            {t('forgotPassword.successDescription')}{' '}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('forgotPassword.backToSignIn')}
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <ForgotPasswordForm onDone={() => setSubmitted(true)} />
}

function ForgotPasswordForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation('auth')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema, defaultValues: { email: '' } })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => requestPasswordReset(values),
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
          <MailQuestionIcon className="size-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('forgotPassword.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('forgotPassword.subtitle')}</p>
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
                name="email"
                label={t('forgotPassword.email')}
                type="email"
                autoComplete="email"
                autoFocus
              />
              <FormErrorSummary errors={formErrors} />
              <SubmitButton pending={mutation.isPending} size="lg" className="w-full">
                {t('forgotPassword.submit')}
              </SubmitButton>
            </form>
          </Form>
        </CardContent>
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t('forgotPassword.backToSignIn')}
        </Link>
      </p>
    </div>
  )
}
```

A `429 throttled` response surfaces through the shared global toast automatically (`## Prerequisites`) — no special-case handling in `onError`.

---

### 10 — `ResetPasswordPage.tsx`

**Create file: `frontend/src/features/auth/components/ResetPasswordPage.tsx`**

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

import { confirmPasswordReset } from '../api/confirmPasswordReset'

const schema = z.object({ password: requiredString(128) })
type FormValues = z.output<typeof schema>

export function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [done, setDone] = useState(false)

  if (!token) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle asChild className="text-xl">
            <h1>{t('resetPassword.invalidTitle')}</h1>
          </CardTitle>
          <CardDescription>{t('resetPassword.invalidDescription')}</CardDescription>
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
            <h1>{t('resetPassword.successTitle')}</h1>
          </CardTitle>
          <CardDescription>
            {t('resetPassword.successDescription')}{' '}
            <Link
              to="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('resetPassword.signIn')}
            </Link>
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <ResetPasswordForm token={token} onDone={() => setDone(true)} />
}

function ResetPasswordForm({ token, onDone }: { token: string; onDone: () => void }) {
  const { t } = useTranslation('auth')
  const [formErrors, setFormErrors] = useState<string[]>([])
  const form = useAppForm({ schema, defaultValues: { password: '' } })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => confirmPasswordReset({ token, password: values.password }),
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
        <h1 className="text-2xl font-semibold tracking-tight">{t('resetPassword.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('resetPassword.subtitle')}</p>
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
                label={t('resetPassword.password')}
                type="password"
                autoComplete="new-password"
                autoFocus
              />
              <FormErrorSummary errors={formErrors} />
              <SubmitButton pending={mutation.isPending} size="lg" className="w-full">
                {t('resetPassword.submit')}
              </SubmitButton>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
```

A `token` field error (invalid/expired) lands in `applyServerErrors`'s `unattached` array (this form has no field named `token`) and renders via `FormErrorSummary` — the exact `SetPasswordPage` fallback, no special-case code.

---

### 11 — API layer

**Create file: `frontend/src/features/auth/api/requestPasswordReset.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export type RequestPasswordResetInput = { email: string }

export function requestPasswordReset(input: RequestPasswordResetInput): Promise<void> {
  return api.post<void>('/auth/password-reset/request/', input)
}
```

**Create file: `frontend/src/features/auth/api/confirmPasswordReset.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export type ConfirmPasswordResetInput = { token: string; password: string }

export function confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<void> {
  return api.post<void>('/auth/password-reset/confirm/', input)
}
```

---

### 12 — Route

**File: `frontend/src/app/router.tsx`** — append two more children to the `PublicLayout`'s `children` array, immediately after `set-password` (current lines 40-46):

```tsx
{
  path: 'forgot-password',
  lazy: async () => {
    const { ForgotPasswordPage } = await import('@/features/auth/components/ForgotPasswordPage')
    return { element: <ForgotPasswordPage /> }
  },
},
{
  path: 'reset-password',
  lazy: async () => {
    const { ResetPasswordPage } = await import('@/features/auth/components/ResetPasswordPage')
    return { element: <ResetPasswordPage /> }
  },
},
```

---

### 13 — Locale changes

**File: `frontend/src/features/auth/locales/en.json`** — add `"forgotPassword": "Forgot password?"` to the `login` object; **remove** `help.lockedOut` entirely; add two new top-level objects, after `setPassword`:

```json
"forgotPassword": {
  "title": "Reset your password",
  "subtitle": "Enter your email and we'll send you a link to reset it.",
  "email": "Email",
  "submit": "Send reset link",
  "successTitle": "Check your email",
  "successDescription": "If an account exists for that email, a reset link is on its way.",
  "backToSignIn": "Back to sign in"
},
"resetPassword": {
  "title": "Choose a new password",
  "subtitle": "Enter a new password for your account.",
  "password": "New password",
  "submit": "Reset password",
  "successTitle": "Password reset",
  "successDescription": "Your password has been changed.",
  "signIn": "Sign in",
  "invalidTitle": "Invalid link",
  "invalidDescription": "This reset link is missing its token, invalid, or has expired. Request a new one."
}
```

**File: `frontend/src/features/auth/locales/ar.json`** — the identical structural change:

```json
"forgotPassword": {
  "title": "إعادة تعيين كلمة المرور",
  "subtitle": "أدخل بريدك الإلكتروني وسنرسل لك رابطًا لإعادة تعيينها.",
  "email": "البريد الإلكتروني",
  "submit": "إرسال رابط إعادة التعيين",
  "successTitle": "تحقق من بريدك الإلكتروني",
  "successDescription": "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فسيصلك رابط إعادة التعيين قريبًا.",
  "backToSignIn": "العودة لتسجيل الدخول"
},
"resetPassword": {
  "title": "اختر كلمة مرور جديدة",
  "subtitle": "أدخل كلمة مرور جديدة لحسابك.",
  "password": "كلمة المرور الجديدة",
  "submit": "إعادة تعيين كلمة المرور",
  "successTitle": "تمت إعادة تعيين كلمة المرور",
  "successDescription": "تم تغيير كلمة مرورك.",
  "signIn": "تسجيل الدخول",
  "invalidTitle": "رابط غير صالح",
  "invalidDescription": "رابط إعادة التعيين هذا يفتقر إلى الرمز الخاص به، أو غير صالح، أو انتهت صلاحيته. اطلب رابطًا جديدًا."
}
```

`"login": { ..., "forgotPassword": "نسيت كلمة المرور؟" }`; `help.lockedOut` removed from both files.

---

## Edge Cases & Failure Modes

- **A password-hash fragment never appears in an emailed link, even one-way-derived.** `password_fingerprint` is a SHA-256 digest of `user.password`, truncated — not a slice of the hash itself. `signing.dumps` signs its payload but does not encrypt it (verified against `live_chat_adapter`'s identical, already-shipped pattern), so anything embedded is visible to whoever holds the link; a digest reveals nothing that helps crack the underlying password hash, unlike a literal fragment of it would.
- **The same reset token cannot be replayed after a successful reset.** `PasswordResetConfirmSerializer.save()` calls `set_password()`, which changes `user.password`; a second confirm attempt with the identical token re-derives `password_fingerprint(candidate)` against the *new* hash, which no longer matches the token's baked-in digest — `validate()` rejects it with the same generic "invalid or expired" message, no distinct code path.
- **A tampered or expired token gives the same generic error as a nonexistent one.** `read_password_token` catches `signing.BadSignature` (covering both tampering and its `SignatureExpired` subclass) and returns `None`; a malformed payload shape (not a 2-element list) or an unknown/inactive user id both fall through to the identical `{"token": [...]}` message in `PasswordResetConfirmSerializer.validate` — no information about *why* a token failed is leaked.
- **Requesting a reset for a pending (never-confirmed-invite), deactivated, or nonexistent email is indistinguishable from a successful request.** `PasswordResetRequestView` always returns `200`; `PasswordResetRequestSerializer.save()`'s `is_active=True` + `has_usable_password()` guard silently excludes all three cases from ever queuing an email. A pending invite account correctly gets nothing from this flow — it needs `SEC-5`'s invite-confirm, not a reset.
- **A weak or too-short new password at confirm time is a field error on `password`, not `token`, and not a 500.** `PasswordResetConfirmSerializer.validate_password` runs the same `django.contrib.auth.password_validation.validate_password` every other password-setting path in this app already runs.
- **Spamming the request endpoint returns `429`, not a silent-forever `200`.** `ScopedRateThrottle` + `DEFAULT_THROTTLE_RATES["password_reset_request"] = "5/hour"` caps it per caller IP; `envelope_exception_handler` already turns a `Throttled` into a `429` envelope with `Retry-After` preserved (`## Prerequisites`, verified via the pre-existing `test_throttled_keeps_retry_after_header`), and the frontend shows a translated message with zero new code.
- **The rate limit is per-IP, not per-email — a deliberate choice, not an oversight.** Keying by email instead would itself become a new, cheaper information-disclosure/abuse vector (an attacker could probe whether an email is "already at its rate limit" as an indirect existence signal, and could trivially grief a *specific* victim's ability to ever request a reset by repeatedly submitting their email from anywhere). Per-IP is DRF's own default for an anonymous `ScopedRateThrottle` caller and is what this story uses unmodified.
- **Response-timing differences between the "email exists and qualifies" and "silently do nothing" branches are not equalized.** Explicitly out of scope (`## Story Goal`) — the same non-goal essentially every real-world implementation of this pattern accepts.
- **`Celery` worker or Redis down at request time.** `send_password_reset_email.delay(...)` is wrapped in the same `try/except Exception: logger.exception(...)` `UserViewSet.perform_create`'s own invite-email dispatch already uses (Story 70) — the request endpoint still returns `200`; only the email never gets queued.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py test` — the existing **54** must still pass. No migration ships (no model change), so `MigrationStateTests.test_no_pending_migrations` stays a no-op check.
2. `ruff format --check .` / `ruff check .` on the new and changed Python (`tokens.py`, `serializers.py`, `tasks.py`, `views.py`, `urls.py`, `base.py`).
3. `npm run build` — typechecks the two new page components, the two new API modules, and every new `t('auth:forgotPassword...')`/`t('auth:resetPassword...')`/`t('auth:login.forgotPassword')` key.
4. `npm run lint` (`react/jsx-no-literals` over `ForgotPasswordPage.tsx`/`ResetPasswordPage.tsx`/the changed `LoginPage.tsx`), `npm run format:check`, `npm run check:rtl`.
5. The `en`/`ar` key-set comparison script (the same one Story 10 Verification Step 4 introduced), run against `frontend/src/features/auth/locales/{en,ar}.json`.
6. Real HTTP against the full request → confirm → login chain, the enumeration-safety property, the throttle, and the single-use replay check — plus a real browser walkthrough in both languages: Verification Steps 4-14 below.

---

## Migration / Rollback

**No schema migration in this story.** No model changes — `User.password`/`User.is_active` already exist; `password_fingerprint` reads `user.password`, it does not add a field.

**Rollback of the code:** revert the commits. No `pip install`/`npm install` — no new dependency (DRF's own `ScopedRateThrottle` ships with the already-installed `djangorestframework`).

**Half-applied states to avoid:**

- **Task 1 (`tokens.py` widened) is a strict prerequisite for tasks 2/3** — `PasswordResetConfirmSerializer`/`send_password_reset_email` both call the widened `make_password_token`/`read_password_token` and the new `password_fingerprint`. Ship task 1 first or together.
- **Task 2/4 (serializers/views reference `send_password_reset_email`) before task 3 (`tasks.py`)** → `ImportError` at Django startup (`views.py`/`serializers.py` import from `.tasks`, which would not yet define the new task). Ship together.
- **Task 4/5 (views/urls) before task 6 (`DEFAULT_THROTTLE_RATES`)** → `PasswordResetRequestView` raises `ImproperlyConfigured` (`ScopedRateThrottle` requires its scope to exist in `DEFAULT_THROTTLE_RATES`) the first time it's hit. Ship together.
- **Task 9/10 (frontend components) before task 11 (`requestPasswordReset.ts`/`confirmPasswordReset.ts`)** → the import fails, `tsc -b` fails.
- **Task 9/10 before task 13 (locale keys)** → every new `t('auth:forgotPassword...')`/`t('auth:resetPassword...')` call fails `tsc -b`, the same failure mode `CONVENTIONS.md` § 23 already documents for a components-before-locales ordering.
- **Task 12 (routes) before tasks 9/10 exist** → the lazy imports resolve to modules that do not exist yet; the build fails on the import.
- **Task 8 (removing `help.lockedOut` from `LoginPage.tsx`) before task 13 (removing the key from the locale files)** — harmless either order; an unused locale key is not a build error, just dead weight until task 13 removes it. Ship together for a clean diff regardless.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `python manage.py check`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` reports **54** passing.
3. **`en`/`ar` key sets match** for `features/auth/locales` (`## Test Plan` item 5).
4. **Start Redis, a Celery worker, and the backend** (`redis-cli ping` → `PONG`; `celery -A config worker -l info --pool=solo` on Windows per `CONVENTIONS.md` § 24; `python manage.py runserver`).
5. **Requesting a reset for a real, active account returns 200 and queues an email.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/password-reset/request/ -H "Content-Type: application/json" -d '{\"email\":\"admin@supportos.local\"}'
   ```

   Expect `200`. The Celery worker's console log (dev's console `EMAIL_BACKEND`) prints an email with a `/reset-password?token=...` link — copy the token out of it.
6. **Requesting a reset for a nonexistent email returns the identical 200, same shape, no email queued.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/password-reset/request/ -H "Content-Type: application/json" -d '{\"email\":\"nobody-at-all@supportos.local\"}'
   ```

   Diff this response against Step 5's — byte-identical body shape (`{"success":true,"data":null,...}`), same `200` status. No new line appears in the worker log.
7. **A malformed email is a normal field validation error, not a special code.** `POST` with `{"email":"not-an-email"}` → `400 validation_error`, field `email`.
8. **The request endpoint is rate-limited.** Repeat Step 5's request 6 times in a row (any target email) — the 6th returns `429`, `code: "throttled"`, a `Retry-After` header present.
9. **A weak new password at confirm is rejected.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/password-reset/confirm/ -H "Content-Type: application/json" -d '{\"token\":\"<token>\",\"password\":\"123\"}'
   ```

   Expect `validation_error` on field `password`.
10. **A valid confirm changes the password and logs in with it.** Repeat Step 9 with a strong password → `200`. `POST /api/auth/token/` with `admin@supportos.local` and the new password → `200`, a real token pair. (Reset the password back afterward via Django admin or another reset, to avoid breaking later manual testing sessions.)
11. **The same token cannot be replayed.** Re-POST Step 10's exact confirm request again → `validation_error` on field `token`, not `200` — proves single-use via the fingerprint mechanism.
12. **A tampered token fails the same way as an expired one.** `POST` confirm with `"token":"garbage"` → the identical `{"token": [...]}` `validation_error`.
13. **The full UI walkthrough, both languages.** `npm run dev` with the backend/worker/Redis up:
    - `/login` shows "Forgot password?" under the password field; no leftover "Ask an admin" copy anywhere.
    - Following it to `/forgot-password`, submitting a real email shows the generic "Check your email" success screen — submitting a *fake* email shows the exact same screen.
    - Copy the reset link from the worker console into a fresh tab at `/reset-password?token=...` — the form renders; submitting a valid password shows the success card with a working "Sign in" link; signing in with the new password succeeds.
    - Visiting `/reset-password` with no `?token=` shows the "Invalid link" card immediately, no request fires.
    - Switch to Arabic: `/forgot-password`, `/reset-password`, and the updated `/login` "Forgot password?" link are all fully translated, `dir="rtl"`.
14. **No hardcoded strings.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\auth\components\ForgotPasswordPage.tsx,src\features\auth\components\ResetPasswordPage.tsx,src\features\auth\components\LoginPage.tsx -Pattern "'[A-Z][a-z]{3,}"
    ```

    Must return only non-user-facing hits.
15. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `apps/accounts/tokens.py`'s `make_password_token`/`read_password_token` accept/return any JSON-serialisable payload (not just `int`); `RESET_SALT`/`RESET_TOKEN_MAX_AGE_SECONDS`/`password_fingerprint` added; `InviteConfirmSerializer`'s existing call site is unmodified in behavior.
- [ ] `PasswordResetRequestSerializer`/`PasswordResetConfirmSerializer` exist; the request serializer's `save()` is a provably silent no-op for a non-existent/inactive/unusable-password email; the confirm serializer requires `is_active=True` **and** a matching `password_fingerprint` (not `has_usable_password()` — that check is invite-specific).
- [ ] `PasswordResetRequestView`/`PasswordResetConfirmView` reachable at `POST /api/auth/password-reset/request/` and `.../confirm/`, `AllowAny`/no `Authorization` header, through the standard envelope/error model.
- [ ] The request view is throttled (`ScopedRateThrottle`, scope `password_reset_request`, `5/hour` in `DEFAULT_THROTTLE_RATES`); the confirm view is **not** throttled.
- [ ] `apps/accounts/tasks.py::send_password_reset_email` reuses `settings.EMAIL_BACKEND`/`DEFAULT_FROM_EMAIL`/`django.core.mail.EmailMessage` — no new email provider, no new setting beyond the one throttle-rate key.
- [ ] No new migration of any kind — verified by `git status`/`git diff` showing no new file under `apps/accounts/migrations/`.
- [ ] `LoginPage.tsx` shows a "Forgot password?" link under the password field; `help.lockedOut` removed from both locale files and no longer rendered anywhere.
- [ ] `ForgotPasswordPage.tsx`/`ResetPasswordPage.tsx` exist, routed at `/forgot-password`/`/reset-password` inside `PublicLayout`; the forgot-password success screen is identical regardless of whether the submitted email exists.
- [ ] `requestPasswordReset.ts`/`confirmPasswordReset.ts` post via the shared `api.post` helper — no second Axios instance, no `fetch()`.
- [ ] `login.forgotPassword`/`forgotPassword.*`/`resetPassword.*` added to both `auth` locale files; `en`/`ar` key sets match (Verification Step 3).
- [ ] Verified by real HTTP: successful request queues an email (Step 5); a nonexistent email gets the byte-identical response (Step 6); malformed email is a normal field error (Step 7); the request endpoint throttles at the 6th call (Step 8); weak-password rejection at confirm (Step 9); successful confirm and login with the new password (Step 10); single-use replay rejection (Step 11); tampered-token rejection (Step 12).
- [ ] Both languages walk through cleanly end to end (Step 13); no hardcoded strings (Step 14).
- [ ] `CONVENTIONS.md` § 21 gains the appended fingerprint-based-single-use entry (§ 0-§ 27 unrenumbered); `frontend/src/README.md` names `ForgotPasswordPage`/`ResetPasswordPage` alongside `LoginPage`/`SetPasswordPage`.
- [ ] `python manage.py test` reports **54** passing; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` updated with this story's row; `.squad/plans/00-index.md`'s `security-administration` NN range updated to include `72`.
