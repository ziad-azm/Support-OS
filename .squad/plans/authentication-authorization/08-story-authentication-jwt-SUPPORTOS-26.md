# Story 08 — Authentication (JWT) (Story: SUPPORTOS-26)

## Prerequisites

- **Story 07 completed:** [../internationalization-design-system/07-story-forms-validation-foundation-SUPPORTOS-12.md](../internationalization-design-system/07-story-forms-validation-foundation-SUPPORTOS-12.md) — `useAppForm`, `TextField`, `shared/validation/schemas.ts`'s `requiredString`/`email`, and `applyServerErrors`/`isValidationError`. **This story is FORM-1's first production consumer**, exactly as story 07 predicted.
- **Story 06 completed:** [../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md](../internationalization-design-system/06-story-design-system-shared-components-SUPPORTOS-11.md) — `Button`, `Input`, `Label`, the `Direction.DirectionProvider` stack in `app/providers.tsx`, and the `shared/ui/toast/` file-shape precedent this story's `shared/auth/` copies.
- **Story 05 completed:** the `errors` i18next namespace and `ApiRequestError`.
- **FND-2/FND-3 completed** — the envelope, the `EnvelopeJSONRenderer`, and two live seams staged specifically for this story:
  - `setAuthTokenProvider` in `frontend/src/shared/lib/api/client.ts:28` — *"Seam for AUTH-1... this story ships the hook point only, so no auth storage decision is made prematurely."* This story is what fills it in.
  - `JWT_SIGNING_KEY` / `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` / `JWT_REFRESH_TOKEN_LIFETIME_DAYS` in `backend/config/settings/base.py:163–165`, with the comment *"Nothing reads these values yet; that is intentional."* This story makes it read.
- **`CONVENTIONS.md` § 13 (Auth conventions)** currently says AUTH-1 is "neither planned yet." This story makes that false; task 10 rewrites it and appends a new § 21.
- Verified frontend baseline: grepped `frontend/src` for `useAuth`, `AuthProvider`, `token_not_valid` — no hits. Clean slate.
- Verified backend baseline: `djangorestframework-simplejwt` is **not installed** (confirmed: `import rest_framework_simplejwt` fails in the project venv). `apps/accounts/models.py` and `views.py` are the `startapp` placeholders (`# Create your models here.`). No `AUTH_USER_MODEL` setting exists (defaults to `django.contrib.auth.models.User`).
- **The one finding that shapes task 1, verified against the actual local dev database:** `python manage.py showmigrations` shows `auth` (0001–0012), `admin` (0001–0003), `contenttypes`, and `sessions` **already applied** — the stock `auth_user` table already exists in the local `supportos` database. Introducing a custom `AUTH_USER_MODEL` now requires a database reset, not a routine migration. Verified this is safe: `User.objects.count()` and `Session.objects.count()` are both **0**. This is the correct and only sane moment to make this swap — Django's own documentation calls it out as something that must happen before the first real migration, and no real migration exists yet in this project.
- Verified current versions: `djangorestframework-simplejwt` **5.5.1** (latest), installed Django **5.2.x** per `requirements.txt`'s `Django>=5.2,<5.3`.
- This is the first story of **EPIC 2 — Authentication & Authorization**. AUTH-2 (roles, granular permissions) depends on this story and is the next one planned after it.

---

## Story Goal

Make login real: a user authenticates with email and password, receives short-lived tokens, stays signed in across a reload, and a protected route actually protects something.

1. A custom `User` model (email as the login identifier), swapped in via the one-time local database reset this story requires.
2. Backend JWT endpoints — obtain, refresh, logout, "who am I" — **all through the existing envelope with zero response-shape customisation**, verified before writing a line of view code.
3. `JWTAuthentication` registered globally so `request.user` resolves on any endpoint that presents a valid token; `DEFAULT_PERMISSION_CLASSES` **stays `AllowAny`** — enforcement is AUTH-2's job, and every view this story adds sets its own `permission_classes` explicitly, per the existing "Open security note" in `CONVENTIONS.md` § 13.
4. A frontend `shared/auth/` module: in-memory access token, a persisted refresh token, a single-flight silent-refresh-and-retry Axios interceptor, and one `useAuth()` hook as the single source of auth state.
5. A real `LoginPage`, built the way `CONVENTIONS.md` § 20's worked example says a form should be built.
6. A `RequireAuth` route guard, wired so the existing `HealthPage` becomes the first protected route.

### The five findings that shape this story

**1. The stock `simplejwt` views need zero subclassing to satisfy "no custom response shapes."** Verified by reading `apps/core/renderers.py:14–23`: `EnvelopeJSONRenderer.render` wraps **any** non-`Envelope` body in `success_envelope(data)`. `TokenObtainPairView`/`TokenRefreshView` return `Response(serializer.validated_data, status=200)` — a plain dict. Since `EnvelopeJSONRenderer` is the project's `DEFAULT_RENDERER_CLASSES`, that plain dict is wrapped automatically into `{success: true, data: {access, refresh}, error: null, meta: null}`. Task 3 uses the stock views **unmodified**.

**2. The exception handler's `code` comes from the exception *class*, not the raised instance — verified empirically, four scenarios:**

```
login bad creds      -> code: authentication_failed | message: No active account found with the given credentials
bad/expired refresh  -> code: token_not_valid       | message: Token is invalid or expired
bad/expired access   -> code: token_not_valid       | message: Given token not valid for any token type
generic auth failure -> code: authentication_failed | message: Incorrect authentication credentials.
```

Reproduced by constructing `rest_framework_simplejwt.exceptions.{AuthenticationFailed,InvalidToken}` instances and running them through `apps/core/exceptions.py`'s own `code = getattr(exc, "default_code", "error")` / `_first_message(exc.detail)`. **Bad login credentials and a bad/expired access token on any other protected endpoint land on two different, already-meaningful codes** — `authentication_failed` (already in `errors.json`, unchanged) and `token_not_valid` (new). Both a bad refresh call *and* an expired access token used elsewhere produce the **same** `token_not_valid` code, which is exactly the signal the Axios interceptor needs: attempt one silent refresh, and if the failing request *was* the refresh call itself, stop.

**3. The login serializer's field names line up with FORM-1 for free.** `TokenObtainSerializer.__init__` (in `simplejwt`) does `self.fields[self.username_field] = serializers.CharField(write_only=True)`, where `username_field = get_user_model().USERNAME_FIELD`. Once task 1 sets `USERNAME_FIELD = "email"`, a missing/blank field on login is a plain DRF `ValidationError` with field name **`email`** — the same string the frontend's Zod schema and `applyServerErrors` will use. Zero name-mapping, the same payoff § 20 describes for `snake_case` end to end.

**4. Introducing the custom `User` model now is a one-time, verified-safe local database reset — not a routine migration.** `django.contrib.auth`'s own migrations are already applied against the stock `auth_user` table in the local dev database, with `admin.LogEntry` (which FKs to it) also applied. Verified zero rows in either `User` or `Session`. Task 1 is a full drop-and-recreate of the local `supportos` database, done once, by every contributor, before running `migrate` again.

