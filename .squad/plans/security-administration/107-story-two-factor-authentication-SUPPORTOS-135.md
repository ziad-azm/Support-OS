# Story 107 — Two-Factor Authentication (2FA) (Story: SUPPORTOS-135)

## Prerequisites

- **Story 08 completed** (`AUTH-1`, [../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md](../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md)) — the JWT token-issue flow this story extends. Read as historical context only: `apps/accounts/views.py`/`urls.py` have moved on since (PROD-3 throttling, SEC-5 through SEC-8's credential endpoints); `## Context` below cites the current files, not that plan's own body.
- **Story 09 completed** (`AUTH-2`, [../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md](../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md)) — `HasPermission`/`permission_map`, reused unmodified for the one new admin action this story adds.
- **Story 48/49 completed** (`SEC-1`/`SEC-2`, [48-story-users-roles-admin-SUPPORTOS-72.md](48-story-users-roles-admin-SUPPORTOS-72.md), [49-story-permissions-management-SUPPORTOS-73.md](49-story-permissions-management-SUPPORTOS-73.md)) — `Role`, `RoleAdminSerializer`, `RoleViewSet`, `RoleFormPage.tsx`'s hand-rolled `FormField` pattern; this story adds one plain field to that same model/screen, no new pattern.
- **Story 52 completed** (`SEC-3`, [52-story-audit-logs-SUPPORTOS-74.md](52-story-audit-logs-SUPPORTOS-74.md)) — `AuditLog`, reused for every 2FA state change the intake asks to be logged.
- **Story 92 completed** (`PROD-3`, [../production-readiness/00-overview.md](../production-readiness/00-overview.md)) — `FailOpenScopedRateThrottle`, the `auth_credentials` throttle scope, and `ThrottledTokenObtainPairView`/`ThrottledTokenRefreshView`, the exact views this story gives a serializer to for the first time.
- **Story 73 completed** (`SEC-8`, [73-story-change-password-SUPPORTOS-110.md](73-story-change-password-SUPPORTOS-110.md)) — the closest sibling in shape (`ChangePasswordView`/`ChangePasswordSerializer`/`ChangePasswordSection.tsx`/`PreferencesPage.tsx`); this story's self-service backend/frontend tasks copy its structure directly.
- **Story 06/07 completed** (`FORM`, [../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md](../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md), [../internationalization-design-system/07-story-forms-validation-foundation-SUPPORTOS-12.md](../internationalization-design-system/07-story-forms-validation-foundation-SUPPORTOS-12.md)) — `useAppForm`/`TextField`/`SwitchField`/`FormErrorSummary`/`SubmitButton`, reused unmodified.
- Verified backend baseline (this session, live): `backend/apps/accounts/` currently has no test directory at all (`apps/accounts/tests/` does not exist) — `CONVENTIONS.md` §16's "no automated tests" policy, confirmed against the actual tree, not just prior plans.
- Verified: `cryptography` 50.0.1 is already resident in the backend virtualenv (`pip show cryptography` → `Required-by: autobahn, google-auth, pyOpenSSL, service-identity` — a transitive dependency of `channels`/`daphne`'s websocket stack and `google-genai`'s auth, never a direct project dependency). This story is the first to depend on it directly and must add it to `requirements.txt` explicitly rather than continuing to rely on it being present by accident.
- Verified: neither `pyotp` nor any QR-code library exists anywhere in `requirements.txt`, `requirements-dev.txt`, or `frontend/package.json` — both are new dependencies this story adds (`pyotp>=2.10,<3` backend; `qrcode.react` `^4.2.0` frontend, versions confirmed current via `pip index versions`/`npm view` this session).
- Verified: no `TokenObtainPairSerializer` subclass exists anywhere today — `backend/apps/accounts/throttled_token_views.py:23-27`'s `ThrottledTokenObtainPairView` adds only `throttle_classes`/`throttle_scope` to the stock simplejwt view, per that file's own docstring ("NOTHING else"). This story gives it a `serializer_class` for the first time.

---

## Story Goal

Staff accounts can require a second factor at sign-in, recover from a lost device without permanent lockout, and an organization can mandate this per role — the three outcomes the intake's three tasks each name.

1. **TOTP enrolment & verification.** A user turns on 2FA from `PreferencesPage.tsx`: scan a QR code (or enter a secret manually) in an authenticator app, confirm one code, done. From then on, `POST /api/auth/token/` no longer returns a token pair for that account directly — it returns a short-lived challenge, exchanged at a new endpoint for the real tokens once the caller proves the second factor.
2. **Recovery codes & admin reset.** Ten single-use recovery codes are issued the moment 2FA is confirmed, shown exactly once. Losing the device is not permanent: a recovery code signs the user back in (consuming it), and, separately, an admin holding `users.manage` can reset 2FA on another account entirely (clearing it back to "not enrolled" — never revealing the secret, which is impossible anyway since it is never returned by any endpoint after enrolment).
3. **UI + org-level enforcement policy.** `Role` gains a `requires_two_factor` flag, editable on the existing role-edit screen (SEC-2's screen) alongside the permission checklist. Portal customers are unaffected — the flag lives on `Role`, and the seeded `customer` role is never touched by this UI.

### Verified findings that shape this story beyond the intake's own wording

**A TOTP secret is the one stored credential in this codebase that must be decrypted again later, not just compared — this is why it is the first to get real encryption at rest.** `CONVENTIONS.md` §36's audit found every other stored credential (`EmailProviderConfig.host_password`, `ErpConnection.auth_token`) is plain-text-but-`write_only` (never read back by the app itself), and `ApiKey.hashed_key` is a one-way `sha256` digest (verified again by comparison, never decrypted) — both audited and left as-is twice already, precisely because neither needs a genuine encryption library. Verifying a live TOTP code needs the *raw* secret every time, so neither pattern applies here. `apps/accounts/mfa.py` (new) adds `cryptography`'s `Fernet` for this reason alone — declared as a direct dependency in `requirements.txt`, not left as the accidental transitive one already sitting in the venv.

**Org-level "require 2FA for this role" is a plain `BooleanField` directly on `Role`, not a new list on `OrganizationSettings`, even though the intake says "org setting (via SEC-4)".** `apps/organization/models.py:89-119`'s own docstring records that `CONVENTIONS.md` §33 already settled this exact shape question twice: ORG-1 and ORG-2 promoted `OrganizationSettings.departments`/`.branches` — both once `JSONField(default=list)` string lists — to real `Department`/`Branch` models, and that section now reads "a future story wanting a list of things on that model should create a model, not a column." `Role` already exists as the per-role model; a fact about one role belongs on that row, the same way `is_system` already does, not in a second list keyed by slug on a different model.

**Recovery codes are hashed like `ApiKey`, not like a password.** `apps/integrations/keys.py` (`hash_api_key`/`secrets_match`) hashes a high-entropy random secret with plain `sha256` plus `hmac.compare_digest`, deliberately not Django's slow `make_password`/PBKDF2 — its own docstring explains there is no low-entropy guess space a slow KDF would meaningfully protect once the secret itself already has enough bits. A recovery code (`secrets.token_hex(5)`, 40 bits) is the same shape, so it follows the same pattern.

**No second auth flow: the 2FA challenge reuses the existing signed-token idiom, not a new session-scoped "pending login" state.** `apps/accounts/tokens.py`'s `make_password_token`/`read_password_token` already generalized from "sign an int" (`INVITE_SALT`, Story 70) to "sign any JSON-serialisable payload" (`RESET_SALT`, Story 72). This story adds a third salt, `MFA_CHALLENGE_SALT`, and one exchange endpoint that needs no `Authorization` header — the same "the token IS the credential" reasoning `LogoutView`/`PasswordResetConfirmView` already establish for their own signed tokens (`apps/accounts/views.py:44-65`, `137-161`). The real `authenticate()` password check still happens exactly once, inside `TokenObtainSerializer.validate` — nothing here is a parallel path around it.

**Org-level enforcement is real but has a scope boundary, stated here rather than silently engineered around.** A role flagged `requires_two_factor=True` cannot hard-block login for an account that has not yet enrolled without either inventing a second, narrower pre-authentication token flow (which the intake explicitly forbids — "do not build a second auth flow") or widening the JWT claims to express a restricted "setup-only" access token (a materially bigger change than this story's scope). This story instead exposes `mfa_required`/`mfa_enabled` on `/api/auth/me/` and gates every protected route client-side (`RequireAuth` redirects an under-enrolled, role-mandated account to `/preferences` until they finish enrolling) — real for the common case, but, per `CONVENTIONS.md` §12, a frontend check is UX only: a still-valid access token obtained before the redirect could still call any other endpoint directly during that gap. Recorded explicitly in `## Edge Cases`, the same way `CONVENTIONS.md` §36 already records login throttling's per-IP-only limitation as a known gap rather than hiding it.

### Explicitly out of scope

- **A backend hard-block on `/api/auth/token/` for an unenrolled, role-mandated account.** See the finding above. Enforcement is a real per-role flag plus a client-side redirect gate, not a second token-issuing surface.
- **Trusted-device / "remember this browser for 30 days" skip.** Not named by the intake; every sign-in with 2FA enabled always challenges.
- **SMS or email as a second-factor delivery channel.** The intake names TOTP only ("shared secret + QR provisioning URI").
- **Automated tests.** Standing policy (`CONVENTIONS.md` §16). See `## Test Plan`.
- **Rotating `MFA_ENCRYPTION_KEY`, or re-encrypting existing secrets after a key change.** Out of scope for this story; a key rotation strategy is a future operational concern, not asked for here — `apps/accounts/mfa.py` documents that an unrecognised key makes `decrypt_secret` raise, which the confirm/verify endpoints turn into "no working secret," not a 500.

---

## Context — Read These Files First

1. `.squad/stories/security-administration/SUPPORTOS-135/intake.md` — one description, three task blocks (TOTP enrolment/verification; recovery codes/admin reset; UI + org enforcement), no attachments, no acceptance criteria.
2. `backend/apps/accounts/models.py` (all 255 lines, current state) — `Role` (41-86, no field beyond `slug`/`name`/`description`/`permissions`/`is_system` today), `User` (89-169, no 2FA field today), `AuditLog` (172-255, `Action` choices at 208-218, one real call site at `apps/accounts/views.py:272-287`).
3. `backend/apps/accounts/throttled_token_views.py` (all 35 lines, in full) — `ThrottledTokenObtainPairView` (23-27) is what task 3 below gives a `serializer_class` to.
4. `backend/apps/accounts/tokens.py` (all 79 lines, in full) — `INVITE_SALT`/`RESET_SALT`, `make_password_token`/`read_password_token`, `password_fingerprint`. Task 2 adds a third salt following this exact shape.
5. `backend/apps/accounts/serializers.py` (all 414 lines, current post-SEC-8 state) — `ChangePasswordSerializer` (341-376) is the closest existing shape (a plain `serializers.Serializer`, `validate_*` reads only, `save()` writes); `InviteConfirmSerializer`/`PasswordResetConfirmSerializer` (232-338) are the closest shape for a token-resolves-to-a-user serializer.
6. `backend/apps/accounts/views.py` (all 503 lines, current post-SEC-8 state) — `ChangePasswordView` (169-195) is the exact `APIView` shape tasks 6-8 below copy; `UserViewSet` (213-343, `perform_update`/`destroy` at 289-343) is where the new `reset_2fa` action is added; `AuditLog.objects.create(...)` call sites throughout are the pattern every new audit row here follows (written in `views.py`, never inside a serializer).
7. `backend/apps/accounts/urls.py` (all 39 lines, in full) — the flat, router-free module every credential endpoint lives in.
8. `backend/apps/accounts/admin.py` (all 137 lines, in full) — `AuditLogAdmin` (104-137) is the "read-only support visibility" shape task 5 below copies for the new `TwoFactorRecoveryCode` model.
9. `backend/apps/core/permissions.py` (all 149 lines, in full) — `Permissions` (18-46, no new constant needed — `reset_2fa` reuses `USERS_MANAGE`), `HasPermission` (74-149, `_required_permission` keys a custom `@action` by its own method name, verified against the real precedent below).
10. `backend/apps/customers/views.py:50-69, 103-117` — `CustomerViewSet.permission_map`'s `"portal_access": Permissions.CUSTOMERS_MANAGE` entry (line 68) is the exact "one permission_map entry keyed by the `@action`'s method name, both HTTP verbs share it" precedent `UserViewSet.reset_2fa` follows.
11. `backend/apps/integrations/keys.py` (all 60 lines, in full) — `hash_api_key`/`secrets_match`, the exact pattern `apps/accounts/mfa.py`'s recovery-code hashing copies.
12. `backend/apps/core/throttling.py` (all 104 lines, in full) — `FailOpenScopedRateThrottle` (73-82), reused unmodified for every new throttled endpoint below.
13. `backend/config/settings/base.py:186-210` — the `JWT_SIGNING_KEY`/`SIMPLE_JWT` block task 1 below adds `MFA_ENCRYPTION_KEY` directly after, following (and explicitly contrasting with) `JWT_SIGNING_KEY`'s own `or SECRET_KEY` fallback shape. Lines 346-360 (`DEFAULT_THROTTLE_RATES`, specifically `"auth_credentials": "10/minute"`) is the scope every new throttled endpoint below reuses — no new scope is added.
14. `backend/requirements.txt` (all 21 lines, in full) — no encryption or TOTP library present; task 0 below adds two lines.
15. `backend/.env.example` — the `# --- JWT ---` block (`JWT_SIGNING_KEY=`/`JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15`/`JWT_REFRESH_TOKEN_LIFETIME_DAYS=7`); task 1 appends `MFA_ENCRYPTION_KEY=` directly after it.
16. `CONVENTIONS.md` §21 (lines 721-853, ends before the `---` at 855) and §33 (ORG-1/ORG-2's "list → model" precedent, cited above) and §36 (lines 2739-2884, the secret-handling audit this story's encryption decision responds to).
17. `frontend/src/shared/auth/AuthProvider.tsx` (all 95 lines, in full) — `login` (51-70) is rewritten by task 12 below to branch on a 2FA challenge; `logout`/the boot `useEffect` are the shape `refreshUser`/`completeMfaChallenge` follow.
18. `frontend/src/shared/auth/types.ts` (all 52 lines, in full) — `AuthUser`/`AuthContextValue`, extended by task 11.
19. `frontend/src/shared/auth/RequireAuth.tsx` (all 21 lines, in full) — the layout-route `Navigate` pattern task 13 extends with one more branch.
20. `frontend/src/features/auth/components/LoginPage.tsx` (all 136 lines, in full) — rewritten by task 15 to add the post-challenge code-entry step.
21. `frontend/src/features/auth/components/ChangePasswordSection.tsx` (all 79 lines, in full) and `frontend/src/features/auth/api/changePassword.ts` (8 lines) — the exact three-layer shape (`api` fn → inline `useMutation` → `Card`-based section) task 16's `TwoFactorSection.tsx` follows, extended with a multi-step (enroll → confirm → show recovery codes) flow.
22. `frontend/src/app/PreferencesPage.tsx` (all 40 lines, in full) — task 17 adds one more sibling `<TwoFactorSection />` after `<ChangePasswordSection />` (line 37).
23. `frontend/src/features/accounts/components/RoleFormPage.tsx` (all 254 lines, in full) — the schema/`toDefaults`/`toRoleInput` triplet (32-64) and the first `<Card>` block (168-183) task 19 extends with one `SwitchField`.
24. `frontend/src/features/accounts/types/role.ts` (12 lines, in full) — `Role`/`RoleInput`, both gain `requires_two_factor: boolean`.
25. `frontend/src/features/accounts/components/UserFormPage.tsx:227-330` (`UserEditForm`) and `frontend/src/features/accounts/components/UserListPage.tsx:15, 33, 43-51` (`useConfirm`/`handleDelete`) — the confirm-dialog pattern task 21's "Reset 2FA" button copies.
26. `frontend/src/features/accounts/api/useUserMutations.ts` (all 40 lines, in full) and `frontend/src/features/accounts/types/user.ts` (35 lines, in full) — `useDeleteUser`'s shape task 20 copies for `useResetTwoFactor`; `AdminUser` gains `mfa_enabled: boolean`.
26. `frontend/src/shared/ui/form/index.ts` (10 lines) — confirms `SwitchField`/`TextField` are already exported; no new shared field component is needed anywhere in this story.
27. `frontend/src/features/auth/locales/{en,ar}.json` (52/53 lines each, current post-SEC-8 state) and `frontend/src/features/accounts/locales/en.json` (101 lines, in full) — the nesting convention every new locale key below follows.
28. `frontend/package.json` — no QR-rendering dependency present; task 10 adds one.

---

## Backend Tasks

### 0 — Dependencies

**File: `backend/requirements.txt`** — add two lines, directly after `djangorestframework-simplejwt>=5.5,<6`:

```
cryptography>=50.0,<51
pyotp>=2.10,<3
```

Verified current releases: `cryptography` 50.0.1 (already resident transitively — see `## Prerequisites` — this pins it as a direct dependency for the first time), `pyotp` 2.10.0 (new).

Do **not** run `pip install` against the project's real venv from this planning session — the executor's `pip install -r requirements.txt` step does this at implementation time.

---

### 1 — Settings: `MFA_ENCRYPTION_KEY`

**File: `backend/config/settings/base.py`** — add `import base64` and `import hashlib` to the top-of-file imports (currently `import logging`, `from datetime import timedelta`, `from pathlib import Path`, `import environ` — insert `base64`/`hashlib` alphabetically before `logging`).

Insert directly after the `SIMPLE_JWT` block (current lines 189-210), before the `# --- CORS ---` section:

```python
# SEC-9 (Story 107). Fernet requires a 32-byte urlsafe-base64 key
# specifically, unlike JWT_SIGNING_KEY immediately above (any string works
# for HMAC signing) — so unlike that setting's `or SECRET_KEY` fallback,
# an unset MFA_ENCRYPTION_KEY derives a validly-shaped key from SECRET_KEY
# instead of reusing it directly. See apps/accounts/mfa.py.
_mfa_encryption_key = env("MFA_ENCRYPTION_KEY", default="").strip()
MFA_ENCRYPTION_KEY = (
    _mfa_encryption_key.encode()
    if _mfa_encryption_key
    else base64.urlsafe_b64encode(hashlib.sha256(SECRET_KEY.encode()).digest())
)
```

**File: `backend/.env.example`** — add one line directly after `JWT_REFRESH_TOKEN_LIFETIME_DAYS=7`:

```
# --- 2FA (SEC-9) ---
# Optional: a real Fernet key (`Fernet.generate_key()`), urlsafe-base64,
# 44 chars. Blank derives one from DJANGO_SECRET_KEY — fine for local dev,
# but means rotating DJANGO_SECRET_KEY also invalidates every stored TOTP
# secret. Set this explicitly in any real deployment.
MFA_ENCRYPTION_KEY=
```

---

### 2 — `apps/accounts/tokens.py`: the third salt

**File: `backend/apps/accounts/tokens.py`** — append after `RESET_TOKEN_MAX_AGE_SECONDS` (current line 47), before `def make_password_token`:

```python
MFA_CHALLENGE_SALT = "apps.accounts.mfa_challenge"
# 5 minutes: long enough to switch to an authenticator app and read a code,
# short enough that a challenge token left in browser history or a proxy
# log is not a standing liability — shorter than RESET_TOKEN_MAX_AGE_SECONDS
# because this token grants a narrower thing (permission to attempt one 2FA
# code for an account whose password is already verified), not a password
# change.
MFA_CHALLENGE_MAX_AGE_SECONDS = 60 * 5
```

Update the module's own top docstring's "Two callers, two salts" list to "Three callers, three salts" and add a third bullet describing `MFA_CHALLENGE_SALT` in the same style as the existing two.

---

### 3 — Create `apps/accounts/mfa.py`

**Create file: `backend/apps/accounts/mfa.py`**

```python
"""TOTP secret encryption, code generation/verification, and recovery-code
hashing — SEC-9 (Two-Factor Authentication).

The TOTP secret is the one stored credential in this codebase that must be
DECRYPTED again later (every code verification needs the raw secret) — see
CONVENTIONS.md §36 for why every other stored credential
(`EmailProviderConfig.host_password`, `ErpConnection.auth_token`) stays
plain-text-but-write-only instead, and why `ApiKey.hashed_key` (a one-way
sha256 digest) cannot substitute here. `cryptography`'s `Fernet` is added
for this reason alone — the first encryption-at-rest in this codebase.

Recovery codes are the opposite case: verified by comparison only, never
read back, so they follow `apps.integrations.keys`'s `hash_api_key`/
`secrets_match` pattern exactly (plain sha256 + `hmac.compare_digest`, no
slow KDF) rather than `django.contrib.auth.hashers` — the code is already
40 bits of `secrets.token_hex` output, so there is no low-entropy guess
space a slow hash would meaningfully protect, the same reasoning
`apps.accounts.tokens.password_fingerprint` and `apps.integrations.keys`
both document for themselves.
"""

import hashlib
import hmac
import secrets

import pyotp
from cryptography.fernet import Fernet
from django.conf import settings

RECOVERY_CODE_COUNT = 10


def _fernet() -> Fernet:
    return Fernet(settings.MFA_ENCRYPTION_KEY)


def encrypt_secret(raw_secret: str) -> str:
    return _fernet().encrypt(raw_secret.encode()).decode()


def decrypt_secret(encrypted_secret: str) -> str:
    """Raises `cryptography.fernet.InvalidToken` if `MFA_ENCRYPTION_KEY` has
    changed since the secret was encrypted, or the stored value is corrupt.
    Callers treat that the same as "no working secret" (see `## Edge Cases`)."""
    return _fernet().decrypt(encrypted_secret.encode()).decode()


def generate_totp_secret() -> str:
    """160 bits — `pyotp.random_base32`'s own default and minimum; it raises
    `ValueError` below 32 base32 characters ("Secrets should be at least
    160 bits"), verified against the installed 2.10.0 source."""
    return pyotp.random_base32()


def provisioning_uri(user, raw_secret: str) -> str:
    return pyotp.TOTP(raw_secret).provisioning_uri(name=user.email, issuer_name="SupportOS")


def verify_totp_code(raw_secret: str, code: str) -> bool:
    """`valid_window=1` accepts the previous and next 30-second step too —
    tolerates ordinary clock drift between the server and an authenticator
    app without widening the window so far that a guessed code has a
    meaningfully larger chance of landing inside it."""
    return pyotp.TOTP(raw_secret).verify(code, valid_window=1)


def generate_recovery_codes(count: int = RECOVERY_CODE_COUNT) -> list[str]:
    """Each code is 10 hex characters (40 bits) from `secrets.token_hex` —
    the same "already high-entropy, no KDF needed" reasoning
    `apps.integrations.keys.hash_api_key` documents for its own secret. Ten
    is an arbitrary, common count — the intake does not specify one."""
    return [secrets.token_hex(5) for _ in range(count)]


def hash_recovery_code(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


def recovery_code_matches(stored_hash: str, code: str) -> bool:
    """Constant-time comparison — mirrors `apps.integrations.keys.secrets_match`
    exactly, for the same timing-attack reason."""
    return hmac.compare_digest(stored_hash, hash_recovery_code(code))
```

---

### 4 — Models

**File: `backend/apps/accounts/models.py`** — add two fields to `User`, directly after `branch` (current lines 142-149), before `objects = UserManager()` (line 151):

```python
    # SEC-9. `mfa_secret` holds the Fernet-encrypted TOTP secret once
    # enrolment starts; `mfa_enabled` only flips True once a real code has
    # been confirmed (`TwoFactorConfirmSerializer.save`) — an abandoned,
    # unconfirmed enrolment leaves `mfa_secret` set but `mfa_enabled` False,
    # the same "pending state expressed through existing/adjacent fields,
    # not a new status column" shape Story 70 established for `is_active`/
    # `has_usable_password()`.
    mfa_enabled = models.BooleanField(_("two-factor authentication enabled"), default=False)
    # Never returned by any serializer once set — see CONVENTIONS.md §36's
    # "the only 5 readable fields are has_* booleans" rule, extended here:
    # unlike every field that rule already covers, this one must also be
    # DECRYPTABLE later (`apps.accounts.mfa.decrypt_secret`), which is why
    # it is encrypted rather than write_only-plaintext or a one-way digest.
    mfa_secret = models.CharField(_("two-factor secret"), max_length=255, blank=True)
```

Add one field to `Role`, directly after `permissions` (current line 56), before `is_system` (line 59):

```python
    # SEC-9. Per-role, not a global switch — a portal customer's `Role`
    # (seeded "customer") is never edited on this admin screen, so portal
    # logins stay simple regardless of what any staff role requires.
    # Enforced client-side only today — see `UserSerializer.get_mfa_required`
    # (serializers.py) and this story's `## Edge Cases` for the accepted gap.
    requires_two_factor = models.BooleanField(_("requires two-factor authentication"), default=False)
```

Add four choices to `AuditLog.Action`, directly after `PORTAL_ACCESS_REVOKED` (current line 218):

```python
        TWO_FACTOR_ENABLED = "two_factor_enabled", _("Two-factor authentication enabled")
        TWO_FACTOR_DISABLED = "two_factor_disabled", _("Two-factor authentication disabled")
        TWO_FACTOR_RESET = "two_factor_reset", _("Two-factor authentication reset by admin")
        TWO_FACTOR_RECOVERY_CODE_USED = "two_factor_recovery_code_used", _("Two-factor recovery code used")
```

Add a new model at the end of the file, after `AuditLog` (current line 255):

```python


class TwoFactorRecoveryCode(TimeStampedModel):
    """A single-use recovery code for an account with 2FA enabled — SEC-9
    task 2. Ten are issued at a time, replacing any still-unused ones,
    every time `TwoFactorConfirmSerializer`/`UserViewSet.reset_2fa` (re-)
    activates or resets 2FA for a user — never appended to.

    `code_hash` follows `apps.integrations.keys.hash_api_key`'s plain sha256
    pattern (no slow KDF — the code is already 40 bits from
    `secrets.token_hex`), not `AuditLog`'s "snapshot, never delete" style:
    rows here ARE deleted, on disable/reset/re-enrolment, because a stale
    recovery code for an account whose 2FA secret is no longer active must
    never be checkable again.

    `used_at` (nullable), not a boolean flag — mirrors
    `notifications.Notification.read_at`'s exact shape for the same reason:
    knowing *when* a code was used is free once a timestamp is being stored
    anyway, and "unused" is simply `used_at__isnull=True`.

    `on_delete=CASCADE` on `user` — a recovery code has no meaning without
    the account it recovers, the same reasoning `UserViewSet`'s own
    docstring already gives for `Notification.recipient`/`ApiKey.user`.
    """

    user = models.ForeignKey(
        User,
        verbose_name=_("user"),
        related_name="recovery_codes",
        on_delete=models.CASCADE,
    )
    code_hash = models.CharField(_("code hash"), max_length=64)
    used_at = models.DateTimeField(_("used at"), null=True, blank=True)

    class Meta:
        verbose_name = _("recovery code")
        verbose_name_plural = _("recovery codes")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.user.email} — {'used' if self.used_at else 'unused'}"
```

---

### 5 — Migration

**Create file: `backend/apps/accounts/migrations/0016_two_factor_authentication.py`**

```python
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0015_repair_admin_role_grants"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="mfa_enabled",
            field=models.BooleanField(default=False, verbose_name="two-factor authentication enabled"),
        ),
        migrations.AddField(
            model_name="user",
            name="mfa_secret",
            field=models.CharField(blank=True, max_length=255, verbose_name="two-factor secret"),
        ),
        migrations.AddField(
            model_name="role",
            name="requires_two_factor",
            field=models.BooleanField(default=False, verbose_name="requires two-factor authentication"),
        ),
        migrations.CreateModel(
            name="TwoFactorRecoveryCode",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True, primary_key=True, serialize=False, verbose_name="ID"
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("code_hash", models.CharField(max_length=64, verbose_name="code hash")),
                ("used_at", models.DateTimeField(blank=True, null=True, verbose_name="used at")),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="recovery_codes",
                        to="accounts.user",
                        verbose_name="user",
                    ),
                ),
            ],
            options={
                "verbose_name": "recovery code",
                "verbose_name_plural": "recovery codes",
                "ordering": ("-created_at",),
                "get_latest_by": "created_at",
            },
        ),
        migrations.AlterField(
            model_name="auditlog",
            name="action",
            field=models.CharField(
                choices=[
                    ("user_created", "User created"),
                    ("user_role_changed", "User role changed"),
                    ("user_status_changed", "User status changed"),
                    ("user_deleted", "User deleted"),
                    ("role_created", "Role created"),
                    ("role_renamed", "Role renamed"),
                    ("role_permissions_changed", "Role permissions changed"),
                    ("role_deleted", "Role deleted"),
                    ("portal_access_granted", "Portal access granted"),
                    ("portal_access_revoked", "Portal access revoked"),
                    ("two_factor_enabled", "Two-factor authentication enabled"),
                    ("two_factor_disabled", "Two-factor authentication disabled"),
                    ("two_factor_reset", "Two-factor authentication reset by admin"),
                    ("two_factor_recovery_code_used", "Two-factor recovery code used"),
                ],
                max_length=30,
                verbose_name="action",
            ),
        ),
    ]
