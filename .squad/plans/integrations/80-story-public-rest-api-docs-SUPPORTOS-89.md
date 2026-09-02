# Story 80 — Public REST API & Docs (INT-1) (Story: SUPPORTOS-89)

## Prerequisites

- **None on another `integrations` story — this is the first story in `integrations` (`EPIC 14`).** `apps.integrations` is already registered in `INSTALLED_APPS` (`backend/config/settings/base.py` line 69, last entry in `LOCAL_APPS`) but is a bare `startapp` scaffold: `apps/integrations/models.py`, `views.py`, and `admin.py` are each a single comment line, and `apps/integrations/migrations/` holds only `__init__.py`. This story is the first real code in the app, and ships the app's first migration.
- **`AUTHZ` is complete, and this story reuses it rather than adding a parallel mechanism.** `apps/core/permissions.py` already owns the permission vocabulary (`Permissions`), the derived `ALL_PERMISSIONS`, `permissions_for(user)`, and the one DRF permission class (`HasPermission`); `apps/core/views.py::BaseModelViewSet` is the closed-by-default base. The intake's "reusing `AUTHZ`" is satisfied by making an API key **resolve to an `accounts.User`** — every existing `permission_map`, every `HasPermission` check, and `CustomerScopedModelViewSet`'s customer scoping then apply to an API-key caller with **zero changes to any existing view**. See [../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md](../authentication-authorization/08-story-authentication-jwt-SUPPORTOS-26.md) and [../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md](../authentication-authorization/09-story-roles-permissions-authorization-SUPPORTOS-27.md).
- **The intake carries no acceptance criteria and no attachments.** The authoritative text is the intake's Description, which matches `SupportOs backlog.MD` line 864 verbatim:

  > **Task: API keys/token auth + OpenAPI docs** 🔑 — Implement external auth (API keys) reusing `AUTHZ` + generate Swagger/OpenAPI. Outcome: documented external API.

- **This story ships no frontend change.** The backlog marks a UI explicitly when it wants one — `INT-3` ("Provider config models + **UI**", line 876) and `INT-4` ("Webhook subscriptions + dispatch + **UI**", line 882) both do; `INT-1` does not. Key issuance is therefore an API + Django-admin surface, the same posture `Customer.user` provisioning already takes (Django-admin-only, Story 42).
- **Verified live, this session:** `drf-spectacular` is **not** installed in the backend venv (`backend/.venv/Lib/site-packages` has no `drf_spectacular`); `pip index versions drf-spectacular` reports **0.30.0** as the latest release. `grep -rn "ApiKey\|api_keys\|api-keys" backend/apps backend/config` returns nothing — no name collision. No route named `schema/`, `docs/`, or `redoc/` exists anywhere under `/api/`. `apps/integrations/` has no `urls.py`, so `config/api_urls.py` has no `include()` line for it yet.
- **`config/tests/test_settings.py::DrfSettingsTests.test_only_the_envelope_renderer_is_registered` (lines 79-85) pins `DEFAULT_RENDERER_CLASSES` to exactly `["apps.core.renderers.EnvelopeJSONRenderer"]`.** Do **not** add a renderer to that list. drf-spectacular's `SpectacularAPIView`/`SpectacularSwaggerView`/`SpectacularRedocView` each declare their own `renderer_classes`, which override the project default per-view — nothing global is needed and nothing about that test changes.

---

## Story Goal

Turn the existing `/api/` tree into a **documented external API** an outside system can call, without adding a second auth stack and without touching a single existing view:

1. **API-key authentication** — a new `apps/integrations/authentication.py::ApiKeyAuthentication`, added to `DEFAULT_AUTHENTICATION_CLASSES` **after** `JWTAuthentication`. An external caller sends `Authorization: Api-Key <key>`; the class resolves it to the `accounts.User` the key was issued for and returns `(user, api_key)`. From that point on the request is indistinguishable from a JWT-authenticated one, so `IsAuthenticated`, every `permission_map`, `permissions_for(user)`, and `CustomerScopedModelViewSet.get_queryset()` all apply unchanged. **This is the whole of "reusing `AUTHZ`".**
2. **Key lifecycle** — a new `integrations.ApiKey` model (prefix + SHA-256 digest, never the key itself), issued/listed/renamed/revoked through `ApiKeyViewSet` at `/api/api-keys/`, gated on a new `Permissions.API_KEYS_MANAGE` (`"api_keys.manage"`) granted to the seeded `admin` role by a data migration. The plaintext key is returned **once**, in the `POST` response, and is unrecoverable afterward.
3. **OpenAPI 3 schema + Swagger UI + ReDoc** — `drf-spectacular` at `/api/schema/`, `/api/docs/`, `/api/redoc/`. Because every response in this project is wrapped by `EnvelopeJSONRenderer`, a raw drf-spectacular schema would document the **wrong** body shape; a post-processing hook (`apps/integrations/schema.py`) wraps every documented `2xx` payload in the success envelope, attaches the shared error envelope to `400/401/403/404/500`, and `DefaultPageNumberPagination.get_paginated_response_schema` supplies the `meta.pagination` shape for list endpoints.

### What this story does, and what it deliberately does not

| Piece | Why it is here |
|---|---|
| `apps/integrations/{keys,authentication,models,serializers,views,urls,schema}.py` + `0001_initial` | "Implement external auth (API keys) reusing `AUTHZ`" (backlog, `INT-1`). |
| `drf-spectacular`, `SPECTACULAR_SETTINGS`, the three doc routes, the envelope hook | "generate Swagger/OpenAPI… Outcome: documented external API" (backlog, `INT-1`). |
| `Permissions.API_KEYS_MANAGE` + `accounts/migrations/0008_grant_api_keys_permission.py` | § 22's two-halves rule: the string is code, the grant is data. Direct copy of `0006_grant_audit_log_permission.py`. |
| `DefaultPageNumberPagination.get_paginated_response_schema` | Without it drf-spectacular documents DRF's default flat `{count,next,previous,results}` for every list endpoint — a shape this API has never returned (`README.md` § Paginated). |
| `CONVENTIONS.md` § 29, `README.md` § API conventions + env table, `.env.example` | Same reason § 28 (AI-0) and § 24 (SLA-0) exist: the one place `INT-2`…`INT-4` read before inventing a second external-auth mechanism. |

**Not here, and why:**

- **No frontend change of any kind.** See `## Prerequisites` — the backlog asks for a UI in `INT-3`/`INT-4` and not here. A key is issued via `POST /api/api-keys/` (or `/admin/integrations/apikey/`).
- **No `AuditLog` row for key issuance/revocation.** `accounts.AuditLog` (§ 22, `apps/accounts/models.py:136-215`) addresses its target through `target_user`/`target_role`; an `ApiKey` is neither, so an audit row would require a **third** nullable FK on `AuditLog` — a change to another app's model contract that `INT-1`'s task text does not ask for. Issuance and revocation are logged at `INFO` through `logging.getLogger(__name__)` instead (§ 10), and the `ApiKey` row itself is the durable record (revocation is a soft flag, never a delete — see task 8).
- **No per-key permission scopes.** A key inherits **exactly** the permissions of the `User` it is issued for, via `permissions_for` — that is what "reusing `AUTHZ`" means. A second, key-local scope list would be a parallel authorization mechanism, which § 13 forbids outright ("Never build… a second permission check — extend what is there"). Narrow a key by issuing it against a narrowly-roled service user.
- **No per-key rate limiting.** `DEFAULT_THROTTLE_RATES` keeps its single `password_reset_request` entry (SEC-7). Throttling an external API is a real concern, but the intake's task text is auth + docs, and a throttle scope keyed on `request.auth` is a self-contained follow-up.
- **No key rotation endpoint, no expiry-warning notification, no usage analytics.** `expires_at` is stored and enforced; nothing schedules or reports on it.
- **No committed `openapi.yaml` artifact.** The schema is served live from `/api/schema/`; `manage.py spectacular --file` is used only as a verification step (Verification Step 4), writing to a temp path.

---

## Context — Read These Files First