**5. A naive silent-refresh interceptor breaks itself under concurrency, specifically because of finding 1's own hardening.** With `ROTATE_REFRESH_TOKENS` and `BLACKLIST_AFTER_ROTATION` both on (task 2 sets both), every successful refresh **blacklists the refresh token it consumed** and issues a new one. If five requests 401 at once and each independently POSTs the *same* stored refresh token to `/auth/token/refresh/`, the first succeeds and blacklists that token; the other four then fail with `token_not_valid` against a token that is not stolen, just already spent — a self-inflicted logout. Task 4's `refreshAccessToken()` is a **singleton in-flight promise**, not a plain async function, specifically to prevent this.

### Explicitly out of scope

- **AUTH-2** — roles, granular permissions, tightening `DEFAULT_PERMISSION_CLASSES`. This story's views set `permission_classes` explicitly, one at a time; nothing here builds a role model or a generic permission layer.
- **A registration/sign-up endpoint.** Neither the intake nor the backlog names one for AUTH-1. A user is created via `createsuperuser` or the Django admin for this story; AUTH-2 or a later CUST/agent-management story owns self-service account creation.
- **Password reset / "forgot password."** Not in the intake.
- **An httpOnly-cookie refresh token.** The intake says "token storage + refresh in the Axios interceptor," which only makes sense if the client is the one storing and presenting the token — a cookie-based flow needs no client-side storage logic at all. The documented, simpler client-storage pattern is what's built; § 21 records the cookie alternative as a deliberately-not-taken path, not an oversight.
- **"Remember me" / variable session length.** One fixed lifetime pair (`JWT_ACCESS_TOKEN_LIFETIME_MINUTES` / `JWT_REFRESH_TOKEN_LIFETIME_DAYS`), already staged.
- **Login-attempt throttling / rate limiting.** A real hardening gap, explicitly named in `## Edge Cases & Failure Modes` as a forward note for AUTH-2 rather than silently skipped.
- **Any use of the `organization` app.** It is still an empty placeholder; this story's `User` is not scoped to a tenant.
- **Automated tests.** Standing policy (`CONVENTIONS.md` § 16). See `## Test Plan`.

---

## Context — Read These Files First