```

Run `python manage.py makemigrations --check accounts` at implementation time to confirm this file matches what `makemigrations` itself would generate against the task 4 model changes — adjust field ordering/kwargs to match exactly if Django's generator produces a different (but equivalent) shape.

---

### 6 — Admin registration

**File: `backend/apps/accounts/admin.py`** — update the import line (current line 4):

```python
from .models import AuditLog, Role, TwoFactorRecoveryCode, User
```

Append after `AuditLogAdmin` (current lines 104-137):

```python


@admin.register(TwoFactorRecoveryCode)
class TwoFactorRecoveryCodeAdmin(admin.ModelAdmin):
    """Read-only support visibility — never create or edit a code hash by
    hand. Mirrors `AuditLogAdmin`'s "immutable end to end" shape directly
    above."""

    list_display = ("user", "used_at", "created_at")
    list_filter = ("used_at",)
    search_fields = ("user__email",)
    readonly_fields = ("user", "code_hash", "used_at", "created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False

    def has_change_permission(self, request, obj=None) -> bool:
        return False
```

---

### 7 — Serializers

**File: `backend/apps/accounts/serializers.py`** — update the `.tokens` import (current lines 14-19):

```python
from .tokens import (
    MFA_CHALLENGE_MAX_AGE_SECONDS,
    MFA_CHALLENGE_SALT,
    RESET_SALT,
    RESET_TOKEN_MAX_AGE_SECONDS,
    password_fingerprint,
    read_password_token,
)
```

Update the `.models` import (current line 12):

```python
from .models import AuditLog, Role, TwoFactorRecoveryCode
```

Add `from django.utils import timezone` to the top-of-file imports, and `from . import mfa`.

Update `RoleAdminSerializer.Meta.fields` (current lines 75-84) to add `requires_two_factor` between `permissions` and `is_system`:

```python
        fields = (
            "id",
            "slug",
            "name",
            "description",
            "permissions",
            "requires_two_factor",
            "is_system",
            "created_at",
            "updated_at",
        )
```

No `validate_requires_two_factor` needed — a plain boolean, gated by the same `roles.manage` permission the rest of this serializer's writable fields already require.

Update `UserSerializer` (current lines 115-147, the `/auth/me/` shape) — add one `SerializerMethodField` and extend `Meta`:

```python
class UserSerializer(serializers.ModelSerializer):
    """Deliberately NOT `BaseModelSerializer` — that base exists for
    `TimeStampedModel`'s `created_at`/`updated_at`, which `User` does not
    have. See Story 08 `## Context` item 5.
    """

    role = RoleSerializer(read_only=True)
    department = DepartmentBriefSerializer(read_only=True)
    branch = BranchBriefSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()
    mfa_required = serializers.SerializerMethodField()

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
            "branch",
            "permissions",
            "mfa_enabled",
            "mfa_required",
        )
        read_only_fields = (
            "id",
            "is_staff",
            "role",
            "department",
            "branch",
            "permissions",
            "mfa_enabled",
            "mfa_required",
        )

    def get_permissions(self, user) -> list[str]:
        """The SAME resolution the API enforces with, including the superuser
        bypass — `permissions_for` is the single source. Returning only
        role-derived permissions here would hide controls from a superuser
        that the API would happily allow. See CONVENTIONS.md §22.
        """
        return sorted(permissions_for(user))

    def get_mfa_required(self, user) -> bool:
        """Whether this account's role currently mandates 2FA — SEC-9's
        per-role enforcement. Independent of `mfa_enabled`: a required-but-
        not-yet-enrolled account has this True and `mfa_enabled` False,
        which is exactly the state `RequireAuth` (frontend) redirects on.
        """
        return bool(user.role and user.role.requires_two_factor)