1. `.squad/stories/integrations/SUPPORTOS-89/intake.md` — one description, no acceptance criteria, no attachments. `SupportOs backlog.MD` lines 858-866 (`EPIC 14 — Integrations`, `STORY (INT-1)`) is the same text plus the epic's own "Depends on: foundations, relevant domains" line.
2. `backend/apps/core/permissions.py` (all 138 lines) — read it in full before touching anything. `Permissions` (lines 18-38) is where task 3 adds one constant; `ALL_PERMISSIONS` (41-46) derives itself from `vars(Permissions)`, so **no second list needs editing**. `permissions_for(user)` (49-64) is duck-typed on `user.role` and is what makes an API-key-resolved `User` work with zero changes. `HasPermission.has_object_permission` (100-127) reads `request.user.customer_profile` — an API key issued for a portal-linked user therefore stays customer-scoped automatically.
3. `backend/apps/core/views.py` lines 12-31 (`BaseModelViewSet`: `permission_classes = [IsAuthenticated, HasPermission]`, `permission_map: dict[str, str] = {}`) — the base task 8's `ApiKeyViewSet` subclasses. Lines 34-63 (`CustomerScopedModelViewSet`) — the scoping that keeps working for a key issued against a portal user.
4. `backend/.venv/Lib/site-packages/rest_framework_simplejwt/authentication.py` lines 39-90 — **verified this session:** `JWTAuthentication.authenticate` calls `get_raw_token`, which returns `None` when `parts[0]` is not in `AUTH_HEADER_TYPE_BYTES` (default `{b"Bearer"}`). An `Authorization: Api-Key …` header therefore falls straight through to the next authenticator with no exception. Lines 53-57 (`authenticate_header` returning `Bearer realm="api"`) are why a `401` — not a `403` — is still returned for an unauthenticated request: DRF reads the header off the **first** authenticator in the list.
5. `backend/config/settings/base.py` lines 45-51 (`THIRD_PARTY_APPS`), 241-281 (the `--- DRF ---` block and `REST_FRAMEWORK`, including `DEFAULT_AUTHENTICATION_CLASSES` at 267-269 and SEC-7's `DEFAULT_THROTTLE_RATES` at 280), and 412-427 (the `--- AI (AI-0) ---` block that ends the file — task 2's new block goes after it). Lines 20-25 for the `env = environ.Env()` pattern task 2's one new variable follows.
6. `backend/apps/core/pagination.py` (all 38 lines) — `DefaultPageNumberPagination.get_paginated_response` builds the `meta.pagination` block task 10 mirrors as a schema. Note it sets no `page_size` (that comes from `REST_FRAMEWORK["PAGE_SIZE"]`); task 10 adds a method and changes nothing that exists.
7. `backend/apps/core/renderers.py` lines 6-27 (`EnvelopeJSONRenderer.render`) and `backend/apps/core/envelope.py` lines 27-42 (`success_envelope`/`error_envelope`) — the exact four-key body shape task 9's hook must reproduce in JSON-Schema form, including `error.fields` as `{str: [str]}`.
8. `backend/apps/accounts/models.py` lines 89-135 (`User`: `role` is `PROTECT`+nullable, `is_active`) and 41-86 (`Role.permissions` as a `JSONField` validated by `Role.clean()` against `ALL_PERMISSIONS`) — why task 3's new constant must be added to `Permissions` **before** the grant migration runs, or `Role.clean()` would reject it.
9. `backend/apps/accounts/migrations/0006_grant_audit_log_permission.py` (all 39 lines) — copy this file's structure **exactly** for task 4: module-level `GRANTS = {"admin": [...]}`, `grant`/`revoke` functions using `apps.get_model`, `filter(slug=...).first()` with a `None` guard, `sorted(set(...) | set(...))`, and a `RunPython(grant, revoke)` operation. `0003_seed_roles.py` lines 1-8 documents why importing `apps.core.permissions.Permissions` into a migration is deliberate and safe here.
10. `backend/apps/accounts/tokens.py` lines 76-84 (`password_fingerprint`) — the existing `hashlib.sha256(...).hexdigest()` precedent task 5's `hash_api_key` follows, and the same "`signing.dumps` signs, it does not encrypt" reasoning that rules out storing anything recoverable.
11. `backend/apps/accounts/views.py` lines 154-214 (`UserViewSet`) — the `http_method_names` + `permission_map` + `ordering_fields`/`search_fields` shape task 8 copies. **Its class docstring (lines 158-161) claims `agents.Task.owner` and `notifications.Notification.recipient` are "the only two `on_delete=CASCADE` relationships to `accounts.User`" — task 6 adds a third and must correct that sentence.** Lines 242-270 (`destroy`) — the guard-then-`super()` shape.
12. `backend/apps/knowledge_base/urls.py` (all 22 lines) — the `SimpleRouter` + extra `path()` shape task 11 copies, including the "SimpleRouter, not DefaultRouter: `apps.customers.urls` already owns the API-root view at `path("")`" comment that applies here identically.
13. `backend/config/api_urls.py` (all 25 lines) — one `include()` per app; the `re_path(r"^", ApiNotFoundView.as_view())` catch-all at line 21 **must stay last**, so task 11's new line goes above it.
14. `backend/apps/organization/views.py` lines 11-31 (`SettingsView`) and `backend/apps/core/views.py` lines 89-111 (`PermissionCatalogView`) — the `permission_map` keyed by lowercased HTTP method for a plain `APIView`; relevant because the doc views deliberately do **not** use it (they are `AllowAny`/`IsAuthenticated` via `SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"]`).
15. `README.md` lines 353-452 (§ API conventions: `### Success`, `### Error`, `### Paginated`, `### Error codes`, `### The rule for view authors`) — the exact bodies the schema must document; task 13 appends a new `###` subsection at line 452, immediately before `### Consuming the API from the frontend` (line 453). Lines 507-553 — the `| Variable | Required | Default | Purpose |` env table task 13 adds one row to (after the `AI_MODEL` row).
16. `CONVENTIONS.md` § 13 (lines 191-217, the `AllowAny` default and "never build a second auth flow"), § 16 (lines 251-258, **no automated tests — 54 backend tests, not extended**), § 17 (lines 262-270, range pins), § 22 (lines 787-901, authorization), and § 28 (lines 1948-1979, the end of the file) — task 15 appends a new § 29 after line 1979 and renumbers nothing.
17. `backend/config/tests/test_settings.py` lines 71-102 (`DrfSettingsTests`) and 104-129 (`MigrationStateTests.test_no_pending_migrations`) — the two tests this story interacts with: the first constrains what may be added to `REST_FRAMEWORK` (see `## Prerequisites`), the second **fails** until task 6's migration is generated and committed.
18. `backend/pyproject.toml` — ruff at `line-length = 100`, rule set `E,F,I,N,UP,B,DJ`, with `**/migrations/*` excluded from formatting/linting.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| **External callers authenticate with an API key, not a JWT.** | Intake task | `apps/integrations/authentication.py::ApiKeyAuthentication`, keyword `Api-Key`, registered in `DEFAULT_AUTHENTICATION_CLASSES` after `JWTAuthentication`. |
| **Reuse `AUTHZ` — no second permission mechanism.** | Intake task ("reusing `AUTHZ`") | The authenticator returns an `accounts.User`; `HasPermission`/`permissions_for` and every existing `permission_map` are untouched. |
| **A key's plaintext is never stored and never recoverable.** | Standard for the mechanism; § 10 ("never log secrets") | `ApiKey.hashed_key` holds `sha256(secret)`; `ApiKeySerializer` never exposes it; the raw key appears **only** in the `POST /api/api-keys/` response body. |
| **Only an operator who may manage keys can issue or revoke one.** | § 22 | `Permissions.API_KEYS_MANAGE` on every `ApiKeyViewSet` action; granted to `admin` only, by `accounts/0008_grant_api_keys_permission.py`. |
| **A revoked or expired key authenticates nothing.** | Intake task | `ApiKey.is_usable()`, checked in `ApiKeyAuthentication.authenticate` before the user is returned. |
| **The published schema documents the real body shape, envelope included.** | Intake outcome ("documented external API") | `apps/integrations/schema.py::envelope_postprocessing_hook` + `DefaultPageNumberPagination.get_paginated_response_schema`. |
| Every environment-differing value is read from the environment. | `base.py`'s own module docstring | `API_DOCS_PUBLIC` via `env.bool(...)`. |