1. `.squad/stories/authentication-authorization/SUPPORTOS-26/intake.md` — two task blocks, **no attachments, no acceptance criteria**. Done Criteria derive from the two **Outcome** lines and the **Constraints** lines ("reuse API error model; no custom response shapes", "single source of auth state").
2. `CONVENTIONS.md` § 12 (frontend/backend boundaries — the backend owns validation/authz; wire format is `snake_case`), § 13 (the two seams this story fills), § 16, § 18 (error-by-code translation), and **all of § 20** (Forms & validation — the worked example this story's `LoginPage` follows almost verbatim).
3. `backend/apps/core/renderers.py` — all 23 lines. `EnvelopeJSONRenderer.render` (lines 14–23) is why task 3 needs no custom views.
4. `backend/apps/core/exceptions.py` — `envelope_exception_handler` (lines 25–47), `_first_message` (lines 78–83), and the validation branch (lines 35–40). This is the code whose behaviour was verified empirically in finding 2 above.
5. `backend/apps/core/serializers.py` — all 20 lines. `BaseModelSerializer` exists for `TimeStampedModel` fields (`created_at`/`updated_at`); the new `User` model has neither, so task 4's `UserSerializer` deliberately does **not** extend it — a plain `serializers.ModelSerializer` is correct here, and reusing `BaseModelSerializer` would be the wrong kind of reuse.
6. `backend/config/settings/base.py` — `INSTALLED_APPS` (lines 32–64, specifically `THIRD_PARTY_APPS` at 41–44), `MIDDLEWARE` (66–79, note `AuthenticationMiddleware` at line 76 — Django's session-based `request.user`, unrelated to and non-conflicting with DRF's per-request JWT resolution), the JWT env block (157–165), `REST_FRAMEWORK` (197–224, specifically `DEFAULT_AUTHENTICATION_CLASSES: []` at line 219 and the comment above it at 215–218).
7. `backend/apps/core/views.py` — `HealthView` (lines 19–41) and `ApiNotFoundView` (44–62), both of which set `authentication_classes: list = []` explicitly. That pattern is what makes registering `JWTAuthentication` globally safe: existing views that must stay open already opt out.
8. `backend/config/api_urls.py` — all 16 lines. Task 5 adds one `include()` line, **above** the catch-all `re_path` which must stay last.
9. `backend/apps/README.md` § The apps (lines 56–72) — `accounts` is already named *"Users, profiles, credentials, sessions."* This story is the first code in it.
10. `backend/config/tests/test_settings.py` — `JwtSettingsTests` (lines 49–55, pins the exact env values this story's `SIMPLE_JWT` block reads) and **`MigrationStateTests.test_no_pending_migrations`** (lines 104–121). This test **will fail** the moment `apps/accounts/models.py` gains a model, unless task 1 also commits the generated migration in the same change — matching the root README's own rule ("Commit a migration in the same commit as the model change").
11. `frontend/src/shared/lib/api/client.ts` — all of it. `setAuthTokenProvider` (lines 24–30), the request interceptor (32–42, already sends `Authorization` and `Accept-Language`), and the response interceptor (44–47) that normalises everything to `ApiRequestError`. Task 2 adds a **second** response interceptor, registered before this one.
12. `frontend/src/shared/lib/api/errors.ts` — `ApiRequestError` (lines 10–53), specifically `isValidation` (line 41, checks `code === 'validation_error'` — **not** true for `authentication_failed` or `token_not_valid`, which matters for how `LoginPage` and the interceptor each read the error).
13. `frontend/src/shared/lib/api/queryClient.ts` — `createQueryClient` (lines 23–56). `MutationCache.onError` (line 49) toasts **every** mutation failure already. This is why `LoginPage`'s own error handling only needs to add field-level errors for `validation_error` — the translated top-level message for a wrong password is already handled, for free, by this existing global hook.
14. `frontend/src/shared/ui/toast/toastSink.ts` — all 21 lines. `pushToast` is a **bare exported function**, not a hook — this is what lets the non-component interceptor code in `shared/auth` show a "your session expired" toast with no React context available.
15. `frontend/src/shared/ui/confirm/` — the file-shape precedent (`types.ts`, a context, a provider, a hook) that `frontend/src/shared/auth/` copies.
16. `frontend/src/app/providers.tsx` — all of it (current form, after story 07). The provider stack task 8 inserts `AuthProvider` into.
17. `frontend/src/app/router.tsx` — all 28 lines, the two-route tree this story restructures into three: a public `login` route, a protected layout route wrapping the existing index route, and the unchanged catch-all.
18. `frontend/src/app/RootLayout.tsx` — all 28 lines, specifically the `ms-auto` header group (lines 17–20) task 9 extends.
19. `frontend/src/shared/validation/schemas.ts` — `requiredString` and `email` (already built; task 6 composes them, adds nothing new).
20. `frontend/src/shared/ui/form/` (`useAppForm.ts`, `TextField.tsx`, `index.ts`) — task 6's building blocks, unchanged.
21. Before task 6, grep `frontend/src` for `token_not_valid` and `USERNAME_FIELD` to confirm the two systems still agree at implementation time — these are the two hinge points finding 3 depends on.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **Reuse the API error model; no custom response shapes.** | Intake, backend task constraints | Stock `simplejwt` views (task 3), verified auto-wrapped by `EnvelopeJSONRenderer` — no view subclassing for the response body. |
| **Single source of auth state.** | Intake, frontend task constraints | `shared/auth/AuthContext.ts` + `useAuth()` — the only place `user`/`status` live. `RootLayout`, `RequireAuth`, and `LoginPage` all read it; none holds its own copy. |
| **Reuse shared API layer + FORM + UI.** | Intake, frontend task constraints | `login()`/`logout()` call `api.*` from `shared/lib/api/client`, never a second Axios instance; `LoginPage` is built from `useAppForm` + `TextField`, per § 20. |
| **The backend owns validation/authorization; a frontend check is UX only.** | § 12 | `RequireAuth` only hides a route client-side. Every endpoint this story adds sets `permission_classes` explicitly — `AllowAny` where credentials are being presented (`token/`, `token/refresh/`, `logout/`), `IsAuthenticated` where an existing session is required (`me/`). |
| **Wire format is `snake_case` end to end.** | § 12 | `AuthUser` (TS) mirrors the serializer verbatim: `first_name`, `last_name`, `is_staff`. The login schema's `email`/`password` keys match the serializer's dynamic field names exactly (finding 3). |
| **Errors translate by code, never by message.** | § 18 | The new `token_not_valid` code goes into `errors.json` for both languages; the interceptor and `LoginPage` both read `error.code`, never `error.message`, for user-facing copy. |
| Config from `ENV`; no new secrets. | Story 01 `ENV` contract | **This story adds no environment variable.** `ROTATE_REFRESH_TOKENS`/`BLACKLIST_AFTER_ROTATION`/`UPDATE_LAST_LOGIN` are fixed security decisions, not per-environment values, so they are literals in `SIMPLE_JWT`, not new `env()` reads. |

---

## Backend Tasks

### 1 — The custom `User` model, and the one-time local database reset

**This task's ordering matters and is destructive to the local database. Read all of it before running anything.**

**File: `backend/apps/accounts/models.py`** — replace the placeholder:

```python
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _


class UserManager(BaseUserManager):
    """Email is the identifier — there is no `username` on this model."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("A superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """AUTH_USER_MODEL = "accounts.User". Email-based login — no `username`.

    Deliberately minimal: AUTH-2 adds the role field/FK on top of this. Built
    from AbstractBaseUser + PermissionsMixin rather than AbstractUser so there
    is no unused `username` column — see Story 08 task 1.
    """

    email = models.EmailField(_("email address"), unique=True)
    first_name = models.CharField(_("first name"), max_length=150, blank=True)
    last_name = models.CharField(_("last name"), max_length=150, blank=True)
    is_active = models.BooleanField(_("active"), default=True)
    is_staff = models.BooleanField(_("staff status"), default=False)
    date_joined = models.DateTimeField(_("date joined"), default=timezone.now)

    objects = UserManager()

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        verbose_name = _("user")
        verbose_name_plural = _("users")

    def __str__(self) -> str:
        return self.email

    def get_full_name(self) -> str:
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or self.email

    def get_short_name(self) -> str:
        return self.first_name or self.email
```

`date_joined` uses `default=timezone.now`, matching `django.contrib.auth.models.AbstractUser`'s own field exactly (verified by reading it) — not `auto_now_add=True`, so it stays an editable field in the admin, consistent with Django's own convention.

**File: `backend/config/settings/base.py`** — add **one line**, directly after the `LOCAL_APPS` list (line 62) or immediately below it, before `INSTALLED_APPS` is assembled:

```python
AUTH_USER_MODEL = "accounts.User"
```

**Generate the migration — with the OLD database still in place:**

```powershell
cd backend
python manage.py makemigrations accounts
```

This must produce exactly `apps/accounts/migrations/0001_initial.py`, creating the `User` table and its `groups`/`user_permissions` M2M tables (from `PermissionsMixin`). `makemigrations` diffs model state against migration files on disk, not the live database, so this step works correctly even though the database still has the old `auth_user` table. **Commit this file** — `MigrationStateTests.test_no_pending_migrations` (`config/tests/test_settings.py:104`) fails the build without it.

**Now reset the local database — every contributor does this once:**

```powershell
psql -U postgres -c "DROP DATABASE supportos;"
psql -U postgres -c "CREATE DATABASE supportos OWNER supportos;"
cd backend
python manage.py migrate
```

Django resolves `admin`'s `swappable_dependency(settings.AUTH_USER_MODEL)` automatically, so `accounts.0001_initial` applies before `admin`'s migrations that FK to it — no manual ordering needed. `showmigrations` afterward must show every app applied, `accounts` included.

**Create an admin user against the new model:**

```powershell
python manage.py createsuperuser
```

Django's `createsuperuser` introspects `USERNAME_FIELD`/`REQUIRED_FIELDS` dynamically — it prompts for **Email address** and **Password**, no username prompt.

---

### 2 — Install `djangorestframework-simplejwt` and configure `SIMPLE_JWT`

**File: `backend/requirements.txt`** — add one line, after `django-cors-headers`:

```
djangorestframework-simplejwt>=5.5,<6
```

Verified current release: **5.5.1**.

**File: `backend/config/settings/base.py`** — add `"rest_framework_simplejwt.token_blacklist"` to `THIRD_PARTY_APPS` (lines 41–44):

```python
THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
    "rest_framework_simplejwt.token_blacklist",
]
```

Only the `token_blacklist` sub-app needs registering — verified `rest_framework_simplejwt` itself ships no `apps.py` and has no models; only `token_blacklist` does (`OutstandingToken`, `BlacklistedToken`), and it needs its own migration, which is why it must be a real `INSTALLED_APPS` entry (its migrations ship with the package and apply automatically on `migrate`, adding to the fresh-migrate step in task 1).

Replace the JWT env block's trailing comment (lines 157–165) and add the settings block directly after it:

```python
from datetime import timedelta  # add to the top-of-file imports

# ...

# JWT env contract, staged for AUTH-1. Story 08 (AUTH-1) is what reads these.
JWT_SIGNING_KEY = env("JWT_SIGNING_KEY", default="").strip() or SECRET_KEY
JWT_ACCESS_TOKEN_LIFETIME_MINUTES = env.int("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=15)
JWT_REFRESH_TOKEN_LIFETIME_DAYS = env.int("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7)

# Only the settings that differ from djangorestframework-simplejwt's own
# defaults are listed — see CONVENTIONS.md §0 ("only set what's necessary").
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=JWT_ACCESS_TOKEN_LIFETIME_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=JWT_REFRESH_TOKEN_LIFETIME_DAYS),
    # Rotating on every refresh, and blacklisting the token it replaces, is
    # what makes `token_blacklist` worth having. See CONVENTIONS.md §21 for
    # the concurrency hazard this creates on the frontend and how task 4
    # avoids it.
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": JWT_SIGNING_KEY,
}
```

**File: `backend/config/settings/base.py`** — change `DEFAULT_AUTHENTICATION_CLASSES` (line 219) from `[]` to:

```python
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
```

Update the comment above it (lines 215–218), which currently reads "AUTH-1 fills in authentication; AUTH-2 tightens permissions...":

```python
    # AUTH-1 fills in authentication (this block). AUTH-2 tightens permissions
    # to IsAuthenticated and audits every view. Until then request.user
    # resolves correctly wherever a valid token is presented, but the API
    # stays open by default — any endpoint that must be protected sets
    # permission_classes explicitly on its own view. See CONVENTIONS.md §13.
```

`DEFAULT_PERMISSION_CLASSES` (lines 220–222) **stays `AllowAny`, unchanged.**

**Do not** run `pip install` against the project's real venv from this session — planning only. Task 2's `pip install -r requirements.txt` runs at implementation time.

---

### 3 — Token endpoints: obtain, refresh, logout, "me"

**Create file: `backend/apps/accounts/serializers.py`**

```python
from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Deliberately NOT `BaseModelSerializer` — that base exists for
    `TimeStampedModel`'s `created_at`/`updated_at`, which `User` does not
    have. See Story 08 `## Context` item 5.
    """

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "is_staff")
        read_only_fields = ("id", "is_staff")


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
```

**File: `backend/apps/accounts/views.py`** — replace the placeholder:

```python
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import LogoutSerializer, UserSerializer


class LogoutView(APIView):
    """Blacklists the given refresh token.

    No Authorization header required: the refresh token in the body IS the
    credential being revoked, and a client whose access token has already
    expired must still be able to invalidate its refresh token. See
    CONVENTIONS.md §21.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            # Already invalid/expired/blacklisted — the caller's goal (this
            # token must not work again) already holds. Idempotent by design.
            pass
        return Response(None, status=status.HTTP_200_OK)


class MeView(APIView):
    """The authenticated user's own profile. The frontend's one source of
    `AuthUser` — fetched once at boot and once right after login.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)
```

`LogoutView` returns `Response(None, status=200)`, **not 204** — verified `EnvelopeJSONRenderer` special-cases 204/304 to an empty body (`renderers.py:18–19`), and the frontend's generic `api.post<T>` unconditionally calls `unwrap()` on the response body, which needs a real JSON envelope to parse. `200` + `data: null` wraps to `{"success": true, "data": null, "error": null, "meta": null}` and needs no special-casing anywhere in the shared API layer.

**Create file: `backend/apps/accounts/urls.py`**

```python
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import LogoutView, MeView

app_name = "accounts"

urlpatterns = [
    path("token/", TokenObtainPairView.as_view(), name="token_obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("me/", MeView.as_view(), name="me"),
]
```

`TokenObtainPairView`/`TokenRefreshView` used **unmodified** — no `serializer_class` override, no subclass. Finding 1 is why that's sufficient.

**File: `backend/config/api_urls.py`** — add one line, **above** the catch-all `re_path` which must stay last:

```python
urlpatterns = [
    path("", include("apps.core.urls")),
    path("auth/", include("apps.accounts.urls")),
    # Must stay last: turns an unmatched /api/ path into an enveloped 404
    # instead of Django's HTML 404 page.
    re_path(r"^", ApiNotFoundView.as_view()),
]
```

Endpoints: `POST /api/auth/token/`, `POST /api/auth/token/refresh/`, `POST /api/auth/logout/`, `GET /api/auth/me/`.

---

### 4 — Register the admin

**File: `backend/apps/accounts/admin.py`**

```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Adapted from Django's own `UserAdmin` for an email-only, username-less
    model. Verified against the installed Django 5.2 `UserAdmin` defaults —
    re-check `add_fieldsets` (the `usable_password` field is a 5.1+ addition)
    if the Django version pin ever moves.
    """

    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "is_staff", "is_active")
    search_fields = ("email", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        (
            "Permissions",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "usable_password", "password1", "password2")}),
    )