```

`mfa_enabled` needs no explicit field declaration — it is a real `User` model field, so `ModelSerializer` derives it automatically once listed in `fields`/`read_only_fields`, the same way `is_staff` already is.

Update `UserAdminSerializer.Meta.fields` (current lines 189-205) to add `mfa_enabled`, directly after `is_superuser`:

```python
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "mfa_enabled",
            "role",
            "role_name",
            "department",
            "department_name",
            "branch",
            "branch_name",
            "date_joined",
            "last_login",
        )
        read_only_fields = ("id", "is_staff", "is_superuser", "mfa_enabled", "date_joined", "last_login")
```

Append three new serializers directly after `ChangePasswordSerializer` (current lines 341-376), before `AuditLogSerializer`:

```python
class TwoFactorConfirmSerializer(serializers.Serializer):
    """SEC-9's enrolment-confirm step. `validate_code` only reads state —
    the same read-only `validate_*` discipline `ChangePasswordSerializer`
    above follows; `save()` is where `mfa_enabled` flips and recovery codes
    are actually issued, so a wrong code never has any side effect.
    """

    code = serializers.CharField(write_only=True, max_length=10)

    def validate_code(self, value):
        user = self.context["request"].user
        if not user.mfa_secret:
            raise serializers.ValidationError(_("Start enrolment before confirming a code."))
        if not mfa.verify_totp_code(mfa.decrypt_secret(user.mfa_secret), value):
            raise serializers.ValidationError(_("That code is incorrect or has expired."))
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.mfa_enabled = True
        user.save(update_fields=["mfa_enabled"])
        TwoFactorRecoveryCode.objects.filter(user=user).delete()
        codes = mfa.generate_recovery_codes()
        TwoFactorRecoveryCode.objects.bulk_create(
            TwoFactorRecoveryCode(user=user, code_hash=mfa.hash_recovery_code(code)) for code in codes
        )
        return codes


class TwoFactorDisableSerializer(serializers.Serializer):
    """SEC-9's self-service disable step. Requires the caller's current
    password — the same "a valid session alone is not proof of ownership"
    reasoning `ChangePasswordSerializer` documents for itself, applied to a
    toggle at least as sensitive as the password itself.
    """

    current_password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError(_("Current password is incorrect."))
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.mfa_enabled = False
        user.mfa_secret = ""
        user.save(update_fields=["mfa_enabled", "mfa_secret"])
        TwoFactorRecoveryCode.objects.filter(user=user).delete()
        return user