---

## Backend Tasks

### 1 — Dependency

**File: `backend/requirements.txt`** — append one line after `anthropic>=1.0,<2`:

```
drf-spectacular>=0.30,<1
```

Major-version-ceiling range pin, matching this file's existing style (§ 17). Verified: `0.30.0` is the current latest release and the package is not yet installed. Install with `pip install -r requirements.txt` from `backend/` with the venv active.

---

### 2 — Settings

**File: `backend/config/settings/base.py`**

**(a)** In `THIRD_PARTY_APPS` (lines 45-51), append after `"django_celery_beat"`:

```python
    "drf_spectacular",
```

**(b)** In `REST_FRAMEWORK` (lines 241-281), extend `DEFAULT_AUTHENTICATION_CLASSES` and add one new key. Replace lines 267-272 with:

```python
    # JWTAuthentication stays FIRST. Verified against the installed
    # simplejwt 5.5.1: `get_raw_token` returns None for any Authorization
    # keyword that is not `Bearer`, so an `Api-Key …` header falls through
    # to the next authenticator without raising — and DRF reads the
    # WWW-Authenticate header off the first entry, keeping an
    # unauthenticated request a 401 rather than a 403. INT-1 (Story 80).
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "apps.integrations.authentication.ApiKeyAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    # INT-1: drf-spectacular's schema generator. Registered here rather
    # than per-view so `manage.py spectacular` sees every endpoint in the
    # /api/ tree, not just the ones an author remembered to annotate.
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
```

**Do not touch `DEFAULT_RENDERER_CLASSES`** — see `## Prerequisites`.

**(c)** Append a new block at the very end of the file, after the `AI_MODEL` line:

```python

# --- Public API & OpenAPI docs (INT-1) -----------------------------------
# `/api/schema/` (the OpenAPI 3 document), `/api/docs/` (Swagger UI) and
# `/api/redoc/` (ReDoc) are routed from apps/integrations/urls.py. Public by
# default so "documented external API" (SupportOs backlog.MD:864) is true
# without a credential; set API_DOCS_PUBLIC=False in an environment that
# must not publish its endpoint inventory, which narrows all three routes to
# IsAuthenticated (they are never disabled outright — an authenticated
# integrator still needs them).
API_DOCS_PUBLIC = env.bool("API_DOCS_PUBLIC", default=True)

SPECTACULAR_SETTINGS = {
    "TITLE": "SupportOS API",
    "DESCRIPTION": (
        "Every response — success or failure — is wrapped in the same "
        "four-key envelope (`success`, `data`, `error`, `meta`); the "
        "schemas below already show the wrapped form. Authenticate either "
        "as a staff user with `Authorization: Bearer <JWT access token>` "
        "(POST /api/auth/token/) or as an external system with "
        "`Authorization: Api-Key <key>` (issued via POST /api/api-keys/). "
        "An API key carries exactly the permissions of the user it was "
        "issued for."
    ),
    "VERSION": "1.0.0",
    "SCHEMA_PATH_PREFIX": "/api/",
    # The schema endpoint does not document itself.
    "SERVE_INCLUDE_SCHEMA": False,
    "SERVE_PERMISSIONS": (
        ["rest_framework.permissions.AllowAny"]
        if API_DOCS_PUBLIC
        else ["rest_framework.permissions.IsAuthenticated"]
    ),
    # `postprocess_schema_enums` is drf-spectacular's own default and must
    # be kept when adding to this list. The envelope hook runs after it.
    "POSTPROCESSING_HOOKS": [
        "drf_spectacular.hooks.postprocess_schema_enums",
        "apps.integrations.schema.envelope_postprocessing_hook",
    ],
    "COMPONENT_SPLIT_REQUEST": True,
    "SORT_OPERATIONS": True,
}
```

---

### 3 — The permission constant

**File: `backend/apps/core/permissions.py`** — add one constant to `Permissions`, after `SETTINGS_MANAGE` and before `REPORTS_VIEW` (keeping the existing rough grouping):

```python
    API_KEYS_MANAGE = "api_keys.manage"
```

`ALL_PERMISSIONS` (lines 41-46) derives itself from `vars(Permissions)`, so nothing else in this file changes and `/api/permissions/` picks the new string up for free.

---

### 4 — Grant it to `admin`

**Create file: `backend/apps/accounts/migrations/0008_grant_api_keys_permission.py`**

```python
from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: an API key inherits its user's full permission set, so
# issuing one is at least as sensitive as editing a role — the same
# reasoning 0006_grant_audit_log_permission.py records for
# `Permissions.AUDIT_LOG_VIEW`. See Story 80 `## Product rules`.
GRANTS = {
    "admin": [Permissions.API_KEYS_MANAGE],
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
        ("accounts", "0007_alter_auditlog_action"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
```

Task 3 must land **before** this runs: `Role.clean()` rejects any permission string absent from `ALL_PERMISSIONS`.

---

### 5 — Key generation and hashing

**Create file: `backend/apps/integrations/keys.py`**

```python
"""API-key minting and verification — INT-1 (Story 80).

A key is `<prefix>.<secret>`, e.g. `sos_3f9a1c04.7b2e…` (64 hex chars of
secret). Only `prefix` and `sha256(secret)` are ever stored, so a
database dump does not yield a working key and a lost key cannot be
recovered — only replaced.

`hashlib.sha256`, not `django.contrib.auth.hashers.make_password`: the
secret is 256 bits of `secrets.token_hex` output, so there is no
low-entropy guess space for a deliberately slow KDF to defend, and a
per-request PBKDF2 verification would add its full cost to every
API-key call. The same plain-`sha256` reasoning
`apps.accounts.tokens.password_fingerprint` already records for a digest
of a stored hash.
"""

import hashlib
import hmac
import secrets

# Namespaced so a leaked string is recognisable as a SupportOS key in a
# log or a paste.
KEY_NAMESPACE = "sos"
# `.` is not in `token_hex`'s alphabet (0-9a-f), so the split below is
# unambiguous. `token_urlsafe` would NOT be: its alphabet includes `_`
# and `-`.
KEY_SEPARATOR = "."
PREFIX_BYTES = 4  # -> "sos_" + 8 hex chars = 12 characters
SECRET_BYTES = 32  # -> 64 hex chars


def generate_api_key() -> tuple[str, str, str]:
    """Mint a key. Returns `(raw_key, prefix, hashed_key)`.

    The caller stores `prefix`/`hashed_key` and hands `raw_key` back to
    the operator exactly once.
    """
    prefix = f"{KEY_NAMESPACE}_{secrets.token_hex(PREFIX_BYTES)}"
    secret = secrets.token_hex(SECRET_BYTES)
    return f"{prefix}{KEY_SEPARATOR}{secret}", prefix, hash_api_key(secret)


def hash_api_key(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def split_raw_key(raw_key: str) -> tuple[str, str] | None:
    """`(prefix, secret)` for a well-formed key, else None."""
    prefix, separator, secret = raw_key.partition(KEY_SEPARATOR)
    if not separator or not prefix or not secret:
        return None
    return prefix, secret


def secrets_match(stored_hash: str, secret: str) -> bool:
    """Constant-time comparison — `==` on a digest leaks its matching
    prefix length through timing.
    """
    return hmac.compare_digest(stored_hash, hash_api_key(secret))
```

---

### 6 — The `ApiKey` model

**File: `backend/apps/integrations/models.py`** — replace the single comment line with:

```python
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel


class ApiKey(TimeStampedModel):
    """An external system's credential for the public API — INT-1.

    Authorization is **not** stored here. A key resolves to `user` and
    every existing `permission_map`/`HasPermission` check then applies to
    that user unchanged (CONVENTIONS.md § 22, § 29) — "reusing AUTHZ", the
    intake's own phrase. Narrowing a key therefore means issuing it
    against a narrowly-roled user, never adding a scope list here.

    `user` is `CASCADE`: a key exists *for* an identity and is meaningless
    without it — the same reasoning `notifications.Notification.recipient`
    records for itself. `created_by` is `SET_NULL`, because the operator
    who issued a key may leave while the key stays in service; that is
    the same asymmetry `AuditLog.actor` (SET_NULL) versus
    `Notification.recipient` (CASCADE) already draws.

    Nothing recoverable is stored: `hashed_key` is `sha256(secret)`
    (apps/integrations/keys.py), and the plaintext is returned exactly
    once, by `POST /api/api-keys/`.
    """

    name = models.CharField(_("name"), max_length=100)
    # Unique and indexed: this is the lookup key on every authenticated
    # request. `editable=False` keeps both credential columns out of the
    # Django admin form and out of any ModelForm.
    prefix = models.CharField(_("prefix"), max_length=12, unique=True, editable=False)
    # 64 hex characters — the width of a sha256 hexdigest.
    hashed_key = models.CharField(_("hashed key"), max_length=64, editable=False)
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="api_keys",
        verbose_name=_("user"),
    )
    created_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="api_keys_issued",
        verbose_name=_("created by"),
    )
    # Revocation is a flag, not a delete: the row is the only record that
    # the key ever existed and when it was last used. See Story 80
    # `## Story Goal` for why no AuditLog row is written.
    is_active = models.BooleanField(_("active"), default=True)
    expires_at = models.DateTimeField(_("expires at"), null=True, blank=True)
    # Written by ApiKeyAuthentication at most once every
    # LAST_USED_WRITE_INTERVAL, not on every request — see that module.
    last_used_at = models.DateTimeField(_("last used at"), null=True, blank=True)

    class Meta:
        verbose_name = _("API key")
        verbose_name_plural = _("API keys")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.name} ({self.prefix})"

    def is_usable(self) -> bool:
        if not self.is_active:
            return False
        return self.expires_at is None or self.expires_at > timezone.now()