```

Without this, `admin.site.register(User)` (no args) would render the raw password hash as a plain text field — this override is not optional polish.

---

## Frontend Tasks

### 5 — The new error code

**File: `frontend/src/shared/lib/api/types.ts`** — add one entry to `API_ERROR_CODES` (lines 7–19), placed beside `authentication_failed`:

```ts
export const API_ERROR_CODES = [
  'validation_error',
  'parse_error',
  'not_authenticated',
  'authentication_failed',
  'token_not_valid',
  'permission_denied',
  'not_found',
  'method_not_allowed',
  'not_acceptable',
  'unsupported_media_type',
  'throttled',
  'internal_error',
] as const
```

**File: `frontend/src/shared/i18n/locales/en/errors.json`** — add, beside `authentication_failed`:

```json
  "token_not_valid": "Your session has expired. Please sign in again.",
```

**File: `frontend/src/shared/i18n/locales/ar/errors.json`** — add:

```json
  "token_not_valid": "انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى.",
```

---

### 6 — The refresh-and-retry interceptor seam

**File: `frontend/src/shared/lib/api/client.ts`** — add a second seam, beside `setAuthTokenProvider` (lines 20–30):

```ts
type UnauthorizedHandler = () => Promise<string | null>

let unauthorizedHandler: UnauthorizedHandler | null = null

/**
 * Seam for AUTH-1's silent-refresh flow. Resolves to a new access token, or
 * `null` if refresh itself failed — in which case the caller must treat the
 * user as logged out. `shared/auth` is the only sanctioned caller of this.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler
}

const retriedRequests = new WeakSet<object>()
```

Then, **before** the existing response interceptor (lines 44–47), add a new one:

```ts
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const response = error?.response
    const config = error?.config
    const code = response?.data?.error?.code

    // The refresh endpoint itself failing must not trigger another refresh —
    // that is the infinite-recursion case this check exists to prevent.
    const isRefreshCall =
      typeof config?.url === 'string' && config.url.includes('/auth/token/refresh/')

    if (
      response?.status === 401 &&
      code === 'token_not_valid' &&
      unauthorizedHandler &&
      config &&
      !isRefreshCall &&
      !retriedRequests.has(config)
    ) {
      retriedRequests.add(config)
      const newAccessToken = await unauthorizedHandler()
      if (newAccessToken) {
        config.headers = config.headers ?? {}
        config.headers['Authorization'] = `Bearer ${newAccessToken}`
        return httpClient(config)
      }
    }

    return Promise.reject(error)
  },
)

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(toApiRequestError(error)),
)
```

**Ordering matters.** This interceptor must be registered **before** the existing `toApiRequestError` one so it sees the raw Axios error (with `error.response.data.error.code` still in envelope form) rather than an already-normalised `ApiRequestError`. Anything this interceptor does not handle falls through to the existing normalisation, unchanged.

**`retriedRequests` is a `WeakSet` keyed on the Axios config object**, not a boolean flag mutated onto the config — avoids adding an untyped property to `AxiosRequestConfig` and needing a module augmentation for it.

---

### 7 — `shared/auth/`: token storage, context, provider, hook, guard

**File shape mirrors `shared/ui/confirm/`** — a `types.ts`, a context, a provider, a hook, plus `tokenStorage.ts` and `RequireAuth.tsx` alongside them.

**Create file: `frontend/src/shared/auth/types.ts`**

```ts
/** Mirrors `apps.accounts.serializers.UserSerializer` verbatim — snake_case,
 * per CONVENTIONS.md §12. */