class MfaChallengeSerializer(serializers.Serializer):
    """SEC-9's login-time second step, exchanged for a real token pair once
    the caller proves the second factor. `mfa_token` is signed by
    `MfaAwareTokenObtainPairSerializer.validate` (throttled_token_views.py)
    — the password was already verified once to obtain it, so no
    Authorization header and no password is presented here again, the same
    "the token IS the credential" reasoning `LogoutView`/
    `PasswordResetConfirmView` already establish for their own signed
    tokens.

    Tries a TOTP code first, then falls back to an unused recovery code.
    `attrs['recovery_code']` carries the matched row through to `save()` —
    the view reads it back from `validated_data` afterward to decide
    whether to write a `TWO_FACTOR_RECOVERY_CODE_USED` audit row, following
    this codebase's "AuditLog is written in views.py, never inside a
    serializer" convention (see every `AuditLog.objects.create(...)` call
    site in `views.py`).
    """

    mfa_token = serializers.CharField(write_only=True)
    code = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user_id = read_password_token(
            attrs["mfa_token"], salt=MFA_CHALLENGE_SALT, max_age=MFA_CHALLENGE_MAX_AGE_SECONDS
        )
        user = (
            User.objects.filter(pk=user_id, is_active=True, mfa_enabled=True).first()
            if user_id
            else None
        )
        if user is None:
            raise serializers.ValidationError(
                {"mfa_token": [_("This sign-in attempt has expired. Please sign in again.")]}
            )
        code = attrs["code"]
        if mfa.verify_totp_code(mfa.decrypt_secret(user.mfa_secret), code):
            attrs["user"] = user
            attrs["recovery_code"] = None
            return attrs
        recovery_code = next(
            (
                row
                for row in TwoFactorRecoveryCode.objects.filter(user=user, used_at__isnull=True)
                if mfa.recovery_code_matches(row.code_hash, code)
            ),
            None,
        )
        if recovery_code is None:
            raise serializers.ValidationError({"code": [_("That code is incorrect or has expired.")]})
        attrs["user"] = user
        attrs["recovery_code"] = recovery_code
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        recovery_code = self.validated_data["recovery_code"]
        if recovery_code is not None:
            recovery_code.used_at = timezone.now()
            recovery_code.save(update_fields=["used_at"])
        return user
```

---

### 8 — `MfaAwareTokenObtainPairSerializer`

**File: `backend/apps/accounts/throttled_token_views.py`** — replace the file in full:

```python
"""Throttled subclasses of simplejwt's token views. PROD-3 (Story 92) added
throttling; SEC-9 (Story 107) adds `MfaAwareTokenObtainPairSerializer`, the
first customisation of the response shape.

`CONVENTIONS.md` § 21 recorded that "the stock simplejwt views need no
subclassing" for the response shape, which `EnvelopeJSONRenderer` applies
from the outside — that remains true; this serializer changes what data
gets put INTO the envelope, not how the envelope itself is built.
"""

from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenObtainSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.tokens import MFA_CHALLENGE_SALT, make_password_token
from apps.core.throttling import FailOpenScopedRateThrottle


class MfaAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """SEC-9's 2FA branch on AUTH-1's existing token-obtain serializer — the
    intake's own "extend AUTH-1's existing token views — do not build a
    second auth flow" constraint, applied literally.

    Calls `TokenObtainSerializer.validate` directly (the grandparent, not
    `super()`) to authenticate exactly once and populate `self.user`,
    without also minting a token pair — `TokenObtainPairSerializer.validate`
    (what `super().validate()` would call) does both in one method, and a
    2FA-enabled account must not receive a real token pair at all until the
    second factor is verified.
    """

    def validate(self, attrs):
        TokenObtainSerializer.validate(self, attrs)
        if self.user.mfa_enabled:
            return {
                "mfa_required": True,
                "mfa_token": make_password_token(self.user.id, salt=MFA_CHALLENGE_SALT),
            }
        # No 2FA — the same tail `TokenObtainPairSerializer.validate` runs,
        # copied rather than reached via `super()`, which would re-run
        # `TokenObtainSerializer.validate` (and re-check the password) a
        # second time.
        refresh = self.get_token(self.user)
        data = {"refresh": str(refresh), "access": str(refresh.access_token)}
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, self.user)
        return data


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """`POST /api/auth/token/` — the login endpoint."""

    serializer_class = MfaAwareTokenObtainPairSerializer
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"


class ThrottledTokenRefreshView(TokenRefreshView):
    """`POST /api/auth/token/refresh/` — also the rotation/blacklist path."""

    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"
```

---

### 9 — Views: self-service enrol/confirm/disable + the MFA verify endpoint

**File: `backend/apps/accounts/views.py`** — extend the `from .serializers import (...)` block (current lines 22-32) to add, alphabetically:

```python
from .serializers import (
    AuditLogSerializer,
    ChangePasswordSerializer,
    InviteConfirmSerializer,
    LogoutSerializer,
    MfaChallengeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RoleAdminSerializer,
    TwoFactorConfirmSerializer,
    TwoFactorDisableSerializer,
    UserAdminSerializer,
    UserSerializer,
)
```

Add `from . import mfa` and `from .models import AuditLog, Role, TwoFactorRecoveryCode` (extending the current `from .models import AuditLog, Role`, line 21). Add `from rest_framework.decorators import action` to the top-of-file imports (not currently imported — `UserViewSet` has no custom `@action` today).

Insert four new views directly after `ChangePasswordView` (current lines 169-195), before `MeView`:

```python
@extend_schema(
    request=MfaChallengeSerializer,
    responses={200: None},
    summary="Exchange a 2FA challenge and code for a real token pair",
)
class MfaVerifyView(APIView):
    """SEC-9's login-time second step. No `Authorization` header — the
    caller has no access token yet; `mfa_token` (signed by
    `MfaAwareTokenObtainPairSerializer`) is the credential that proves the
    password was already checked once, the same reasoning `LogoutView`
    above documents for its own no-Authorization-header shape.

    Throttled the same as every other credential-guessing surface in this
    file: a bare 6-digit TOTP code is far more guessable than a password.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"

    def post(self, request):
        serializer = MfaChallengeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        if serializer.validated_data["recovery_code"] is not None:
            AuditLog.objects.create(
                actor=user,
                action=AuditLog.Action.TWO_FACTOR_RECOVERY_CODE_USED,
                target_user=user,
                target_label=user.get_full_name(),
            )
        refresh = RefreshToken.for_user(user)
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, user)
        return Response({"access": str(refresh.access_token), "refresh": str(refresh)})


@extend_schema(
    request=None,
    responses={200: None},
    summary="Begin 2FA enrolment: generate a pending TOTP secret",
)
class TwoFactorEnrollView(APIView):
    """SEC-9's enrolment step 1. Overwrites any not-yet-confirmed secret on
    every call — a user who abandons enrolment and starts again gets a
    clean slate, never two live pending secrets. Refuses to run once 2FA is
    already active; `TwoFactorDisableView` below is the only way back to a
    re-enrollable state.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"

    def post(self, request):
        user = request.user
        if user.mfa_enabled:
            raise ValidationError(
                {
                    "non_field_errors": [
                        _("Two-factor authentication is already enabled. Disable it before re-enrolling.")
                    ]
                }
            )
        raw_secret = mfa.generate_totp_secret()
        user.mfa_secret = mfa.encrypt_secret(raw_secret)
        user.save(update_fields=["mfa_secret"])
        return Response(
            {"secret": raw_secret, "provisioning_uri": mfa.provisioning_uri(user, raw_secret)},
            status=status.HTTP_200_OK,
        )


@extend_schema(
    request=TwoFactorConfirmSerializer,
    responses={200: None},
    summary="Confirm a 2FA code and activate two-factor authentication",
)
class TwoFactorConfirmView(APIView):
    """SEC-9's enrolment step 2. Returns the plaintext recovery codes
    EXACTLY ONCE — `TwoFactorRecoveryCode.code_hash` is the only place any
    of them are stored, so this response is the caller's only chance to
    see them.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"

    def post(self, request):
        serializer = TwoFactorConfirmSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        recovery_codes = serializer.save()
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.TWO_FACTOR_ENABLED,
            target_user=request.user,
            target_label=request.user.get_full_name(),
        )
        return Response({"recovery_codes": recovery_codes}, status=status.HTTP_200_OK)


@extend_schema(
    request=TwoFactorDisableSerializer,
    responses={200: None},
    summary="Disable two-factor authentication on your own account",
)
class TwoFactorDisableView(APIView):
    """SEC-9's self-service disable. Requires the current password — see
    `TwoFactorDisableSerializer`'s own docstring.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"

    def post(self, request):
        serializer = TwoFactorDisableSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.TWO_FACTOR_DISABLED,
            target_user=request.user,
            target_label=request.user.get_full_name(),
        )
        return Response(None, status=status.HTTP_200_OK)
```

Also add `from rest_framework_simplejwt.settings import api_settings` to the top-of-file imports (needed by `MfaVerifyView`).

---

### 10 — `UserViewSet.reset_2fa`: admin-side recovery

**File: `backend/apps/accounts/views.py`** — add one entry to `UserViewSet.permission_map` (current lines 239-246), directly after `"destroy"`:

```python
    permission_map = {
        "list": Permissions.USERS_VIEW,
        "retrieve": Permissions.USERS_VIEW,
        "create": Permissions.USERS_MANAGE,
        "update": Permissions.USERS_MANAGE,
        "partial_update": Permissions.USERS_MANAGE,
        "destroy": Permissions.USERS_MANAGE,
        # Keyed by the @action's own method name, both HTTP verbs (there is
        # only one here) share it — the exact precedent
        # `CustomerViewSet.permission_map["portal_access"]`
        # (apps/customers/views.py:68) already establishes.
        "reset_2fa": Permissions.USERS_MANAGE,
    }
```

Add the action method directly after `destroy` (current lines 315-343), before the class ends:

```python
    @action(detail=True, methods=["post"], url_path="reset-2fa")
    def reset_2fa(self, request, pk=None):
        """Admin-side account recovery for a user who lost their device —
        SEC-9 task 2. Never reveals the secret (it is simply discarded);
        the user must re-enrol from scratch afterward, the same "no way
        back in except starting over" shape `TwoFactorDisableView` gives
        the user themselves.
        """
        user = self.get_object()
        if not user.mfa_enabled:
            raise ValidationError(
                {"non_field_errors": [_("Two-factor authentication is not enabled for this user.")]}
            )
        user.mfa_enabled = False
        user.mfa_secret = ""
        user.save(update_fields=["mfa_enabled", "mfa_secret"])
        TwoFactorRecoveryCode.objects.filter(user=user).delete()
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.TWO_FACTOR_RESET,
            target_user=user,
            target_label=user.get_full_name(),
        )
        return Response(None, status=status.HTTP_200_OK)
```

Endpoint: `POST /api/users/<id>/reset-2fa/` (the router-generated path from the `@action`'s `url_path`, on the existing `UserViewSet` route).

---

### 11 — Routing

**File: `backend/apps/accounts/urls.py`** — replace the file in full:

```python
from django.urls import path

from .throttled_token_views import (
    ThrottledTokenObtainPairView,
    ThrottledTokenRefreshView,
)
from .views import (
    ChangePasswordView,
    InviteConfirmView,
    LogoutView,
    MeView,
    MfaVerifyView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    TwoFactorConfirmView,
    TwoFactorDisableView,
    TwoFactorEnrollView,
)

app_name = "accounts"