```

Generate the migration (do **not** hand-write it):

```powershell
python manage.py makemigrations integrations
```

Expect `apps/integrations/migrations/0001_initial.py`. `MigrationStateTests.test_no_pending_migrations` fails until it is committed.

**Also update `backend/apps/accounts/views.py` lines 158-161** — `UserViewSet`'s docstring says `agents.Task.owner` and `notifications.Notification.recipient` are "the only two `on_delete=CASCADE` relationships to `accounts.User`". `ApiKey.user` is a third. Change that sentence to name three, and add: `` `integrations.ApiKey` rows (INT-1) are safe to let cascade — a key has no meaning without the identity it authenticates as, the same reasoning `Notification` records for itself. `` No code change in that method; `destroy`'s two guards are unaffected.

---

### 7 — The authenticator (and its OpenAPI security scheme)

**Create file: `backend/apps/integrations/authentication.py`**

```python
"""API-key authentication for the public API — INT-1 (Story 80).

Registered in `DEFAULT_AUTHENTICATION_CLASSES` after `JWTAuthentication`
(config/settings/base.py). It returns a plain `accounts.User`, so from
the view's point of view an API-key request is indistinguishable from a
JWT one and every existing `permission_map`, `HasPermission` check, and
`CustomerScopedModelViewSet` queryset filter applies unchanged. That is
the whole of the intake's "reusing AUTHZ" — see CONVENTIONS.md § 29.
"""

import logging
from datetime import timedelta

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .keys import secrets_match, split_raw_key
from .models import ApiKey

logger = logging.getLogger(__name__)

KEYWORD = "Api-Key"
# `last_used_at` is an operational convenience, not an audit trail, and a
# write on every request would turn every GET into a write transaction.
# Five minutes is precise enough to answer "is this key still in use?".
LAST_USED_WRITE_INTERVAL = timedelta(minutes=5)


class ApiKeyAuthentication(BaseAuthentication):
    keyword = KEYWORD

    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header or header[0].lower() != self.keyword.lower().encode():
            # Not ours (no header at all, or a `Bearer` JWT). Returning
            # None lets DRF try the next authenticator.
            return None
        if len(header) != 2:
            raise AuthenticationFailed(_("Invalid Api-Key header. Expected `Api-Key <key>`."))
        try:
            raw_key = header[1].decode()
        except UnicodeError:
            raise AuthenticationFailed(_("Invalid API key.")) from None

        api_key = self._resolve(raw_key)
        if api_key is None:
            # One message for "no such prefix" and for "wrong secret":
            # distinguishing them tells an attacker which half to keep.
            raise AuthenticationFailed(_("Invalid API key."))
        if not api_key.is_usable():
            raise AuthenticationFailed(_("This API key has been revoked or has expired."))
        if not api_key.user.is_active:
            raise AuthenticationFailed(_("The account this API key belongs to is inactive."))

        self._touch(api_key)
        return api_key.user, api_key

    def authenticate_header(self, request):
        return self.keyword

    @staticmethod
    def _resolve(raw_key: str) -> ApiKey | None:
        parts = split_raw_key(raw_key)
        if parts is None:
            return None
        prefix, secret = parts
        # `user__role` too: `permissions_for(request.user)` reads
        # `user.role.permissions` on the very next step of the request
        # cycle (apps/core/permissions.py:49-64).
        api_key = ApiKey.objects.select_related("user", "user__role").filter(prefix=prefix).first()
        if api_key is None or not secrets_match(api_key.hashed_key, secret):
            return None
        return api_key

    @staticmethod
    def _touch(api_key: ApiKey) -> None:
        now = timezone.now()
        if api_key.last_used_at and now - api_key.last_used_at < LAST_USED_WRITE_INTERVAL:
            return
        # `.update()`, not `.save()`: a single UPDATE of one column that
        # deliberately leaves `updated_at`'s `auto_now` alone — a use is
        # not a modification of the key.
        ApiKey.objects.filter(pk=api_key.pk).update(last_used_at=now)


class ApiKeyScheme(OpenApiAuthenticationExtension):
    """Teaches drf-spectacular what `ApiKeyAuthentication` looks like on
    the wire. Without it the generated schema lists no security scheme for
    an API-key call and Swagger UI offers no way to send one.
    Registration happens on import; `IntegrationsConfig.ready()` imports
    this module so `manage.py spectacular` sees it too.
    """

    target_class = "apps.integrations.authentication.ApiKeyAuthentication"
    name = "ApiKeyAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": (
                "An API key issued via `POST /api/api-keys/`, sent as "
                "`Api-Key <key>`. The key carries exactly the permissions "
                "of the user it was issued for."
            ),
        }
```

**File: `backend/apps/integrations/apps.py`** — add `ready()` to `IntegrationsConfig`:

```python
    def ready(self):
        # Imports `ApiKeyScheme` (an OpenApiAuthenticationExtension, which
        # registers itself on import) at startup, so `manage.py
        # spectacular` emits the ApiKeyAuth security scheme without
        # depending on a request having already made DRF import the
        # authentication module. INT-1 (Story 80).
        from . import authentication  # noqa: F401
```

---

### 8 — Serializers and the viewset

**Create file: `backend/apps/integrations/serializers.py`**

```python
from rest_framework import serializers

from apps.accounts.models import User

from .models import ApiKey