export type AuthUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
```

**Create file: `frontend/src/shared/auth/tokenStorage.ts`**

```ts
/**
 * The access token lives in memory only — never localStorage — so it is not
 * readable by an XSS payload that persists across a reload. The refresh
 * token must survive a reload to keep the user signed in, so it is the one
 * piece of auth state in localStorage, mirroring the precedent set by
 * `supportos.language` and `supportos.theme`.
 */
const REFRESH_TOKEN_STORAGE_KEY = 'supportos.refreshToken'

let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setRefreshToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token)
    else window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  } catch {
    // Private mode, or storage disabled. The session will not survive a
    // reload, but the current tab keeps working via the in-memory access
    // token.
  }
}

export function clearTokens(): void {
  setAccessToken(null)
  setRefreshToken(null)
}
```

**Create file: `frontend/src/shared/auth/refresh.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from './tokenStorage'

type RefreshResponse = { access: string; refresh?: string }

let refreshPromise: Promise<string | null> | null = null

async function doRefresh(): Promise<string | null> {
  const refresh = getRefreshToken()
  if (!refresh) return null
  try {
    const data = await api.post<RefreshResponse>('/auth/token/refresh/', { refresh })
    setAccessToken(data.access)
    // ROTATE_REFRESH_TOKENS is on, so a successful refresh always returns a
    // new refresh token too — persist it, or the NEXT refresh call reuses a
    // token the server already blacklisted. See CONVENTIONS.md §21.
    if (data.refresh) setRefreshToken(data.refresh)
    return data.access
  } catch {
    clearTokens()
    return null
  }
}

/**
 * Single-flight silent refresh. Concurrent 401s must all await the SAME
 * in-flight call — verified finding: with ROTATE_REFRESH_TOKENS +
 * BLACKLIST_AFTER_ROTATION, a second parallel refresh call would present a
 * refresh token the first call already spent and blacklisted, failing with
 * `token_not_valid` for a token that was never stolen, just already used.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}
```

**Create file: `frontend/src/shared/auth/AuthContext.ts`**

```ts
import { createContext } from 'react'

import type { AuthContextValue } from './types'

export const AuthContext = createContext<AuthContextValue | null>(null)
```

**Create file: `frontend/src/shared/auth/useAuth.ts`**

```ts
import { useContext } from 'react'

import { AuthContext } from './AuthContext'
import type { AuthContextValue } from './types'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth() must be used within an <AuthProvider>.')
  }
  return context
}
```

**Create file: `frontend/src/shared/auth/AuthProvider.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { api } from '@/shared/lib/api/client'

import { AuthContext } from './AuthContext'
import { refreshAccessToken } from './refresh'
import { clearTokens, getRefreshToken, setAccessToken, setRefreshToken } from './tokenStorage'
import type { AuthStatus, AuthUser } from './types'

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

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await api.post<{ access: string; refresh: string }>('/auth/token/', {
      email,
      password,
    })
    setAccessToken(tokens.access)
    setRefreshToken(tokens.refresh)
    try {
      const me = await api.get<AuthUser>('/auth/me/')
      setUser(me)
      setStatus('authenticated')
    } catch (error) {
      // Tokens were issued but the profile fetch failed. Do not leave the
      // app in a half-authenticated state with tokens but no user.
      clearTokens()
      setStatus('unauthenticated')
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    const refresh = getRefreshToken()
    clearTokens()
    setUser(null)
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

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
}
```

Notice what is **not** here: a force-logout notification for a failed silent refresh. That lives entirely in `shared/auth/index.ts` below, wired at module scope — `AuthProvider` only ever calls `logout()` in response to a user action, never in response to the interceptor. `pushToast` needs no React context (`toastSink.ts`'s whole reason for existing), so the notification for "refresh failed, you were signed out" belongs beside `setUnauthorizedHandler`, not inside this component.

**Create file: `frontend/src/shared/auth/index.ts`**

The side-effect bootstrap that wires both `client.ts` seams — mirrors `shared/theme/index.ts` and `shared/validation/index.ts`.

```ts
import { setAuthTokenProvider, setUnauthorizedHandler } from '@/shared/lib/api/client'
import { i18next } from '@/shared/i18n'
import { pushToast } from '@/shared/ui/toast/toastSink'

import { refreshAccessToken } from './refresh'
import { getAccessToken } from './tokenStorage'

setAuthTokenProvider(() => getAccessToken())

setUnauthorizedHandler(async () => {
  const token = await refreshAccessToken()
  if (!token) {
    // Refresh failed — the user is being force-logged-out by the interceptor
    // path, not by AuthProvider.logout(). Tell them why.
    pushToast({ tone: 'error', message: i18next.t('errors:token_not_valid') })
  }
  return token
})

export { AuthProvider } from './AuthProvider'
export { useAuth } from './useAuth'
export { RequireAuth } from './RequireAuth'
export type { AuthUser, AuthContextValue } from './types'
```

**Create file: `frontend/src/shared/auth/RequireAuth.tsx`**

```tsx
import { Navigate, Outlet, useLocation } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { useAuth } from './useAuth'

/**
 * A layout route with no path: nest protected routes under it in
 * `app/router.tsx`. Renders <Outlet/> only once `status === 'authenticated'`.
 */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Loading />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}
```

---

### 8 — Wire `AuthProvider` into the provider stack

**File: `frontend/src/app/providers.tsx`** — insert `AuthProvider` between `ConfirmProvider` and `QueryClientProvider`. It needs neither (its own state is plain `useState`/`useEffect`), and `LoginPage`'s `useMutation` (task 9) needs `QueryClientProvider` as an ancestor, so `AuthProvider` must sit above it, not inside `RouterProvider`'s subtree:

```tsx
import { AuthProvider } from '@/shared/auth'