urlpatterns = [
    # PROD-3: the throttled subclasses, at the SAME paths and under the SAME
    # route names — `reverse()` call sites and the frontend both depend on
    # those staying identical. See apps/accounts/throttled_token_views.py.
    path("token/", ThrottledTokenObtainPairView.as_view(), name="token_obtain"),
    path("token/refresh/", ThrottledTokenRefreshView.as_view(), name="token_refresh"),
    # SEC-9: the 2FA challenge exchange, alongside the token endpoints above.
    path("token/verify-mfa/", MfaVerifyView.as_view(), name="token_verify_mfa"),
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
    path("change-password/", ChangePasswordView.as_view(), name="change_password"),
    path("2fa/enroll/", TwoFactorEnrollView.as_view(), name="two_factor_enroll"),
    path("2fa/confirm/", TwoFactorConfirmView.as_view(), name="two_factor_confirm"),
    path("2fa/disable/", TwoFactorDisableView.as_view(), name="two_factor_disable"),
]
```

Endpoints added: `POST /api/auth/token/verify-mfa/`, `POST /api/auth/2fa/enroll/`, `POST /api/auth/2fa/confirm/`, `POST /api/auth/2fa/disable/`, plus `POST /api/users/<id>/reset-2fa/` (task 10).

---

### 12 — `CONVENTIONS.md` § 21 addendum

**File: `CONVENTIONS.md`** — append after the existing last entry in § 21 (ends line 853, before the `---` at line 855). Do **not** renumber § 0-§ 37.

```markdown

**A 2FA challenge reuses the existing signed-token idiom rather than
inventing a session-scoped "pending login" state.**
`MfaAwareTokenObtainPairSerializer` (SEC-9, Story 107) returns
`{mfa_required: true, mfa_token: ...}` instead of a token pair when
`user.mfa_enabled` is true — `mfa_token` is the same
`signing.dumps`/`loads(..., max_age=...)` mechanism `INVITE_SALT`/
`RESET_SALT` already established, under a third salt (`MFA_CHALLENGE_SALT`,
5 minutes). `POST /api/auth/token/verify-mfa/` exchanges it, plus a TOTP or
recovery code, for a real token pair — no Authorization header, the same
"the token IS the credential" reasoning `LogoutView`/`PasswordResetConfirmView`
already document for their own signed tokens. The actual `authenticate()`
password check still only ever happens once, inside
`TokenObtainSerializer.validate` — this is not a second auth flow, it is
the existing one with one more step gated behind it.

**A TOTP secret is the one stored credential in this codebase that must be
decrypted again later, not just checked by comparison — this is why it is
the first to use real encryption at rest.** Every other stored secret
(`EmailProviderConfig.host_password`, `ErpConnection.auth_token`,
`ApiKey.hashed_key`) is either write-only-plaintext or a one-way digest,
because the app never needs the original value back (§36). Verifying a
live TOTP code needs the raw secret every time, so `apps.accounts.mfa`
adds `cryptography`'s `Fernet` — this codebase's first encryption
dependency, declared directly in `requirements.txt` rather than relying on
it being present transitively (it already was, via `channels`/`daphne`'s
websocket stack) — rather than stretching either existing pattern to fit.

**Org-level "require 2FA for this role" is a plain `BooleanField` directly
on `Role`, not a new list on `OrganizationSettings`.** §33 already settled
this shape question twice (ORG-1/ORG-2 promoting `departments`/`branches`
from `JSONField` lists to real models): a fact about one role belongs on
that `Role` row, not in a parallel list keyed by slug on a different
model. `Role.requires_two_factor` is enforced client-side only
(`RequireAuth` redirects an under-enrolled, role-mandated account to
`/preferences`) — a known, deliberate gap, not silently papered over. See
Story 107's `## Edge Cases`.
```

---

## Frontend Tasks

### 10 — Dependency

**File: `frontend/package.json`** — add to `dependencies` (not `devDependencies`), alongside the other runtime UI libraries:

```json
"qrcode.react": "^4.2.0",
```

Verified current release: 4.2.0, peer dependency `react": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0"` (compatible with this project's installed React). Exports `QRCodeSVG`.

---

### 11 — `shared/auth/types.ts`

**File: `frontend/src/shared/auth/types.ts`** — extend `AuthUser` (current lines 21-40), adding two fields after `permissions`:

```ts
  /** Flat, already resolved by the backend — includes the superuser bypass.
   * Never derive permissions from `role` on the client. See CONVENTIONS.md §22. */
  permissions: string[]
  /** Whether this account currently has 2FA active. */
  mfa_enabled: boolean
  /** Whether this account's role currently mandates 2FA — SEC-9's per-role
   * enforcement. Independent of `mfa_enabled`: a required-but-not-yet-
   * enrolled account has this true and `mfa_enabled` false. */
  mfa_required: boolean
}
```

Add a new exported type and extend `AuthContextValue` (current lines 44-51):

```ts
export type LoginResult = { status: 'authenticated' } | { status: 'mfa_required'; mfaToken: string }

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  /** UX only — the backend is the enforcement point (CONVENTIONS.md §12). */
  can: (permission: string) => boolean
  login: (email: string, password: string) => Promise<LoginResult>
  /** Exchanges a 2FA challenge (from `login`'s `mfa_required` result) plus
   * a TOTP or recovery code for a real session. */
  completeMfaChallenge: (mfaToken: string, code: string) => Promise<void>
  /** Re-fetches `/auth/me/` and updates `user` in place — used after
   * enabling/disabling 2FA so the new `mfa_enabled` value is reflected
   * without a full logout/login. */
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
}
```

---

### 12 — `shared/auth/AuthProvider.tsx`

**File: `frontend/src/shared/auth/AuthProvider.tsx`** — replace the file in full:

```tsx
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { api } from '@/shared/lib/api/client'
import { setMonitoringUser } from '@/shared/lib/monitoring'

import { AuthContext } from './AuthContext'
import { hasPermission } from './permissions'
import { refreshAccessToken } from './refresh'
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from './tokenStorage'
import type { AuthStatus, AuthUser, LoginResult } from './types'