class ApiKeySerializer(serializers.ModelSerializer):
    """Read shape, and the `POST` input shape. Never exposes `hashed_key`
    — `prefix` is the only key material a client ever sees again.
    """

    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = ApiKey
        fields = (
            "id",
            "name",
            "prefix",
            "user",
            "user_email",
            "is_active",
            "expires_at",
            "last_used_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("prefix", "is_active", "last_used_at", "created_at", "updated_at")

    def get_fields(self):
        fields = super().get_fields()
        # Active identities only. A key issued for an inactive user would
        # be rejected at authentication time anyway
        # (ApiKeyAuthentication.authenticate), so accepting one here would
        # only mint a credential that cannot work.
        fields["user"].queryset = User.objects.filter(is_active=True)
        return fields


class ApiKeyIssuedSerializer(ApiKeySerializer):
    """The `POST` response only. `key` is the plaintext, returned exactly
    once and unrecoverable afterward.
    """

    key = serializers.CharField(read_only=True)

    class Meta(ApiKeySerializer.Meta):
        fields = (*ApiKeySerializer.Meta.fields, "key")


class ApiKeyUpdateSerializer(serializers.ModelSerializer):
    """`PATCH` shape. `user` is deliberately absent: re-pointing a live
    credential at a different identity silently changes what every caller
    holding it may do. Issue a new key instead.
    """

    class Meta:
        model = ApiKey
        fields = ("name", "is_active", "expires_at")
```

**File: `backend/apps/integrations/views.py`** — replace the single comment line with:

```python
import logging

from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import status
from rest_framework.response import Response

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .keys import generate_api_key
from .models import ApiKey
from .serializers import ApiKeyIssuedSerializer, ApiKeySerializer, ApiKeyUpdateSerializer

logger = logging.getLogger(__name__)


@extend_schema_view(
    create=extend_schema(
        summary="Issue an API key",
        description=(
            "Returns the plaintext key in `data.key`. This is the only time it "
            "is ever returned — store it immediately."
        ),
        responses={status.HTTP_201_CREATED: ApiKeyIssuedSerializer},
    ),
    destroy=extend_schema(
        summary="Revoke an API key",
        description=(
            "Sets `is_active` to false. The row is kept so `last_used_at` and "
            "the issue date remain auditable; a revoked key authenticates "
            "nothing. Reactivate with `PATCH {\"is_active\": true}`."
        ),
    ),
)
class ApiKeyViewSet(BaseModelViewSet):
    """API-key administration — INT-1. Gated entirely on
    `api_keys.manage`, which `accounts/0008_grant_api_keys_permission.py`
    grants to `admin` alone: a key inherits its user's whole permission
    set, so issuing one is as sensitive as editing a role.

    No `PUT`: `prefix`/`hashed_key` are immutable and `user` is
    deliberately not patchable, so a full replace has nothing coherent to
    mean. Narrows Django's own `View.http_method_names`, the same way
    `apps/customers/views.py:159` does.
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    queryset = ApiKey.objects.select_related("user").all()
    serializer_class = ApiKeySerializer

    permission_map = {
        "list": Permissions.API_KEYS_MANAGE,
        "retrieve": Permissions.API_KEYS_MANAGE,
        "create": Permissions.API_KEYS_MANAGE,
        "partial_update": Permissions.API_KEYS_MANAGE,
        "destroy": Permissions.API_KEYS_MANAGE,
    }

    ordering_fields = ("name", "created_at", "last_used_at", "expires_at", "is_active")
    search_fields = ("name", "prefix", "user__email")

    def get_serializer_class(self):
        if self.action == "partial_update":
            return ApiKeyUpdateSerializer
        return ApiKeySerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_key, prefix, hashed_key = generate_api_key()
        api_key = serializer.save(
            prefix=prefix,
            hashed_key=hashed_key,
            created_by=request.user,
        )
        logger.info(
            "API key %s issued for user %s by %s", prefix, api_key.user_id, request.user.id
        )
        # Re-serialise through the issued shape and attach the plaintext.
        # Never logged, never stored — see apps/integrations/keys.py.
        payload = ApiKeyIssuedSerializer(api_key).data
        payload["key"] = raw_key
        return Response(payload, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        logger.info("API key %s revoked by %s", instance.prefix, self.request.user.id)
```

`create` returns a plain dict; `EnvelopeJSONRenderer` wraps it (§ 11 — never build an envelope in a view).

---

### 9 — The envelope post-processing hook

**Create file: `backend/apps/integrations/schema.py`**

```python
"""OpenAPI post-processing — INT-1 (Story 80).

drf-spectacular documents what a **view** returns. This project's views
return plain payloads and `apps.core.renderers.EnvelopeJSONRenderer`
wraps them, so an unmodified schema documents a body shape this API has
never sent. This hook closes that gap: every documented `2xx` payload is
nested under `data` inside the success envelope, and one shared
`ErrorEnvelope` component is attached to the status codes
`apps.core.exceptions.envelope_exception_handler` can produce.

A paginated list endpoint is already enveloped by
`DefaultPageNumberPagination.get_paginated_response_schema` (it has to
be — `meta.pagination` is a sibling of `data`, not something that can be
added from outside), so `_is_enveloped` skips it rather than nesting a
second envelope inside the first.

`nullable: True` rather than `type: ["…", "null"]`: drf-spectacular's
`OAS_VERSION` default is 3.0.3, which has no type-array form.
"""

ERROR_COMPONENT = "ErrorEnvelope"

ERROR_RESPONSES = {
    "400": "Validation or parse error. `error.fields` maps field name to messages.",
    "401": "Missing, malformed, expired, or revoked credentials.",
    "403": "Authenticated, but the caller lacks the required permission.",
    "404": "No such resource, or one outside the caller's scope.",
    "500": "Unhandled server error. `error.debug` is present only when DEBUG is on.",
}

ERROR_ENVELOPE_SCHEMA = {
    "type": "object",
    "required": ["success", "data", "error", "meta"],
    "properties": {
        "success": {"type": "boolean", "enum": [False]},
        "data": {"nullable": True},
        "error": {
            "type": "object",
            "required": ["code", "message", "fields"],
            "properties": {
                "code": {"type": "string", "example": "validation_error"},
                "message": {"type": "string", "example": "The submitted data is invalid."},
                "fields": {
                    "type": "object",
                    "additionalProperties": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
        "meta": {"nullable": True},
    },
}


def _is_enveloped(schema) -> bool:
    return isinstance(schema, dict) and "success" in (schema.get("properties") or {})


def _wrap_success(schema: dict) -> dict:
    return {
        "type": "object",
        "required": ["success", "data", "error", "meta"],
        "properties": {
            "success": {"type": "boolean", "enum": [True]},
            "data": schema,
            "error": {"nullable": True},
            "meta": {"nullable": True},
        },
    }


def envelope_postprocessing_hook(result, generator, request, public):
    for path_item in result.get("paths", {}).values():
        for operation in path_item.values():
            # A path item also holds a `parameters` list, which is not an
            # operation.
            if not isinstance(operation, dict) or "responses" not in operation:
                continue
            responses = operation["responses"]
            for status_code, response in list(responses.items()):
                if not str(status_code).startswith("2"):
                    continue
                for media in (response.get("content") or {}).values():
                    schema = media.get("schema")
                    if schema is None or _is_enveloped(schema):
                        continue
                    media["schema"] = _wrap_success(schema)
            for status_code, description in ERROR_RESPONSES.items():
                responses.setdefault(
                    status_code,
                    {
                        "description": description,
                        "content": {
                            "application/json": {
                                "schema": {"$ref": f"#/components/schemas/{ERROR_COMPONENT}"}
                            }
                        },
                    },
                )
    components = result.setdefault("components", {}).setdefault("schemas", {})
    components[ERROR_COMPONENT] = ERROR_ENVELOPE_SCHEMA
    return result
```

---

### 10 — Teach the pagination class its own schema

**File: `backend/apps/core/pagination.py`** — append one method to `DefaultPageNumberPagination`, after `get_paginated_response`:

```python
    def get_paginated_response_schema(self, schema):
        """What drf-spectacular reads to document a list endpoint — it
        never calls `get_paginated_response` above, so without this
        override every list endpoint would be documented with DRF's
        default flat `{count, next, previous, results}` body, a shape this
        API has never returned (README.md § Paginated). Returns the full
        envelope, `meta.pagination` included, because that block is a
        sibling of `data` and cannot be added from outside — which is
        also why `apps.integrations.schema.envelope_postprocessing_hook`
        skips an already-enveloped schema. INT-1 (Story 80).

        A plain dict, deliberately: this keeps `apps.core` free of any
        `drf_spectacular` import.
        """
        return {
            "type": "object",
            "required": ["success", "data", "error", "meta"],
            "properties": {
                "success": {"type": "boolean", "enum": [True]},
                "data": schema,
                "error": {"nullable": True},
                "meta": {
                    "type": "object",
                    "properties": {
                        "pagination": {
                            "type": "object",
                            "properties": {
                                "count": {"type": "integer", "example": 137},
                                "page": {"type": "integer", "example": 2},
                                "page_size": {"type": "integer", "example": 25},
                                "num_pages": {"type": "integer", "example": 6},
                                "next": {"type": "string", "format": "uri", "nullable": True},
                                "previous": {
                                    "type": "string",
                                    "format": "uri",
                                    "nullable": True,
                                },
                            },
                        }
                    },
                },
            },
        }
```

---

### 11 — Routing

**Create file: `backend/apps/integrations/urls.py`**

```python
from django.urls import path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.routers import SimpleRouter

from .views import ApiKeyViewSet

app_name = "integrations"

# SimpleRouter, not DefaultRouter: apps.customers.urls already owns the
# auto-generated API-root view at path(""). Same note as
# apps/knowledge_base/urls.py.
router = SimpleRouter()
router.register("api-keys", ApiKeyViewSet, basename="api-key")

# The three doc routes live here rather than in config/api_urls.py so this
# app keeps its single include() line (backend/apps/README.md). Each view
# declares its own renderer_classes, so EnvelopeJSONRenderer does not
# wrap the YAML document or the HTML pages; their permissions come from
# SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"] (API_DOCS_PUBLIC).
urlpatterns = router.urls + [
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(url_name="integrations:schema"),
        name="swagger-ui",
    ),
    path(
        "redoc/",
        SpectacularRedocView.as_view(url_name="integrations:schema"),
        name="redoc",
    ),
]
```

**File: `backend/config/api_urls.py`** — add one line after the `apps.reports` include and **above** the `re_path(r"^", ApiNotFoundView.as_view())` catch-all:

```python
    path("", include("apps.integrations.urls")),
```

Endpoints: `/api/api-keys/`, `/api/api-keys/<id>/`, `/api/schema/`, `/api/docs/`, `/api/redoc/`.

---

### 12 — Django admin

**File: `backend/apps/integrations/admin.py`** — replace the single comment line with:

```python
from django.contrib import admin

from .models import ApiKey


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    """A read-and-revoke surface only. `prefix`/`hashed_key` are
    `editable=False` on the model, so neither appears on the form and
    neither can be hand-edited into a working credential. Adding a key
    from here is disabled outright — `ApiKeyViewSet.create` is the only
    path that mints one, and the only path that can hand the plaintext
    back. INT-1 (Story 80).
    """

    list_display = ("name", "prefix", "user", "is_active", "expires_at", "last_used_at")
    list_filter = ("is_active",)
    list_select_related = ("user",)
    search_fields = ("name", "prefix", "user__email")
    readonly_fields = ("prefix", "created_by", "last_used_at", "created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False
```

---

## Documentation Tasks

### 13 — `README.md`

**(a)** Append a new `###` subsection at the end of § API conventions — after `### The rule for view authors` (which ends at line 452) and **before** `### Consuming the API from the frontend` (line 453):

````markdown
### The public API, API keys, and OpenAPI docs (INT-1)

The whole `/api/` tree is the public API. There is no second, "external" surface — an outside
system calls the same endpoints the frontend does, and sees the same envelope.

| URL | What it is |
|---|---|
| `/api/schema/` | The OpenAPI 3 document (YAML). `?format=json` for JSON. |
| `/api/docs/` | Swagger UI, with an **Authorize** button for both auth schemes. |
| `/api/redoc/` | ReDoc, for reading rather than trying calls. |

All three are public by default. Set `API_DOCS_PUBLIC=False` to narrow them to authenticated
callers.

**Two ways to authenticate, one authorization model.**

```
Authorization: Bearer <JWT access token>     # a signed-in staff user (POST /api/auth/token/)
Authorization: Api-Key <key>                 # an external system
```

An API key resolves to the `accounts.User` it was issued for, and **inherits exactly that user's
role permissions** — including portal customer scoping, if the user is a portal identity. To narrow
what a key may do, issue it against a narrowly-roled user; there are no per-key scopes.

**Issuing a key** (requires `api_keys.manage`, held by `admin`):

```
POST /api/api-keys/
{"name": "Acme ERP", "user": 7, "expires_at": null}
```

The response's `data.key` is the plaintext, e.g. `sos_3f9a1c04.7b2e…`. **It is returned exactly
once** — only `prefix` and a SHA-256 digest are stored, so a lost key is replaced, never recovered.

**Revoking** is `DELETE /api/api-keys/<id>/`, which sets `is_active` to false rather than deleting
the row, so `last_used_at` and the issue date stay auditable. `PATCH {"is_active": true}` reverses
it. An expired (`expires_at` in the past) or revoked key returns `401 authentication_failed`.
````

**(b)** Add one row to the backend env table, after the `AI_MODEL` row (line 553):

```markdown
| `API_DOCS_PUBLIC` | no | `True` | Whether `/api/schema/`, `/api/docs/`, `/api/redoc/` are reachable without credentials. `False` narrows all three to `IsAuthenticated` (INT-1). |
```

---

### 14 — `.env.example`

**File: `backend/.env.example`** — append a new block after the `# --- Media (CUST-4) ---` block:

```
# --- Public API & docs (INT-1) ---
API_DOCS_PUBLIC=True
```

---

### 15 — `CONVENTIONS.md` § 29

**File: `CONVENTIONS.md`** — append a new section at the end of the file (after § 28, which ends at line 1979). **Do not renumber § 0-§ 28.**

```markdown

---

## 29. Public API & API keys (INT-1)

`INT-1` (Story 80) makes the existing `/api/` tree the public API. There is
no separate external surface, and there must never be one: a second tree
would need its own serializers, its own permission map, and its own
envelope, and would drift from the first within one story.

**An API key is an identity, not a permission set.**
`apps.integrations.authentication.ApiKeyAuthentication` returns the
`accounts.User` a key was issued for, and every existing `permission_map`,
`HasPermission` check, and `CustomerScopedModelViewSet` queryset filter
then applies to it unchanged (§ 22). **Never add a scope or permission
list to `ApiKey`** — § 13's "never build a second permission check" applies
directly. Narrow a key by issuing it against a narrowly-roled user.

**`apps/integrations/keys.py` is the only place a key is minted, hashed, or
compared.** Only `prefix` (the lookup column) and `sha256(secret)` are
stored; the plaintext exists for the duration of one `POST
/api/api-keys/` response and is never logged, never re-derivable, and
never returned again. Plain `sha256` rather than a password hasher is
deliberate — the secret is 256 bits of `secrets.token_hex`, so a slow KDF
defends nothing and would cost its full price on every API-key request.

**Revocation is a flag, never a delete.** `ApiKey.is_active = False` keeps
`last_used_at` and the issue date, which are the only record that a
credential ever existed. `ApiKeyViewSet.perform_destroy` is what `DELETE`
does; the OpenAPI description says so explicitly, because a `DELETE` that
does not delete would otherwise surprise an integrator.

**A new endpoint is documented by existing in the router — but its response
shape is documented by two shared pieces, not by the view.**
`apps.integrations.schema.envelope_postprocessing_hook` wraps every `2xx`
payload in the success envelope and attaches the shared `ErrorEnvelope` to
`400/401/403/404/500`;
`apps.core.pagination.DefaultPageNumberPagination.get_paginated_response_schema`
supplies the `meta.pagination` shape for list endpoints. A story that adds
an endpoint returning something other than a serializer (a bare dict, a
file) annotates it with `drf_spectacular.utils.extend_schema` on that view
— it does **not** add a second post-processing hook.

**`DEFAULT_RENDERER_CLASSES` stays a one-element list.** The doc views each
declare their own `renderer_classes`, which is why serving YAML and HTML
from under `/api/` does not need — and must not get — a global renderer
addition. `config/tests/test_settings.py::DrfSettingsTests
.test_only_the_envelope_renderer_is_registered` pins this.
```

---

## Edge Cases & Failure Modes

- **A `Bearer` JWT and an `Api-Key` header cannot collide.** `ApiKeyAuthentication.authenticate` returns `None` for any keyword other than `api-key` (case-insensitive), and `JWTAuthentication.get_raw_token` returns `None` for anything but `Bearer` (verified against installed simplejwt 5.5.1 — `## Context` item 4). Neither raises for the other's header; a request with no `Authorization` header at all falls through both and stays anonymous.
- **An unauthenticated request to a protected endpoint stays a `401`, not a `403`.** DRF builds `WWW-Authenticate` from the **first** authenticator in `DEFAULT_AUTHENTICATION_CLASSES`, which is still `JWTAuthentication`. `ApiKeyAuthentication.authenticate_header` returns `"Api-Key"` anyway, so ordering is not load-bearing for correctness — but do not reorder the list, because the emitted challenge would change for every existing endpoint.
- **A malformed key (`Api-Key`, `Api-Key a b c`, non-UTF-8 bytes, no `.` separator) is a clean `401 authentication_failed`, never a `500`.** `len(header) != 2` and the `UnicodeError` catch in `authenticate`, plus `split_raw_key` returning `None`, cover all four.
- **A wrong secret and an unknown prefix return the identical message** (`"Invalid API key."`). Distinguishing them would tell an attacker which half of a partially-known key is right.
- **Timing.** `secrets_match` uses `hmac.compare_digest`. The prefix lookup itself is an indexed DB equality test, not a comparison over secret material.
- **A revoked or expired key is `401`, not `403`.** `ApiKey.is_usable()` is checked in `authenticate`, before the user is ever returned — the request never reaches a permission class, so nothing can grant it.
- **An inactive user's key stops working immediately** (`api_key.user.is_active` check), with no need to revoke every key that user holds. A **deleted** user's keys disappear with them (`ApiKey.user` is `CASCADE`).
- **A key issued for a superuser has unrestricted API access**, because `permissions_for` short-circuits to `ALL_PERMISSIONS` for a superuser (`apps/core/permissions.py:55-56`). This is `AUTHZ`'s existing behaviour, not something this story introduces; the `README.md` addition (task 13) states the inheritance rule plainly so an operator does not issue one by accident.
- **A key issued for a portal-linked user stays customer-scoped.** `CustomerScopedModelViewSet.get_queryset()` and `HasPermission.has_object_permission` both read `request.user.customer_profile`, which is populated identically for an API-key request. No portal story changes.
- **`last_used_at` is approximate by design** — written at most once per five minutes (`LAST_USED_WRITE_INTERVAL`). Do not read it as an audit trail. The write uses `.update()`, so `updated_at`'s `auto_now` does **not** fire and a mere use never looks like a modification.
- **Nobody holds `api_keys.manage` until the grant migration runs**, and after it runs only `admin` does (plus every superuser, via the `permissions_for` short-circuit). A `manager`/`agent` caller gets `403 permission_denied` on `/api/api-keys/`. If the `admin` role was renamed or its `slug` changed, `0008`'s `filter(slug="admin").first()` returns `None` and the migration silently grants nothing — the same failure mode `0006` already has; grant it through `/api/roles/<id>/` or the Django admin in that case.
- **`makemigrations integrations` must be run before `manage.py test`**, or `MigrationStateTests.test_no_pending_migrations` (`config/tests/test_settings.py:105-129`) fails with `Model changes without a migration: ['integrations']`.
- **Enum-name collisions in schema generation are warnings, not errors.** `python manage.py spectacular` prints `enum naming encountered a collision` when two apps expose identically-named choice fields (this project has several `Status`/`Kind` `TextChoices`). The generated schema is still valid and still served; resolve any collision reported in Verification Step 4 by adding an `ENUM_NAME_OVERRIDES` entry to `SPECTACULAR_SETTINGS`. **Do not** suppress warnings globally.
- **Swagger UI and ReDoc load their JS/CSS from a CDN** (drf-spectacular's `SWAGGER_UI_DIST`/`REDOC_DIST` defaults). On a machine with no internet the pages render blank while `/api/schema/` still serves correctly. Installing `drf-spectacular-sidecar` and setting the two `*_DIST` settings to `"SIDECAR"` is the offline fix; it is not part of this story.
- **The published schema lists every endpoint in the project, including staff-only ones.** That is the intended meaning of "documented external API" — `HasPermission` is what stops a caller using them, not obscurity. `API_DOCS_PUBLIC=False` is available for a deployment that disagrees.
- **`POST /api/api-keys/` with an inactive or non-existent `user` is a `400 validation_error` on the `user` field**, from `ApiKeySerializer.get_fields`'s queryset narrowing — not a key that mints successfully and then never authenticates.
- **`PATCH` cannot re-point a key at another user** (`ApiKeyUpdateSerializer` has no `user` field), and no request of any shape can change `prefix` or `hashed_key` (`editable=False` on the model, `read_only` on the serializer, absent from the update serializer).

---

## Test Plan

**This project does not author automated tests** (`CONVENTIONS.md` § 16). No test file is created and no test runner is added.

The mechanical checks that stand in for it:

1. `pip install -r requirements.txt` from `backend/` — installs `drf-spectacular` 0.30.x.
2. `python manage.py makemigrations integrations` — generates `0001_initial.py` for `ApiKey`. `python manage.py makemigrations --check --dry-run` must then report nothing further pending (and must **not** report a change to `accounts`: `0008` is hand-written and data-only).
3. `python manage.py migrate` — applies `integrations.0001_initial` and `accounts.0008_grant_api_keys_permission`.
4. `python manage.py check`, then `python manage.py test` — must report **54** passing, `DrfSettingsTests` (the renderer/handler/pagination pins) and `MigrationStateTests.test_no_pending_migrations` included.
5. `ruff format --check .` and `ruff check .` from `backend/` over the seven new modules and the six changed ones. `**/migrations/*` is excluded by `pyproject.toml`, so `0008` is not linted.
6. `python manage.py spectacular` — must exit 0 and emit a schema; see Verification Step 4 for what to read in it.
7. Real HTTP against key issuance, use, revocation, and the `403`/`401` paths, plus both doc pages in a browser — Verification Steps 5-14.
8. **No frontend check applies** — this story changes no file under `frontend/`. `npm run build`/`lint` need not be run.

---

## Migration / Rollback

**Two migrations ship:**

- `integrations/0001_initial.py` — generated by `makemigrations`. Creates the `integrations_apikey` table. Reversible (`migrate integrations zero`); reversing drops every issued key.
- `accounts/0008_grant_api_keys_permission.py` — hand-written data migration, reversible through its own `revoke` function (`migrate accounts 0007`).

**Rollback of the code:** revert the commits, then `pip uninstall drf-spectacular` (optional — an uninstalled package with `"drf_spectacular"` still in `INSTALLED_APPS` fails at startup, so revert settings **before** uninstalling).

**Half-applied states to avoid:**

- **Task 2(a)/(b) (settings reference `drf_spectacular` and `apps.integrations.authentication.ApiKeyAuthentication`) before task 1's `pip install` and before tasks 6-7 exist** → `ModuleNotFoundError` at startup, or a DRF `ImportError` on the first request. Install first, write the modules, wire the settings last.
- **Task 3 (`Permissions.API_KEYS_MANAGE`) after task 4's migration** → `Role.clean()` raises `Unknown permissions: api_keys.manage` the next time any role is saved through a form or the admin. Task 3 before task 4, always.
- **Task 6 (model) without `makemigrations`** → `MigrationStateTests.test_no_pending_migrations` fails, and `/api/api-keys/` 500s with `relation "integrations_apikey" does not exist`.
- **Task 11 (`api_urls.py` includes `apps.integrations.urls`) before tasks 7-9** → `ImportError` at startup. Ship 7, 8, 9, 11 together.
- **Task 11's new `include()` placed below `re_path(r"^", ApiNotFoundView.as_view())`** → every new route answers a `404` envelope and the docs appear "not deployed". Above the catch-all, always.
- **Task 10 (pagination schema) omitted** → the schema still generates, but documents every list endpoint with DRF's flat default body. A silent, wrong-looking doc rather than a crash — easy to ship by accident.
- **Task 7's `IntegrationsConfig.ready()` omitted** → `manage.py spectacular` may emit no `ApiKeyAuth` security scheme (Swagger UI then shows only the JWT scheme). Also silent.

---

## Verification Steps

1. **Backend installs and boots:** from `backend/` with the venv active — `pip install -r requirements.txt`, then `python manage.py check`. Both exit 0.
2. **Migrations:** `python manage.py makemigrations integrations`, `python manage.py migrate`, then `python manage.py makemigrations --check --dry-run` (reports nothing pending).
3. **Backend builds clean:** `python manage.py test` reports **54** passing; `ruff format --check .` and `ruff check .` both exit 0.
4. **The schema is generated and correctly shaped:**

   ```powershell
   python manage.py spectacular --file "$env:TEMP\supportos-openapi.yaml"
   ```

   Exit 0. Then read the file and confirm all five:
   - `components.securitySchemes` contains **both** `jwtAuth` (from simplejwt, contributed by drf-spectacular's bundled extension) **and** `ApiKeyAuth` with `type: apiKey`, `in: header`, `name: Authorization`.
   - `components.schemas.ErrorEnvelope` exists.
   - `paths./api/tickets/.get.responses.200` — the schema has `properties.success`, `properties.data` (the array), and `properties.meta.properties.pagination` (task 10's shape, **not** DRF's flat `count/next/previous/results`).
   - `paths./api/api-keys/.post.responses.201` — `properties.data` includes `key`.
   - Any single-object `2xx` (e.g. `paths./api/auth/me/.get.responses.200`) is wrapped: `properties.data` holds the payload, not the top level.

   Note any `enum naming encountered a collision` warnings and resolve them per `## Edge Cases`.
5. **Both doc pages render.** `python manage.py runserver`, then open `http://127.0.0.1:8000/api/docs/` and `http://127.0.0.1:8000/api/redoc/`. Swagger UI's **Authorize** dialog offers both `jwtAuth` and `ApiKeyAuth`. `http://127.0.0.1:8000/api/schema/` downloads YAML, and `?format=json` returns JSON — neither is wrapped in the envelope.
6. **`API_DOCS_PUBLIC=False` gates them.** Set it in `backend/.env`, restart, and request `/api/schema/` with no credentials → `401`. Set it back to `True`.
7. **A non-admin cannot manage keys.** Get a token for a `manager` or `agent` account, then:

   ```powershell
   curl.exe -s http://127.0.0.1:8000/api/api-keys/ -H "Authorization: Bearer $agentToken"
   ```

   Expect `403 permission_denied`. Repeat as `admin@supportos.local` → `200`, an enveloped empty page with `meta.pagination`.
8. **Issue a key.** As `admin`, with `<userId>` an active user's id:

   ```powershell
   curl.exe -s -X POST http://127.0.0.1:8000/api/api-keys/ -H "Content-Type: application/json" -H "Authorization: Bearer $adminToken" -d '{\"name\":\"Acme ERP\",\"user\":<userId>}'
   ```

   Expect `201`, `data.key` matching `sos_[0-9a-f]{8}\.[0-9a-f]{64}`, and `data.prefix` equal to the part before the `.`. Save the key. Then `GET /api/api-keys/` and confirm **no** response anywhere contains `key` or `hashed_key`.
9. **The key authenticates, and carries exactly its user's permissions.**

   ```powershell
   curl.exe -s http://127.0.0.1:8000/api/auth/me/ -H "Authorization: Api-Key $rawKey"
   curl.exe -s http://127.0.0.1:8000/api/tickets/ -H "Authorization: Api-Key $rawKey"
   ```

   `/auth/me/` returns that user's own profile and permission list. `/tickets/` returns `200` if the user's role holds `tickets.view` and `403 permission_denied` if it does not — issue a second key against an `agent`-roled and a `manager`-roled user to see both outcomes from the same endpoint. Then `GET /api/api-keys/<id>/` as `admin` and confirm `last_used_at` is now populated.
10. **Malformed and wrong keys are clean 401s.** Each of these returns `401` with an envelope — never a `500`, never HTML:

    ```powershell
    curl.exe -s -i http://127.0.0.1:8000/api/auth/me/ -H "Authorization: Api-Key"
    curl.exe -s -i http://127.0.0.1:8000/api/auth/me/ -H "Authorization: Api-Key a b c"
    curl.exe -s -i http://127.0.0.1:8000/api/auth/me/ -H "Authorization: Api-Key sos_deadbeef.0000"
    curl.exe -s -i http://127.0.0.1:8000/api/auth/me/ -H "Authorization: Api-Key nonsense"
    ```

    Confirm the third and fourth carry the identical `error.message`.
11. **Revocation works and is reversible.** `DELETE /api/api-keys/<id>/` as `admin` → `204`. Reuse the key from step 9 → `401`, message "revoked or has expired". `GET /api/api-keys/<id>/` still returns the row with `is_active: false` and `last_used_at` intact. `PATCH {"is_active": true}` → the key works again. Then `PATCH` `expires_at` to a past timestamp → `401` again.
12. **The JWT path is unchanged.** Sign in through the frontend (`npm run dev`) and click through tickets, customers, and settings. Every existing screen behaves exactly as before — this story adds an authenticator, it does not modify one.
13. **`PUT` is rejected.** `curl.exe -s -i -X PUT http://127.0.0.1:8000/api/api-keys/<id>/ …` → `405 method_not_allowed`.
14. **Django admin.** `/admin/integrations/apikey/` lists keys with no "Add" button, and the change form shows `prefix` read-only and no `hashed_key` field at all.

---

## Done Criteria

- [ ] `drf-spectacular>=0.30,<1` in `backend/requirements.txt`; `"drf_spectacular"` in `THIRD_PARTY_APPS`; `DEFAULT_SCHEMA_CLASS` set. `DEFAULT_RENDERER_CLASSES` **unchanged** and `DrfSettingsTests` still passes.
- [ ] `apps.integrations.authentication.ApiKeyAuthentication` is the **second** entry in `DEFAULT_AUTHENTICATION_CLASSES`; `JWTAuthentication` is still first.
- [ ] `Permissions.API_KEYS_MANAGE` (`"api_keys.manage"`) added to `apps/core/permissions.py`; `accounts/0008_grant_api_keys_permission.py` grants it to `admin` only and reverses cleanly.
- [ ] `integrations.ApiKey` exists with `name`/`prefix`/`hashed_key`/`user`/`created_by`/`is_active`/`expires_at`/`last_used_at`, `prefix` unique and `editable=False`, `hashed_key` `editable=False`, `user` `CASCADE`, `created_by` `SET_NULL`; `integrations/0001_initial.py` generated and committed.
- [ ] `UserViewSet`'s docstring (`apps/accounts/views.py:158-161`) updated to name `integrations.ApiKey.user` as the third `CASCADE` relation to `accounts.User`.
- [ ] `apps/integrations/keys.py` is the only module that mints, hashes, splits, or compares a key; comparison uses `hmac.compare_digest`; no plaintext is stored or logged anywhere.
- [ ] `ApiKeyAuthentication` returns `(user, api_key)`, returns `None` for a non-`Api-Key` header, raises `AuthenticationFailed` for the malformed/unknown/wrong/revoked/expired/inactive-user cases with one shared message for unknown-vs-wrong, and updates `last_used_at` at most once per five minutes via `.update()`.
- [ ] **No existing view, serializer, or `permission_map` was modified to accommodate API-key callers** — verified by Step 9 (`/auth/me/`, `/tickets/`) and Step 12 (the whole frontend).
- [ ] `ApiKeyViewSet` at `/api/api-keys/`, gated on `api_keys.manage` for all five actions, no `PUT`, `POST` returns the plaintext once, `DELETE` soft-revokes, `PATCH` cannot change `user`/`prefix`/`hashed_key`.
- [ ] `/api/schema/`, `/api/docs/`, `/api/redoc/` all serve; the schema carries the `ApiKeyAuth` security scheme, the `ErrorEnvelope` component, envelope-wrapped `2xx` bodies, and `meta.pagination` on list endpoints (Step 4).
- [ ] `DefaultPageNumberPagination.get_paginated_response_schema` added, with no `drf_spectacular` import anywhere in `apps/core/`.
- [ ] `API_DOCS_PUBLIC` in `base.py`, `.env.example`, and the `README.md` env table; `False` gates all three doc routes (Step 6).
- [ ] `README.md` § API conventions gains the "The public API, API keys, and OpenAPI docs (INT-1)" subsection; `CONVENTIONS.md` gains § 29 with § 0-§ 28 unrenumbered.
- [ ] `ApiKey` registered in the Django admin, add disabled, `prefix` read-only, `hashed_key` absent (Step 14).
- [ ] No file under `frontend/` changed.
- [ ] `python manage.py check`, `python manage.py test` (**54** passing), `python manage.py spectacular`, `ruff format --check .`, `ruff check .` all exit 0.
- [ ] `.squad/plans/integrations/00-overview.md` carries this story's row; `.squad/plans/00-index.md` carries the new `integrations` row.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 81.**