// ...

      <Direction.DirectionProvider dir={dir}>
        <ToastProvider>
          <ConfirmProvider>
            <AuthProvider>
              <QueryClientProvider client={queryClient}>
                {children}
                {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
              </QueryClientProvider>
            </AuthProvider>
          </ConfirmProvider>
        </ToastProvider>
      </Direction.DirectionProvider>
```

**File: `frontend/src/main.tsx`** — add `import './shared/auth'` directly below the existing `import './shared/validation'`, inside the same side-effect block. It must run after `./shared/i18n` (the unauthorized-handler toast calls `i18next.t`) and after `./shared/validation` is irrelevant to ordering here, but keeping all four side-effect imports grouped together is the established pattern.

---

### 9 — `LoginPage`

**Create file: `frontend/src/features/auth/components/LoginPage.tsx`**

Follows `CONVENTIONS.md` § 20's worked example directly.

```tsx
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { useState } from 'react'
import * as z from 'zod'

import { useAuth } from '@/shared/auth'
import { email, requiredString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Form } from '@/shared/ui/primitives/form'
import { TextField, useAppForm } from '@/shared/ui/form'

const schema = z.object({
  email: email(),
  password: requiredString(),
})

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formErrors, setFormErrors] = useState<string[]>([])

  const form = useAppForm({
    schema,
    defaultValues: { email: '', password: '' },
  })

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const mutation = useMutation({
    mutationFn: (values: z.output<typeof schema>) => login(values.email, values.password),
    onSuccess: () => navigate(from, { replace: true }),
    onError: (error) => {
      if (isValidationError(error)) {
        setFormErrors(applyServerErrors(form, error))
      }
      // A wrong-credentials failure (code: authentication_failed) sets no
      // field errors — the global toast in AppProviders already shows the
      // translated message. See CONVENTIONS.md §21.
    },
  })

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-lg font-semibold">{t('login.title')}</h1>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <TextField control={form.control} name="email" label={t('login.email')} type="email" />
          <TextField
            control={form.control}
            name="password"
            label={t('login.password')}
            type="password"
          />
          {formErrors.length > 0 ? (
            <p className="text-sm text-destructive">{formErrors.join(' ')}</p>
          ) : null}
          <Button type="submit" disabled={mutation.isPending}>
            {t('login.submit')}
          </Button>
        </form>
      </Form>
    </div>
  )
}
```

**Create file: `frontend/src/features/auth/locales/en.json`**

```json
{
  "login": {
    "title": "Sign in",
    "email": "Email",
    "password": "Password",
    "submit": "Sign in"
  }
}
```

**Create file: `frontend/src/features/auth/locales/ar.json`**

```json
{
  "login": {
    "title": "تسجيل الدخول",
    "email": "البريد الإلكتروني",
    "password": "كلمة المرور",
    "submit": "تسجيل الدخول"
  }
}
```

**File: `frontend/src/shared/i18n/resources.ts`** — register the `auth` namespace, following the exact `health` pattern already there:

```ts
import authAr from '@/features/auth/locales/ar.json'
import authEn from '@/features/auth/locales/en.json'

// ...

export const resources = {
  en: { common: enCommon, errors: enErrors, validation: enValidation, health: healthEn, auth: authEn },
  ar: { common: arCommon, errors: arErrors, validation: arValidation, health: healthAr, auth: authAr },
} as const
```

---

### 10 — Route guard wiring

**File: `frontend/src/app/router.tsx`** — restructure into three top-level children: a public `login` route, a protected layout route wrapping the existing index route, and the unchanged catch-all:

```tsx
import { createBrowserRouter } from 'react-router'

import { RootLayout } from './RootLayout'
import { RouteErrorBoundary } from './RouteErrorBoundary'
import { RequireAuth } from '@/shared/auth'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: 'login',
        lazy: async () => {
          const { LoginPage } = await import('@/features/auth/components/LoginPage')
          return { element: <LoginPage /> }
        },
      },
      {
        element: <RequireAuth />,
        children: [
          {
            index: true,
            lazy: async () => {
              const { HealthPage } = await import('@/features/health/components/HealthPage')
              return { element: <HealthPage /> }
            },
          },
        ],
      },
      {
        path: '*',
        lazy: async () => {
          const { NotFoundPage } = await import('./NotFoundPage')
          return { element: <NotFoundPage /> }
        },
      },
    ],
  },
])
```

`RequireAuth` as a path-less layout route is the standard react-router pattern for a protected subtree — verified `Navigate`/`Outlet`/`useLocation` are all present in the installed `react-router@8.3.0`. Any future protected route nests under the same `RequireAuth` element; `/login` and `*` stay siblings, outside it.

**File: `frontend/src/app/RootLayout.tsx`** — extend the header's `ms-auto` group (lines 17–20) with an auth-aware section:

```tsx
import { useAuth } from '@/shared/auth'

// ...

export function RootLayout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center gap-4 px-4 py-3">
          <span className="font-semibold">{t('app.name')}</span>
          <div className="ms-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  {t('actions.logout')}
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

Add `import { Button } from '@/shared/ui/primitives/button'`.

**File: `frontend/src/shared/i18n/locales/en/common.json`** — add `"logout": "Log out"` to the existing `actions` block.

**File: `frontend/src/shared/i18n/locales/ar/common.json`** — add `"logout": "تسجيل الخروج"`.

**No `Loading` prop change, no new component.** `RequireAuth`'s loading branch reuses the existing `shared/ui/Loading.tsx` unmodified.

---

## Edge Cases & Failure Modes