type TokenResponse = { access: string; refresh: string } | { mfa_required: true; mfa_token: string }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    let cancelled = false

    async function boot() {
      if (!getRefreshToken()) {
        setStatus('unauthenticated')
        return
      }
      const access = await refreshAccessToken()
      if (cancelled) return
      if (!access) {
        setStatus('unauthenticated')
        return
      }
      try {
        const me = await api.get<AuthUser>('/auth/me/')
        if (cancelled) return
        setUser(me)
        // Id only — never email, name, role, or permissions. CONVENTIONS.md § 10.
        setMonitoringUser(me.id)
        setStatus('authenticated')
      } catch {
        if (cancelled) return
        clearTokens()
        setStatus('unauthenticated')
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const response = await api.post<TokenResponse>('/auth/token/', { email, password })
    if ('mfa_required' in response && response.mfa_required) {
      return { status: 'mfa_required', mfaToken: response.mfa_token }
    }
    setAccessToken(response.access)
    setRefreshToken(response.refresh)
    try {
      const me = await api.get<AuthUser>('/auth/me/')
      setUser(me)
      setMonitoringUser(me.id)
      setStatus('authenticated')
    } catch (error) {
      // Tokens were issued but the profile fetch failed. Do not leave the
      // app in a half-authenticated state with tokens but no user.
      clearTokens()
      setStatus('unauthenticated')
      throw error
    }
    return { status: 'authenticated' }
  }, [])

  const completeMfaChallenge = useCallback(async (mfaToken: string, code: string) => {
    const tokens = await api.post<{ access: string; refresh: string }>('/auth/token/verify-mfa/', {
      mfa_token: mfaToken,
      code,
    })
    setAccessToken(tokens.access)
    setRefreshToken(tokens.refresh)
    try {
      const me = await api.get<AuthUser>('/auth/me/')
      setUser(me)
      setMonitoringUser(me.id)
      setStatus('authenticated')
    } catch (error) {
      clearTokens()
      setStatus('unauthenticated')
      throw error
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const me = await api.get<AuthUser>('/auth/me/')
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    const refresh = getRefreshToken()
    clearTokens()
    setUser(null)
    setMonitoringUser(null)
    setStatus('unauthenticated')
    if (refresh) {
      try {
        await api.post('/auth/logout/', { refresh })
      } catch {
        // Best-effort. The user is logged out client-side regardless — the
        // server-side token still gets cleaned up on its own expiry.
      }
    }
  }, [])

  const can = useCallback((permission: string) => hasPermission(user, permission), [user])

  return (
    <AuthContext.Provider value={{ user, status, can, login, completeMfaChallenge, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

---

### 13 — `shared/auth/RequireAuth.tsx`: the org-enforcement gate

**File: `frontend/src/shared/auth/RequireAuth.tsx`** — replace the file in full:

```tsx
import { Navigate, Outlet, useLocation } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { useAuth } from './useAuth'

/**
 * A layout route with no path: nest protected routes under it in
 * `app/router.tsx`. Renders <Outlet/> only once `status === 'authenticated'`.
 *
 * SEC-9: an account whose role mandates 2FA (`mfa_required`) but has not
 * enrolled yet (`!mfa_enabled`) is redirected to `/preferences` — the one
 * screen that can complete enrolment — instead of any other route. This is
 * a UX-level gate only (CONVENTIONS.md §12); see this story's
 * `## Edge Cases` for the accepted limitation.
 */
export function RequireAuth() {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Loading />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (user?.mfa_required && !user.mfa_enabled && location.pathname !== '/preferences') {
    return <Navigate to="/preferences" replace />
  }
  return <Outlet />
}
```

---

### 14 — `features/auth/api/verifyMfaChallenge.ts`

**Create file: `frontend/src/features/auth/api/verifyMfaChallenge.ts`** — not called directly (the logic lives in `AuthProvider.completeMfaChallenge`); this task is a no-op — **skip creating this file**. `LoginPage.tsx` calls `useAuth().completeMfaChallenge(...)` directly, the same way it already calls `useAuth().login(...)` — no separate API-layer file is needed since the request lives inside `shared/auth`, not a `features/` API module. (Listed here only so the task numbering below stays contiguous with `## Context` item ordering; no file is created.)

---

### 15 — `LoginPage.tsx`: the post-challenge code step

**File: `frontend/src/features/auth/components/LoginPage.tsx`** — replace the file in full:

```tsx
import { useMutation } from '@tanstack/react-query'
import { LogInIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { useState } from 'react'
import * as z from 'zod'

import { useAuth } from '@/shared/auth'
import { BrandMark, getBranding, useBranding } from '@/shared/branding'
import { email, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'

const schema = z.object({
  email: email(),
  password: requiredString(),
})

const mfaSchema = z.object({
  code: requiredString(10),
})

/** The centred mark above the login form. Renders the configured logo when
 * one is set (ORG-3); otherwise the original `LogInIcon` circle, which
 * already tracks `--primary`/`bg-primary` and therefore rebrands itself
 * with no edit of its own the moment a brand colour is set — do not
 * "simplify" this into a static colour. */
function BrandLoginMark() {
  const branding = useBranding().data ?? getBranding()
  if (branding.logo_url !== '') {
    return (
      <div className="flex h-12 items-center justify-center">
        <BrandMark className="h-12 max-w-48" />
      </div>
    )
  }
  return (
    <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
      <LogInIcon className="size-6 text-primary" />
    </div>
  )
}

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { login, completeMfaChallenge } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [mfaToken, setMfaToken] = useState<string | null>(null)
  const [mfaFormErrors, setMfaFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: { email: '', password: '' },
  })
  const mfaForm = useAppForm({
    schema: mfaSchema,
    defaultValues: { code: '' },
  })

  // `/home`, not `/`: Story 86 made `/` the public landing page. A staff
  // member who logged in from the landing page's CTA has no `from` state and
  // must land on the dashboard, not back where they started.
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/home'

  const mutation = useMutation({
    mutationFn: (values: z.output<typeof schema>) => login(values.email, values.password),
    onSuccess: (result) => {
      if (result.status === 'mfa_required') {
        setMfaToken(result.mfaToken)
      } else {
        navigate(from, { replace: true })
      }
    },
    onError: (error) => {
      if (isValidationError(error)) {
        setFormErrors(applyServerErrors(form, error))
      }
      // A wrong-credentials failure (code: authentication_failed) sets no
      // field errors — the global toast in AppProviders already shows the
      // translated message. See CONVENTIONS.md §21.
    },
  })

  const mfaMutation = useMutation({
    mutationFn: (values: z.output<typeof mfaSchema>) => completeMfaChallenge(mfaToken ?? '', values.code),
    onSuccess: () => navigate(from, { replace: true }),
    onError: (error) => {
      if (isValidationError(error)) {
        setMfaFormErrors(applyServerErrors(mfaForm, error))
      }
    },
  })

  if (mfaToken !== null) {
    return (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <BrandLoginMark />
          <h1 className="text-2xl font-semibold tracking-tight">{t('mfaChallenge.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('mfaChallenge.subtitle')}</p>
        </div>
        <Card>
          <CardContent>
            <Form {...mfaForm}>
              <form
                onSubmit={mfaForm.handleSubmit((values) => mfaMutation.mutate(values))}
                className="flex flex-col gap-4"
              >
                <TextField
                  control={mfaForm.control}
                  name="code"
                  label={t('mfaChallenge.code')}
                  autoComplete="one-time-code"
                  autoFocus
                />
                <FormErrorSummary errors={mfaFormErrors} />
                <SubmitButton pending={mfaMutation.isPending} size="lg" className="w-full">
                  {t('mfaChallenge.submit')}
                </SubmitButton>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <BrandLoginMark />
        <h1 className="text-2xl font-semibold tracking-tight">{t('login.title')}</h1>
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
                label={t('login.email')}
                type="email"
                autoComplete="email"
                autoFocus
              />
              <TextField
                control={form.control}
                name="password"
                label={t('login.password')}
                type="password"
                autoComplete="current-password"
              />
              <div className="text-end">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary-text underline-offset-4 hover:underline"
                >
                  {t('login.forgotPassword')}
                </Link>
              </div>
              <FormErrorSummary errors={formErrors} />
              <SubmitButton pending={mutation.isPending} size="lg" className="w-full">
                {t('login.submit')}
              </SubmitButton>
            </form>
          </Form>
        </CardContent>
      </Card>
      <div className="flex flex-col items-center gap-1 text-center text-sm text-muted-foreground">
        <span>{t('help.prompt')}</span>
        <div className="flex items-center gap-3">
          <Link
            to="/contact"
            className="font-medium text-primary-text underline-offset-4 hover:underline"
          >
            {t('help.contact')}
          </Link>
          <Link
            to="/chat"
            className="font-medium text-primary-text underline-offset-4 hover:underline"
          >
            {t('help.chat')}
          </Link>
        </div>
      </div>
    </div>
  )
}
```

`mfaToken !== null` is the entire step switch — there is no back button to the email/password step; a wrong or expired `mfa_token` (5-minute window) surfaces as a field error on submit (`fields.mfa_token`), and the user reloads `/login` to start over, the same recovery path an expired invite/reset link already has.

---

### 16 — `TwoFactorSection.tsx` and its API layer

**Create file: `frontend/src/features/auth/api/enrollTwoFactor.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export type EnrollTwoFactorResponse = { secret: string; provisioning_uri: string }

export function enrollTwoFactor(): Promise<EnrollTwoFactorResponse> {
  return api.post<EnrollTwoFactorResponse>('/auth/2fa/enroll/', {})
}
```

**Create file: `frontend/src/features/auth/api/confirmTwoFactor.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export type ConfirmTwoFactorInput = { code: string }
export type ConfirmTwoFactorResponse = { recovery_codes: string[] }

export function confirmTwoFactor(input: ConfirmTwoFactorInput): Promise<ConfirmTwoFactorResponse> {
  return api.post<ConfirmTwoFactorResponse>('/auth/2fa/confirm/', input)
}
```

**Create file: `frontend/src/features/auth/api/disableTwoFactor.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export type DisableTwoFactorInput = { current_password: string }

export function disableTwoFactor(input: DisableTwoFactorInput): Promise<void> {
  return api.post<void>('/auth/2fa/disable/', input)
}
```

**Create file: `frontend/src/features/auth/components/TwoFactorSection.tsx`**

```tsx
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { useAuth } from '@/shared/auth'
import { requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import { FormErrorSummary, SubmitButton, TextField, useAppForm } from '@/shared/ui/form'
import { useToast } from '@/shared/ui/toast/useToast'

import { confirmTwoFactor } from '../api/confirmTwoFactor'
import { disableTwoFactor } from '../api/disableTwoFactor'
import { enrollTwoFactor } from '../api/enrollTwoFactor'
import type { EnrollTwoFactorResponse } from '../api/enrollTwoFactor'

const confirmSchema = z.object({ code: requiredString(10) })
const disableSchema = z.object({ current_password: requiredString(128) })

/** Three states: not enrolled, mid-enrolment (QR shown, awaiting
 * confirmation), enabled. Recovery codes are shown exactly once, right
 * after a successful confirm — there is no later screen that can retrieve
 * them, matching `TwoFactorConfirmView`'s own backend guarantee. */
export function TwoFactorSection() {
  const { t } = useTranslation('auth')
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [pending, setPending] = useState<EnrollTwoFactorResponse | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [confirmErrors, setConfirmErrors] = useState<string[]>([])
  const [disableErrors, setDisableErrors] = useState<string[]>([])
  const [disabling, setDisabling] = useState(false)

  const confirmForm = useAppForm({ schema: confirmSchema, defaultValues: { code: '' } })
  const disableForm = useAppForm({ schema: disableSchema, defaultValues: { current_password: '' } })

  const enrollMutation = useMutation({
    mutationFn: enrollTwoFactor,
    onSuccess: (data) => setPending(data),
  })

  const confirmMutation = useMutation({
    mutationFn: (values: z.output<typeof confirmSchema>) => confirmTwoFactor(values),
    onSuccess: async (data) => {
      setRecoveryCodes(data.recovery_codes)
      setPending(null)
      confirmForm.reset()
      setConfirmErrors([])
      await refreshUser()
    },
    onError: (error) => {
      if (isValidationError(error)) {
        setConfirmErrors(applyServerErrors(confirmForm, error))
      }
    },
  })

  const disableMutation = useMutation({
    mutationFn: (values: z.output<typeof disableSchema>) => disableTwoFactor(values),
    onSuccess: async () => {
      toast({ tone: 'success', message: t('twoFactor.disabled') })
      setDisabling(false)
      disableForm.reset()
      setDisableErrors([])
      await refreshUser()
    },
    onError: (error) => {
      if (isValidationError(error)) {
        setDisableErrors(applyServerErrors(disableForm, error))
      }
    },
  })

  if (recoveryCodes !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('twoFactor.recoveryCodesTitle')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('twoFactor.recoveryCodesHint')}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <Button type="button" onClick={() => setRecoveryCodes(null)}>
            {t('twoFactor.doneButton')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (user?.mfa_enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('twoFactor.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">{t('twoFactor.enabledLabel')}</p>
          {disabling ? (
            <Form {...disableForm}>
              <form
                onSubmit={disableForm.handleSubmit((values) => disableMutation.mutate(values))}
                className="flex flex-col gap-4"
              >
                <p className="text-sm text-muted-foreground">
                  {t('twoFactor.disableConfirmDescription')}
                </p>
                <TextField
                  control={disableForm.control}
                  name="current_password"
                  label={t('twoFactor.currentPassword')}
                  type="password"
                  autoComplete="current-password"
                />
                <FormErrorSummary errors={disableErrors} />
                <div className="flex gap-2">
                  <SubmitButton pending={disableMutation.isPending} variant="destructive">
                    {t('twoFactor.disableButton')}
                  </SubmitButton>
                  <Button type="button" variant="outline" onClick={() => setDisabling(false)}>
                    {t('actions.cancel', { ns: 'common' })}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <Button type="button" variant="outline" onClick={() => setDisabling(true)}>
              {t('twoFactor.disableButton')}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  if (pending !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle asChild>
            <h2>{t('twoFactor.title')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('twoFactor.scanQr')}</p>
          <QRCodeSVG value={pending.provisioning_uri} className="h-40 w-40" />
          <p className="text-sm text-muted-foreground">{t('twoFactor.manualEntryHint')}</p>
          <code className="font-mono text-sm">{pending.secret}</code>
          <Form {...confirmForm}>
            <form
              onSubmit={confirmForm.handleSubmit((values) => confirmMutation.mutate(values))}
              className="flex flex-col gap-4"
            >
              <TextField
                control={confirmForm.control}
                name="code"
                label={t('twoFactor.codeLabel')}
                autoComplete="one-time-code"
                autoFocus
              />
              <FormErrorSummary errors={confirmErrors} />
              <SubmitButton pending={confirmMutation.isPending}>{t('twoFactor.confirmButton')}</SubmitButton>
            </form>
          </Form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t('twoFactor.title')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('twoFactor.disabledDescription')}</p>
        <Button type="button" onClick={() => enrollMutation.mutate()} disabled={enrollMutation.isPending}>
          {t('twoFactor.enableButton')}
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

### 17 — Wire into `PreferencesPage.tsx`

**File: `frontend/src/app/PreferencesPage.tsx`** — add one import and one sibling element after `<ChangePasswordSection />` (current line 37):

```tsx
import { ChangePasswordSection } from '@/features/auth/components/ChangePasswordSection'
import { TwoFactorSection } from '@/features/auth/components/TwoFactorSection'
```

```tsx
      <ChangePasswordSection />
      <TwoFactorSection />
    </div>
  )
}
```

---

### 18 — Locale changes: `auth`

**File: `frontend/src/features/auth/locales/en.json`** — add two new top-level objects, after `changePassword` (current lines 45-51):

```json
  "mfaChallenge": {
    "title": "Enter your verification code",
    "subtitle": "Open your authenticator app and enter the 6-digit code, or use a recovery code.",
    "code": "Verification code",
    "submit": "Verify"
  },
  "twoFactor": {
    "title": "Two-factor authentication",
    "disabledDescription": "Add an extra layer of security to your account.",
    "enableButton": "Enable two-factor authentication",
    "scanQr": "Scan this QR code with your authenticator app.",
    "manualEntryHint": "Or enter this code manually:",
    "codeLabel": "Verification code",
    "confirmButton": "Verify and enable",
    "recoveryCodesTitle": "Save your recovery codes",
    "recoveryCodesHint": "Each code can be used once if you lose access to your authenticator app. Store them somewhere safe — they will not be shown again.",
    "doneButton": "Done",
    "enabledLabel": "Two-factor authentication is enabled.",
    "disableButton": "Disable",
    "disableConfirmDescription": "Enter your current password to confirm.",
    "currentPassword": "Current password",
    "disabled": "Two-factor authentication disabled."
  }
```

**File: `frontend/src/features/auth/locales/ar.json`** — the identical structural change:

```json
  "mfaChallenge": {
    "title": "أدخل رمز التحقق",
    "subtitle": "افتح تطبيق المصادقة وأدخل الرمز المكوّن من 6 أرقام، أو استخدم رمز استرداد.",
    "code": "رمز التحقق",
    "submit": "تحقق"
  },
  "twoFactor": {
    "title": "المصادقة الثنائية",
    "disabledDescription": "أضف طبقة حماية إضافية لحسابك.",
    "enableButton": "تفعيل المصادقة الثنائية",
    "scanQr": "امسح رمز QR هذا باستخدام تطبيق المصادقة.",
    "manualEntryHint": "أو أدخل هذا الرمز يدويًا:",
    "codeLabel": "رمز التحقق",
    "confirmButton": "تحقق وفعّل",
    "recoveryCodesTitle": "احفظ رموز الاسترداد الخاصة بك",
    "recoveryCodesHint": "يمكن استخدام كل رمز مرة واحدة إذا فقدت الوصول إلى تطبيق المصادقة. احتفظ بها في مكان آمن — لن تظهر مرة أخرى.",
    "doneButton": "تم",
    "enabledLabel": "المصادقة الثنائية مفعّلة.",
    "disableButton": "تعطيل",
    "disableConfirmDescription": "أدخل كلمة المرور الحالية للتأكيد.",
    "currentPassword": "كلمة المرور الحالية",
    "disabled": "تم تعطيل المصادقة الثنائية."
  }
```

---

### 19 — `RoleFormPage.tsx` + `types/role.ts`: per-role enforcement

**File: `frontend/src/features/accounts/types/role.ts`** — add `requires_two_factor: boolean` to both types:

```ts
/** Mirrors `apps.accounts.serializers.RoleAdminSerializer` verbatim. */
export type Role = {
  id: number
  slug: string
  name: string
  description: string
  permissions: string[]
  requires_two_factor: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

/** The write shape. `is_system` is server-managed; `permissions` is
 * writable here as of SEC-2 (Story 49); `requires_two_factor` as of SEC-9
 * (Story 107). */
export type RoleInput = {
  slug: string
  name: string
  description: string
  permissions: string[]
  requires_two_factor: boolean
}
```

**File: `frontend/src/features/accounts/components/RoleFormPage.tsx`** — add `SwitchField` to the import list (current line 19):

```ts
import { FormErrorSummary, SubmitButton, SwitchField, TextField, useAppForm } from '@/shared/ui/form'
```

Extend `schema` (current lines 32-42):

```ts
const schema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[-a-zA-Z0-9_]+$/),
  name: requiredString(100),
  description: optionalString(255),
  permissions: z.array(z.string()),
  requires_two_factor: z.boolean(),
})
```

Extend `EMPTY_DEFAULTS`, `toDefaults`, and `toRoleInput` (current lines 46-64):

```ts
const EMPTY_DEFAULTS: FormValues = {
  slug: '',
  name: '',
  description: undefined,
  permissions: [],
  requires_two_factor: false,
}

function toDefaults(role: Role): FormValues {
  return {
    slug: role.slug,
    name: role.name,
    description: role.description || undefined,
    permissions: role.permissions,
    requires_two_factor: role.requires_two_factor,
  }
}

function toRoleInput(values: FormValues): RoleInput {
  return {
    slug: values.slug,
    name: values.name,
    description: values.description ?? '',
    permissions: values.permissions,
    requires_two_factor: values.requires_two_factor,
  }
}
```

Add one `SwitchField` inside the first `<Card>` (current lines 168-183), after the `description` `TextField`:

```tsx
                <TextField
                  control={form.control}
                  name="description"
                  label={t('roles.fields.description')}
                />
                <SwitchField
                  control={form.control}
                  name="requires_two_factor"
                  label={t('roles.fields.requiresTwoFactor')}
                  description={t('roles.requiresTwoFactorHint')}
                />
```

---

### 20 — Admin reset action on `UserFormPage.tsx`

**File: `frontend/src/features/accounts/types/user.ts`** — add `mfa_enabled: boolean` to `AdminUser` (current lines 1-18), after `is_superuser`:

```ts
export type AdminUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  mfa_enabled: boolean
  role: number | null
  role_name: string | null
  department: number | null
  department_name: string | null
  branch: number | null
  branch_name: string | null
  date_joined: string
  last_login: string | null
}
```

**Create file: `frontend/src/features/accounts/api/resetTwoFactor.ts`**

```ts
import { api } from '@/shared/lib/api/client'

export function resetTwoFactor(id: number): Promise<void> {
  return api.post<void>(`/users/${id}/reset-2fa/`, {})
}
```

**File: `frontend/src/features/accounts/api/useUserMutations.ts`** — add one more mutation hook, after `useDeleteUser` (current lines 33-39):

```ts
import { resetTwoFactor } from './resetTwoFactor'
```

```ts
export function useResetTwoFactor() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (id: number) => resetTwoFactor(id),
    onSuccess: invalidate,
  })
}
```

**File: `frontend/src/features/accounts/components/UserFormPage.tsx`** — add `useConfirm`/`useToast`/`useResetTwoFactor` to the imports, and render a small "Security" card inside `UserEditForm` (current lines 227-330), after the closing `</Card>` of the main form fields (current line 328), before `<FormErrorSummary errors={formErrors} />`:

```tsx
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { useToast } from '@/shared/ui/toast/useToast'
```

```ts
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const resetTwoFactorMutation = useResetTwoFactor()

  async function handleResetTwoFactor() {
    const confirmed = await confirm({
      title: t('users.twoFactor.resetConfirmTitle'),
      description: t('users.twoFactor.resetConfirmDescription', { email: user.email }),
      destructive: true,
    })
    if (!confirmed) return
    await resetTwoFactorMutation.mutateAsync(id)
    toast({ tone: 'success', message: t('users.twoFactor.resetSuccess') })
  }