- **`makemigrations accounts` before the database reset, not after.** It diffs model state against migration files on disk, not the live database — verified this is safe to run against the pre-reset database. Running the reset first would work too, but doing it in the documented order means a mistake in the generated migration is caught (via `manage.py check`) before the destructive step.
- **A half-migrated database is the one truly bad state.** If `DROP DATABASE` runs but `migrate` is never re-run (or fails partway), the app has **no** database at all — `manage.py runserver` will fail loudly on the first request, which is the correct, visible failure. Do not work around it by pointing `POSTGRES_DB` at a different, still-old database.
- **`token_blacklist`'s migrations are third-party and ship with the package.** They are not autodetected by `MigrationStateTests` (which only scans first-party model changes), and they must not be hand-copied into `apps/accounts/migrations/` — they run from their own package location once the app is in `INSTALLED_APPS`.
- **Bad login credentials and an expired access token elsewhere are different codes, verified.** `authentication_failed` (wrong password) already has a translated `errors.json` entry from story 05; `token_not_valid` (expired/invalid token, on refresh *or* on any other protected endpoint) is new. Confusing the two in frontend logic would either force a spurious logout on a wrong password, or silently swallow a real expired-session error.
- **The refresh call itself must be exempted from the retry interceptor**, or a refresh failure recurses into another refresh attempt. `client.ts`'s interceptor checks `config.url.includes('/auth/token/refresh/')` specifically for this.
- **Concurrent 401s and token rotation.** Verified finding 5: with `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`, N simultaneous 401s must resolve to exactly **one** refresh call. `refreshAccessToken()`'s single in-flight promise is the fix; removing it silently reintroduces the bug only under real concurrent traffic, which a manual click-through will not surface.
- **A successful refresh always returns a new refresh token, and it must be persisted.** Verified in `serializers.py`: `if ROTATE_REFRESH_TOKENS: data["refresh"] = str(refresh)`. `refresh.ts`'s `doRefresh()` persists `data.refresh` when present; skipping this means the *next* refresh call presents a token the server already blacklisted, and the user is logged out on the second silent refresh, not the first — a bug that looks intermittent.
- **`login()` can issue tokens and then fail to fetch the profile.** Network drop between the two calls leaves tokens in storage but no `user` in context. `AuthProvider.login()` explicitly clears tokens and rethrows in that case, rather than leaving `status` ambiguous — a half-authenticated state (tokens present, no user, `status` never set to `'authenticated'`) would otherwise make `RequireAuth` behave inconsistently depending on which check ran first.
- **Logout must not depend on the network to "succeed" from the user's point of view.** `AuthProvider.logout()` clears local state **before** calling `/auth/logout/`, and swallows that call's failure. A user who is offline, or whose access token already expired, still ends up logged out locally; the server-side token is cleaned up on its own expiry if the revocation call never lands.
- **`LogoutView` takes no `Authorization` header on purpose.** The scenario it exists for — a refresh token needs revoking because the *access* token already expired — would 401 before reaching the view if `IsAuthenticated` were required. The refresh token in the body is the credential.
- **The force-logout notification lives in `shared/auth/index.ts`, not in `AuthProvider`.** `AuthProvider` only calls `logout()` in response to a user action. A refresh failure inside the interceptor's `unauthorizedHandler` needs to notify the user with no React tree available at all — `pushToast` (a bare function, not a hook) is why that is possible. Do not "simplify" this later by moving the toast into `AuthProvider` — it would stop firing for a refresh failure triggered by a request the component tree never initiated directly.
- **`WeakSet` on the Axios config, not a mutated boolean property.** Adding an ad-hoc `_retried` property to a config object would need a TypeScript module augmentation to stay type-safe; the `WeakSet` keyed on the object reference avoids that entirely and is automatically garbage-collected once the request completes.
- **`DEFAULT_PERMISSION_CLASSES` is unchanged — `AllowAny` everywhere except `MeView`.** This is deliberate, not a leftover: AUTH-2 owns the general enforcement layer. Any endpoint added between this story and AUTH-2 landing must still set `permission_classes` explicitly, exactly as the existing comment in `base.py` already says.
- **No login-attempt throttling.** A real gap for production, explicitly not addressed here — a forward note for AUTH-2 or a dedicated hardening story, not a silent omission.
- **`UserAdmin.add_fieldsets`'s `usable_password` field is version-specific.** Verified present in the installed Django 5.2's `contrib.auth.admin.UserAdmin`. If the Django pin ever moves to a pre-5.1 release, that field name will not exist and the admin add-form will error; re-check against the installed version before touching this pin.
- **`is_staff` is read-only on `UserSerializer` but still present in the response.** `/auth/me/` exposing `is_staff` gives the frontend a coarse "can see the admin" signal for free; it is not a permission check and must not be treated as one — AUTH-2's role model is the real mechanism.

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created, no test runner is added.

The mechanical checks that stand in for it:

1. `npm run build` — typechecks the new `AuthUser`/`AuthContextValue` types, the `useAppForm<typeof schema>` instantiation in `LoginPage`, and every new `t('auth:…')` / `t('errors:token_not_valid')` key through `CustomTypeOptions`.
2. `npm run lint`, `npm run format:check`, `npm run check:rtl` — unchanged gates, now covering the new files.
3. `python manage.py check` and `python manage.py test` — **the count will not be 54 anymore before the migration is committed** if `MigrationStateTests` catches a missing migration; after task 1's `makemigrations accounts` is committed, it returns to reporting cleanly, and the pre-existing 54 tests must all still pass (this story touches no test file, so any behavioural regression among the 54 is a real signal).
4. `ruff format --check .` / `ruff check .` on the new `apps/accounts/*.py` files.
5. Manual end-to-end walkthroughs — Verification Steps 6–11, because this story's actual correctness (silent refresh, concurrent-401 dedup, logout revocation) is not something a static check can see.

---

## Migration / Rollback

**This story's migration IS the destructive step — task 1's local database reset — not an afterthought.**

**Rollback of the database swap**, if something goes wrong mid-implementation: since the pre-reset database had 0 users and 0 sessions (verified), there is no data to lose. Recreate the database again from scratch (`DROP DATABASE` / `CREATE DATABASE` / `migrate`) at any point during implementation with no cost. This is **only** safe because of the verified-empty state — do not apply this same "just reset it" reasoning once any real user or session data exists.

**Rollback of the code**, after the database has already been reset and migrated with the new `User` model: reverting the commits and running `migrate` **backward is not straightforward** — `accounts.0001_initial` cannot be unapplied while `admin`'s migrations (which now FK to `accounts.User`) are applied on top of it. The practical rollback is the same reset procedure: drop, recreate, and either `git revert` first (returning `AUTH_USER_MODEL` to unset, migrating back to stock `auth.User`) or accept the custom model and roll forward instead. **Because of this, get task 1 right before building on top of it** — it is the one part of this story that is expensive to undo.

**Half-applied states to avoid:**

- **`AUTH_USER_MODEL` set, but `makemigrations accounts` not yet run** → `manage.py check` passes, but the first `migrate` on a fresh database fails or silently uses the wrong model shape. Generate and commit the migration in the same change as the model.
- **The database reset run before `makemigrations accounts`** → works, but only because `accounts` had zero prior migrations; do it in the documented order anyway, so `manage.py check` catches a bad model definition before the destructive step, not after.
- **`token_blacklist` added to `INSTALLED_APPS` after the reset's `migrate` already ran** → its tables never get created, and `RefreshToken.blacklist()` raises `AttributeError` at runtime (verified in `tokens.py`: `BlacklistMixin`'s `blacklist`/`check_blacklist` methods only exist on the class **at import time** when `"rest_framework_simplejwt.token_blacklist" in settings.INSTALLED_APPS`). Add it to `INSTALLED_APPS` **before** the reset's `migrate`, not after.
- **Task 6 (the interceptor) shipped before task 7 (`shared/auth`)** → `setUnauthorizedHandler` is never called, so the interceptor's `unauthorizedHandler` stays `null` and every `token_not_valid` response just fails normally (no silent refresh, no infinite loop either — a safe but useless half-state). Ship them together.
- **`AuthProvider` placed outside `QueryClientProvider`'s ancestry** → `LoginPage`'s `useMutation` throws "No QueryClient set" at render. Task 8's ordering (`AuthProvider` wraps `QueryClientProvider`, both inside the existing provider stack) is required, not a style choice.

---

## Verification Steps