```

```tsx
            </Card>
            {user.mfa_enabled ? (
              <Card>
                <CardContent className="flex items-center justify-between gap-4">
                  <span className="text-sm">{t('users.twoFactor.enabledLabel')}</span>
                  <Button type="button" variant="outline" onClick={handleResetTwoFactor}>
                    {t('users.twoFactor.reset')}
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            <FormErrorSummary errors={formErrors} />
```

---

### 21 — Locale changes: `accounts`

**File: `frontend/src/features/accounts/locales/en.json`** — add to `roles.fields` (current lines 83-89), and one new top-level key after `roles.permissionsHint` (current line 47):

```json
    "permissionsHint": "Changes take effect immediately for anyone holding this role.",
    "requiresTwoFactorHint": "Users holding this role are prompted to set up two-factor authentication the next time they sign in.",
```

```json
    "fields": {
      "name": "Name",
      "slug": "Slug",
      "description": "Description",
      "permissions": "Permissions",
      "requiresTwoFactor": "Require two-factor authentication",
      "actions": "Actions"
    },
```

Add a new `users.twoFactor` object to the `users` block (current lines 2-35), after `delete`:

```json
    "twoFactor": {
      "enabledLabel": "Two-factor authentication is enabled for this user.",
      "reset": "Reset 2FA",
      "resetConfirmTitle": "Reset two-factor authentication?",
      "resetConfirmDescription": "This disables 2FA for {{email}} and removes their recovery codes. They will need to set it up again.",
      "resetSuccess": "Two-factor authentication has been reset."
    },
```

**File: `frontend/src/features/accounts/locales/ar.json`** — the identical structural change (mirror every key above; exact Arabic wording is the executor's judgment call, following this file's existing tone).

---

## Edge Cases & Failure Modes

- **A wrong password on `/api/auth/token/` for a 2FA-enabled account never reaches the 2FA branch at all.** `TokenObtainSerializer.validate` raises `AuthenticationFailed` before `MfaAwareTokenObtainPairSerializer.validate` ever checks `self.user.mfa_enabled` — a bad password is indistinguishable from a bad password on a non-2FA account, which is the correct behaviour (no account-has-2FA oracle from the login endpoint).
- **An expired or tampered `mfa_token` is a clean field error on `mfa_token`, not a 500.** `read_password_token` returns `None` on any `signing.BadSignature` (including expiry, per `tokens.py`'s own `read_password_token` docstring); `MfaChallengeSerializer.validate` turns a `None` result into a `validation_error`.
- **A wrong TOTP code AND no matching recovery code is a field error on `code`, not on `mfa_token`** — distinguishes "your challenge session is fine, but that code was wrong" from "start over," which matters for the frontend's error placement (`applyServerErrors` attaches to the `code` field, leaving the challenge step on-screen for another attempt).
- **A recovery code is checked byte-for-byte against every unused row for that user, not looked up by a hash index.** `TwoFactorRecoveryCode.code_hash` has no unique constraint and there is no direct hash-to-row lookup — `MfaChallengeSerializer.validate` iterates the (small, ≤10) unused set with `hmac.compare_digest`. Fine at this scale; would need revisiting if the per-user code count ever grew by orders of magnitude, which nothing in this story does.
- **Confirming a bad TOTP code during enrolment has zero side effects.** `TwoFactorConfirmSerializer.validate_code` only reads (`mfa.verify_totp_code`); `mfa_enabled` and the recovery codes are only touched inside `save()`, which DRF never calls when `is_valid()` fails.
- **Re-running `POST /api/auth/2fa/enroll/` while already enrolled (`mfa_enabled=True`) is refused with a clear `non_field_errors` message**, not a silent secret rotation that would desynchronize an already-configured authenticator app. Re-running it while a PRIOR unconfirmed secret exists (never confirmed) is allowed and silently replaces that secret — an abandoned enrolment leaves no dangling state to clean up first.
- **Disabling 2FA (self-service or admin reset) always deletes every recovery code for that user, confirmed or not**, so a stale code from a since-superseded enrolment can never be replayed against a fresh one.
- **`MFA_ENCRYPTION_KEY` changing between when a secret was encrypted and when it is next decrypted raises `cryptography.fernet.InvalidToken`.** Neither `TwoFactorConfirmSerializer.validate_code` nor `MfaChallengeSerializer.validate` catches this specially — it propagates as an unhandled 500 today. This is an accepted, narrow operational risk (rotating `MFA_ENCRYPTION_KEY` in a live deployment with existing enrolled users is out of scope, per `## Story Goal`'s own scope line) rather than a silently-swallowed failure mode; if this ever needs hardening, the fix is a `try/except InvalidToken` in both call sites turning it into "no working secret" (the same message `TwoFactorConfirmSerializer.validate_code` already gives for an empty `mfa_secret`), not a new mechanism.
- **A recovery-code-based login is fully equivalent to a TOTP-based one except for which `AuditLog.Action` gets written.** `MfaVerifyView` mints the same token pair either way; the recovery-code path additionally writes `TWO_FACTOR_RECOVERY_CODE_USED`.
- **An account with `Role.requires_two_factor=True` that has never enrolled can still authenticate fully at `/api/auth/token/` and receive real tokens** — see `## Story Goal`'s own finding. `RequireAuth` redirects every route except `/preferences` to force enrolment, but this is a client-side gate only; a still-valid access token obtained in that window can call any other endpoint directly. Recorded here deliberately, not silently engineered around — see `## Story Goal`.
- **A role's `requires_two_factor` flag changing does not retroactively affect an already-issued access token's current request**, the same "no server-side permission cache, next `/auth/me/` fetch picks it up" constraint `CONVENTIONS.md` §22 already documents for a permission-set change — this story does not add a new mechanism to fix that general gap, only reuses the existing `refreshUser()`/next-boot-fetch behaviour.
- **`current_password`/`code`/`mfa_token`/recovery codes never appear in a log line or an error `message`.** `current_password` and `code` are `write_only`; recovery codes are returned to the caller exactly once in the `2fa/confirm/` response body (never logged) and stored only as `code_hash` from that point on.
- **A portal customer account is unaffected regardless of any staff role's `requires_two_factor` value** — the seeded `customer` role (`apps/accounts/migrations/0004_seed_customer_role.py`) is never edited through `RoleFormPage.tsx` (that screen's route is gated behind `roles.manage`, a staff-only permission a portal customer never holds), and nothing in this story adds a 2FA check to the portal login path.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` §16; verified live this session — `apps/accounts/tests/` does not exist). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `python manage.py check` and `python manage.py makemigrations --check accounts` (confirms task 5's migration matches the model state with no drift) from `backend/` with the venv active.
2. `python manage.py test` — the existing suite must still pass (no accounts-app tests exist to add to; this confirms nothing elsewhere regressed).
3. `ruff format --check .` / `ruff check .` on every changed/new Python file (`models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `throttled_token_views.py`, `tokens.py`, `mfa.py`, `migrations/0016_two_factor_authentication.py`, `config/settings/base.py`).
4. `npm run build` — typechecks every new/changed TSX/TS file and every new `t('auth:twoFactor...')`/`t('auth:mfaChallenge...')`/`t('accounts:...')` key.
5. `npm run lint` / `npm run format:check` / `npm run check:rtl`.
6. The `en`/`ar` key-set comparison script (Story 10's own tool), run against `frontend/src/features/auth/locales/{en,ar}.json` and `frontend/src/features/accounts/locales/{en,ar}.json`.
7. Real HTTP + real browser walkthroughs — Verification Steps 4-13 below.

---

## Migration / Rollback

**Schema migration:** `apps/accounts/migrations/0016_two_factor_authentication.py` (task 5) — additive only (two `AddField`s with `default=False`/blank-safe defaults, one `CreateModel`, one metadata-only `AlterField` widening `AuditLog.Action`'s choices). Safe to apply against a populated `accounts_user` table with no data migration needed — every existing row gets `mfa_enabled=False`, `mfa_secret=""`.

**Rollback of the code:** revert the commits. `pip install -r requirements.txt` / `npm install` again to remove `cryptography`/`pyotp`/`qrcode.react` from the active environment if desired (none of the rest of the codebase depends on any of the three, so removing them is safe).

**Rollback of the migration:** `python manage.py migrate accounts 0015_repair_admin_role_grants` — drops `TwoFactorRecoveryCode`'s table and the three added columns. Safe as long as no account has actually enrolled in 2FA yet in that environment; if any has, rolling back the migration while `MfaAwareTokenObtainPairSerializer` (code) is still live would break login for that account the moment the column disappears — always roll back the CODE (revert to the stock `TokenObtainPairSerializer`, i.e. remove the `serializer_class` override) before rolling back the SCHEMA, never the other order.

**Half-applied states to avoid:**

- **Task 8 (`throttled_token_views.py`'s `serializer_class`) before task 4/5 (the `User.mfa_enabled`/`mfa_secret` fields and their migration)** → `AttributeError: 'User' object has no attribute 'mfa_enabled'` on every single login attempt, a total outage of the login endpoint. Ship the migration first, or in the same deploy.
- **Task 9 (views reference `TwoFactorConfirmSerializer`/`MfaChallengeSerializer`) before task 7 (`serializers.py`)** → `ImportError` at Django startup.
- **Task 11 (`urls.py`) before task 9 (`views.py`)** → `ImportError` at Django startup (`urls.py` imports the new views, which would not yet exist).
- **Task 17 (`PreferencesPage.tsx` imports `TwoFactorSection`) before task 16 (`TwoFactorSection.tsx` exists)** → the import fails, `tsc -b` fails.
- **Task 16 before task 18 (locale keys)** → every new `t('auth:twoFactor...')`/`t('auth:mfaChallenge...')` call fails `tsc -b`, the same failure mode `CONVENTIONS.md` §23 already documents for a components-before-locales ordering.
- **Task 19 (`RoleFormPage.tsx`'s new `requires_two_factor` field) before task 7 (`RoleAdminSerializer` gains the field)** → submitting the form sends a field the backend serializer silently ignores (not in `fields`), so the toggle appears to save but never persists. Ship together.

---

## Verification Steps

1. **Backend checks and formats clean:** from `backend/` with the venv active — `pip install -r requirements.txt`, `python manage.py check`, `python manage.py makemigrations --check accounts`, `ruff format --check .`, `ruff check .`.
2. **Backend regression:** `python manage.py test` — the existing suite still passes.
3. **`en`/`ar` key sets match** for `features/auth/locales` and `features/accounts/locales` (`## Test Plan` item 6).
4. **Enrolment end to end via curl**, signed in as a real user (`$token` = a real access token from `/api/auth/token/`):

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/2fa/enroll/ -H "Authorization: Bearer $token"
   ```

   Expect `200`, a `secret` and a `provisioning_uri` starting `otpauth://totp/`. Compute the current code from `secret` (e.g. via `python -c "import pyotp; print(pyotp.TOTP('<secret>').now())"`) and confirm:

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/2fa/confirm/ -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d '{\"code\":\"<computed code>\"}'
   ```

   Expect `200` with `recovery_codes` (10 strings). Confirm `GET /api/auth/me/` now shows `mfa_enabled: true`.
5. **A wrong code at confirm is rejected with zero side effects.** Repeat enroll, then confirm with an obviously wrong 6-digit code → `400 validation_error`, `fields.code`. Confirm `/api/auth/me/` still shows `mfa_enabled: false`.
6. **Login now returns a challenge, not tokens, for the enrolled account.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/ -H "Content-Type: application/json" -d '{\"email\":\"<enrolled user email>\",\"password\":\"<their password>\"}'
   ```

   Expect `200` with `mfa_required: true` and an `mfa_token` — no `access`/`refresh` in the body.
7. **The challenge exchanges for real tokens with a valid TOTP code, and fails with an invalid one.**

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/verify-mfa/ -H "Content-Type: application/json" -d '{\"mfa_token\":\"<from step 6>\",\"code\":\"<current computed code>\"}'
   ```

   Expect `200`, a real `access`/`refresh` pair. Repeat step 6 to get a fresh `mfa_token`, then retry with a wrong code → `400 validation_error`, `fields.code`.
8. **A recovery code signs in once, then stops working.** Using one of the 10 codes from step 4 in place of a TOTP code at `/api/auth/token/verify-mfa/` → `200`, real tokens. Repeat the exact same request with the same recovery code → `400 validation_error`, `fields.code` (already consumed). Confirm one `AuditLog` row with `action=two_factor_recovery_code_used` exists (`GET /api/audit-log/` as an `audit_log.view` holder, or via Django admin).
9. **Self-service disable requires the current password.** `POST /api/auth/2fa/disable/` with a wrong `current_password` → `400 validation_error`, `fields.current_password`; `mfa_enabled` stays `true`. Retry with the correct password → `200`; `/api/auth/me/` now shows `mfa_enabled: false`; a subsequent `/api/auth/token/` login for that account returns real tokens directly (no challenge).
10. **Admin reset works and is audited.** As a `users.manage` holder, enroll a second test account, then `POST /api/users/<id>/reset-2fa/` → `200`; that account's `mfa_enabled` flips to `false` and a fresh enrolment starts clean (no old recovery codes remain — confirm via Django admin's `TwoFactorRecoveryCode` list is empty for that user). Confirm one `AuditLog` row with `action=two_factor_reset`, `actor` = the admin, `target_user` = the reset account.
11. **Role-level enforcement flag round-trips through the UI.** `/roles/<id>/edit` as a `roles.manage` holder → toggle "Require two-factor authentication" → save → reload the page → the toggle is still on. `GET /api/roles/<id>/` shows `requires_two_factor: true`.
12. **`RequireAuth`'s redirect gate fires for a required-but-unenrolled account.** Assign a test user to a role with `requires_two_factor: true` (and confirm that user has `mfa_enabled: false`); sign in as them (no 2FA challenge yet, since they haven't enrolled) → confirm every route except `/preferences` redirects to `/preferences`. Enroll and confirm 2FA from that screen → confirm other routes are reachable again immediately (no reload needed, via `refreshUser()`).
13. **The full UI walkthrough, both languages.** `npm run dev` with the backend up:
    - `/preferences` shows a "Two-factor authentication" card below "Password."
    - Enabling shows a QR code and manual-entry secret; confirming with a wrong code shows an inline error and stays on the QR screen; confirming with a real code (compute via an authenticator app or `pyotp`) shows the recovery-codes screen, then returns to the enabled state after "Done."
    - Signing out and back in for that account now shows the "Enter your verification code" step before landing on `/home`; a wrong code shows an inline error without leaving that step; a correct code signs in normally.
    - Disabling requires the current password; a wrong one shows an inline error.
    - `/roles/<id>/edit` shows the "Require two-factor authentication" switch with its hint text.
    - `/users/<id>/edit` for an enrolled user shows "Two-factor authentication is enabled for this user." with a "Reset 2FA" button behind a confirm dialog.
    - Switch to Arabic: every new string above (both preference-screen cards, the login challenge step, the role toggle, the admin reset card/dialog) is translated, `dir="rtl"`.
14. **No hardcoded strings.** From `frontend/`:

    ```powershell
    Select-String -Path src\features\auth\components\TwoFactorSection.tsx,src\features\auth\components\LoginPage.tsx,src\features\accounts\components\RoleFormPage.tsx,src\features\accounts\components\UserFormPage.tsx -Pattern "'[A-Z][a-z]{3,}"
    ```

    Must return only non-user-facing hits.
15. **The full gate set, in CI order:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All four exit 0.

---

## Done Criteria

- [ ] `cryptography` and `pyotp` are direct entries in `requirements.txt`; `qrcode.react` is a direct dependency in `frontend/package.json`.
- [ ] `MFA_ENCRYPTION_KEY` setting exists with a safe derived default, following (and documented as contrasting with) `JWT_SIGNING_KEY`'s own fallback shape.
- [ ] `User.mfa_enabled`/`mfa_secret`, `Role.requires_two_factor`, and `TwoFactorRecoveryCode` exist via one committed migration (`0016_two_factor_authentication.py`) that matches `makemigrations --check`.
- [ ] `apps/accounts/mfa.py` encrypts/decrypts the TOTP secret with Fernet, generates/verifies TOTP codes with `pyotp`, and hashes/verifies recovery codes with the same `sha256`+`hmac.compare_digest` pattern as `apps.integrations.keys`.
- [ ] `POST /api/auth/token/` returns `{mfa_required: true, mfa_token}` instead of a token pair for a 2FA-enabled account, verified live (Verification Step 6); `POST /api/auth/token/verify-mfa/` exchanges a valid challenge + TOTP or recovery code for real tokens (Steps 7-8).
- [ ] `POST /api/auth/2fa/enroll/`, `/confirm/`, `/disable/` all work end to end (Steps 4, 5, 9); recovery codes are returned exactly once at confirm and are each single-use (Step 8).
- [ ] `POST /api/users/<id>/reset-2fa/` (gated `users.manage`, reusing the existing permission — no new `Permissions` constant) resets another account's 2FA and writes an `AuditLog` row (Step 10); recovery-code use also writes one (Step 8).
- [ ] `RoleAdminSerializer`/`RoleFormPage.tsx` expose `requires_two_factor`, round-tripping through the UI (Step 11).
- [ ] `RequireAuth` redirects an under-enrolled, role-mandated account to `/preferences` and nowhere else, and stops redirecting immediately after enrolment completes with no reload (Step 12) — the accepted client-side-only scope boundary is documented in `## Edge Cases`, not silently omitted.
- [ ] `PreferencesPage.tsx` hosts the enroll/confirm/recovery-codes/disable flow via `TwoFactorSection.tsx`, using `useAppForm`/`TextField`/`SwitchField`/`FormErrorSummary`/`SubmitButton` throughout — no new shared form component.
- [ ] `LoginPage.tsx` adds the post-challenge code-entry step with no new route.
- [ ] All new locale keys added to both `en`/`ar` files in `features/auth/locales` and `features/accounts/locales`; key sets match (Verification Step 3).
- [ ] `CONVENTIONS.md` § 21 gains the three appended entries (§ 0-§ 37 unrenumbered).
- [ ] `python manage.py test` still passes; `ruff format --check .`, `ruff check .`, `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build` all exit 0.
- [ ] `.squad/plans/security-administration/00-overview.md` updated with this story's row; `.squad/plans/00-index.md`'s `security-administration` NN range updated to include `107`.