1. **Frontend builds:** from `frontend/` — `npm run build` — exits 0.
2. **Backend checks and formats clean:** from `backend/` with the venv active — `pip install -r requirements.txt`, `python manage.py check`, `ruff format --check .`, `ruff check .` — all clean.
3. **The local database reset actually happened and is consistent:** from `backend/` — `python manage.py showmigrations` shows every app applied, `accounts` included, with no `(no migrations)` lines remaining for it.
4. **`createsuperuser` prompts for email, not username.** Confirms `USERNAME_FIELD` took effect.
5. **Backend regression:** `python manage.py test` reports the pre-existing count (54) still passing, plus no new failures. If the count is not 54, investigate — this story adds no test file.
6. **Login works end to end, in the browser.** `npm run dev` + the backend running: hitting `/` unauthenticated redirects to `/login`; logging in with the superuser's credentials redirects back to `/`; the header shows the signed-in email and a working "Log out" button.
7. **A wrong password shows the right message, with no field turning red.** Submit valid email + wrong password: no inline field error appears (the login schema validated fine on the client), and a toast reads the translated `authentication_failed` copy — proving the global `MutationCache.onError` path, not `LoginPage`'s own code, is what renders it.
8. **A blank field shows a real field-level error**, in both languages — reusing story 07's verified `useAppForm` behaviour, now exercised by a real form for the first time.
9. **The access token is genuinely short-lived and silently refreshes.** With the backend running, log in, then wait past `JWT_ACCESS_TOKEN_LIFETIME_MINUTES` (or temporarily lower it via `.env` for this check) and trigger any authenticated request (reload `/`). Confirm via the browser's network tab: the original request 401s once, a `/auth/token/refresh/` call follows automatically, and the original request succeeds on retry — with **no visible interruption** to the user.
10. **Concurrent 401s issue exactly one refresh call.** With an expired access token, trigger two authenticated requests at once (e.g., reload while a background query is in flight). Confirm in the network tab that only **one** `/auth/token/refresh/` request fires, not two.
11. **Logout revokes the refresh token server-side.** Log in, copy the stored refresh token (`localStorage.getItem('supportos.refreshToken')`), log out via the UI, then:

    ```powershell
    curl.exe -s -X POST http://127.0.0.1:8000/api/auth/token/refresh/ -H "Content-Type: application/json" -d "{\"refresh\": \"<paste>\"}"
    ```

    The envelope's `error.code` must be `token_not_valid` — proving the blacklist, not just client-side storage clearing, actually revoked it.
12. **`/api/auth/me/` requires a token.** `curl.exe -s http://127.0.0.1:8000/api/auth/me/` with no `Authorization` header returns `error.code: "not_authenticated"`; with an expired/garbage bearer token, `token_not_valid`.
13. **The full gate set, as CI runs it:** from `frontend/` — `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`. All exit 0.

---

## Done Criteria

- [ ] `AUTH_USER_MODEL = "accounts.User"`; `apps/accounts/models.py` defines `User`/`UserManager` with `USERNAME_FIELD = "email"` and no `username` field; `apps/accounts/migrations/0001_initial.py` is committed.
- [ ] The local `supportos` database has been dropped, recreated, and re-migrated from scratch; `showmigrations` shows `accounts` applied.
- [ ] `djangorestframework-simplejwt>=5.5,<6` is in `requirements.txt`; `rest_framework_simplejwt.token_blacklist` is in `INSTALLED_APPS`.
- [ ] `SIMPLE_JWT` sets only the six keys that differ from the library default (`ACCESS_TOKEN_LIFETIME`, `REFRESH_TOKEN_LIFETIME`, `ROTATE_REFRESH_TOKENS`, `BLACKLIST_AFTER_ROTATION`, `UPDATE_LAST_LOGIN`, `SIGNING_KEY`), reading the already-staged `JWT_*` variables.
- [ ] `DEFAULT_AUTHENTICATION_CLASSES` includes `JWTAuthentication`; `DEFAULT_PERMISSION_CLASSES` is **unchanged** (`AllowAny`).
- [ ] `POST /api/auth/token/`, `POST /api/auth/token/refresh/`, `POST /api/auth/logout/`, `GET /api/auth/me/` all exist, all reachable under `/api/auth/`, and **none required a custom serializer or view to satisfy the envelope contract** except `LogoutView`/`MeView` (which own no token logic themselves — `TokenObtainPairView`/`TokenRefreshView` are stock).
- [ ] `LogoutView` blacklists the given refresh token via `RefreshToken(...).blacklist()`, swallows `TokenError` (idempotent), requires no `Authorization` header, and returns `200` with `data: null` — not `204`.
- [ ] `frontend/src/shared/lib/api/types.ts` and both `errors.json` files include `token_not_valid`.
- [ ] `client.ts` gains `setUnauthorizedHandler` and a refresh-and-retry interceptor registered **before** the existing error-normalising one; the refresh call is exempted from retrying itself via a URL check.
- [ ] `shared/auth/` contains `types.ts`, `tokenStorage.ts`, `refresh.ts`, `AuthContext.ts`, `AuthProvider.tsx`, `useAuth.ts`, `RequireAuth.tsx`, `index.ts`; the access token lives in memory only, the refresh token in `localStorage['supportos.refreshToken']`.
- [ ] `refreshAccessToken()` is a single-flight promise; a rotated refresh token from a successful refresh is persisted.
- [ ] `AuthProvider` sits between `ConfirmProvider` and `QueryClientProvider` in `app/providers.tsx`; `shared/auth` is side-effect-imported in `main.tsx` after `shared/i18n`.
- [ ] `LoginPage` is built from `useAppForm` + `TextField`, following § 20's pattern exactly; a wrong password produces **no** field-level error and relies on the existing global toast; a blank field produces a real translated field error.
- [ ] `RequireAuth` is a path-less layout route in `app/router.tsx`; `/` (HealthPage) is nested under it; `/login` and `*` are siblings, outside it.
- [ ] `RootLayout`'s header shows the signed-in user's email and a working logout button when authenticated, and neither when not.
- [ ] Logging in redirects back to the originally-requested protected route (`location.state.from`), not always to `/`.
- [ ] Manual verification confirms: silent refresh on an expired access token with no visible interruption (Step 9); exactly one refresh call under concurrent 401s (Step 10); logout actually revokes the refresh token server-side (Step 11).
- [ ] `CONVENTIONS.md` § 13 is rewritten (no longer "neither planned yet" for AUTH-1) and `## 21. Authentication (JWT)` is **appended, with §0–§20 unrenumbered**, covering: the envelope-auto-wrap finding; the exception-handler code-vs-message finding; the two-seam client.ts design; the single-flight refresh and why it exists; the in-memory-access/localStorage-refresh storage split and its stated trade-off against an httpOnly-cookie alternative; and the `AllowAny`-still-everywhere-except-`/me/` note pointing at AUTH-2.
- [ ] `frontend/src/README.md` documents `shared/auth/` and `features/auth/`; `backend/apps/README.md`'s `accounts` row needs no change (already accurate); root `README.md` § Environment variables is **unchanged**.
- [ ] `npm run lint`, `npm run format:check`, `npm run check:rtl`, `npm run build`, `ruff format --check .`, `ruff check .` all exit 0; `python manage.py test` passes with no new failures.
- [ ] `.squad/plans/authentication-authorization/00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to AUTH-2 (Roles, Permissions & Authorization), which depends on this story's `User` model and `JWTAuthentication` wiring.**
