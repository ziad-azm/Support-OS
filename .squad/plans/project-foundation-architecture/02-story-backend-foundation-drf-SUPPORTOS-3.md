# Story 02 — Backend Foundation (Django + DRF) (Story: SUPPORTOS-3)

## Prerequisites

- **Story 01 completed:** [01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md](01-story-repository-local-dev-bootstrap-SUPPORTOS-2.md). The `backend/` Django project, the `config/settings/` split, and the `ENV` contract all exist and are committed at `689bd65`.
- **Blocking:** story 01's Verification Step 3 (`python manage.py migrate` against local PostgreSQL) is **still unverified** — PostgreSQL 17 is installed and listening on `5432`, but the `supportos` role and database do not exist yet. Every DB-touching test in this story (`GET /api/health/`, the pagination tests) fails until README § 2 has been run. **Create the role and database before starting task 5.**
- `backend/.venv` already has Django 5.2.17, `psycopg[binary]` 3.3.4, and `django-environ` 0.14.0 installed. This story adds two packages to that environment.
- Two known deviations from story 01's plan are already applied in code — do not "fix" them back: `JWT_SIGNING_KEY` uses `.strip() or SECRET_KEY` rather than `default=SECRET_KEY` ([base.py:126–129](../../../backend/config/settings/base.py#L126-L129)), and the README documents that Vite **does** auto-restart on `.env` change.

---

## Story Goal

Turn the bare Django project into a domain-organised DRF backend where every endpoint answers in one response shape.

1. Twelve empty domain apps plus a shared `core` app live under `backend/apps/`, all importable, with a written placement rule for new code.
2. DRF is installed and configured so that **every** success response and **every** error response — including ones raised by DRF internals, Django, or an unhandled crash — is serialised into a single envelope. A view author cannot opt out or forget.
3. `GET /api/health/` returns that envelope and reports live database connectivity.
4. The `makemigrations` / `migrate` workflow is documented against local PostgreSQL.

**One addition beyond the intake's three tasks, made deliberately:** `django-cors-headers` is installed and configured here. The intake does not list it, but the Vite dev server on `:5173` cannot call the API on `:8000` without it, so FND-3's shared Axios layer would be blocked on its first request and this story's "errors are uniform" outcome would be unobservable from the browser. It is small, env-driven, and consistent with `ENV`. If you would rather push it to FND-3, drop task 4's CORS bullets and the two `CORS_*` env rows — nothing else depends on them.

**Explicitly out of scope:**

- Any **model, serializer, or endpoint** inside a domain app. The domain apps ship empty. Their first models arrive with EPIC 3 onward (`SupportOs backlog.MD` lines 270+).
- **Authentication and permissions.** `DEFAULT_AUTHENTICATION_CLASSES` stays empty and `DEFAULT_PERMISSION_CLASSES` stays `AllowAny` → **AUTH-1** and **AUTH-2** (`SupportOs backlog.MD` lines 228–268). See the security note in Edge Cases.
- **Frontend anything** — the Axios instance, TanStack Query, and the TypeScript types mirroring this envelope are **FND-3** (`SupportOs backlog.MD` lines 87–111). This story only publishes the shape they must match.
- **`CONV` itself** — the full conventions document is **FND-4** (lines 113–139). This story writes only the backend placement rule, which FND-4 will reference rather than restate.
- Lint/format/test-runner tooling. Keep using Django's built-in test runner, as story 01 established. **Do not** add pytest, ruff, or black.
- The browsable API, OpenAPI schema generation, throttling configuration, and caching.

---

## Context — Read These Files First

1. `.squad/stories/project-foundation-architecture/SUPPORTOS-3/intake.md` — the source story. The fenced **Description** block lists the three tasks and their constraints. **No attachments** and **no acceptance criteria**; Done Criteria below derive from the three task **Outcome** lines.
2. `backend/config/settings/base.py` — the file most of task 4 edits. Read `INSTALLED_APPS` (**lines 32–40**) and note the placeholder comment on **line 39**, `# Domain apps are added by FND-2. Do not add them here.` — that comment is this story's cue and must be removed. Read `MIDDLEWARE` (**lines 42–50**), the `env` handle created on **line 19**, and the `DATABASES` block (**lines 76–86**) which already points at local PostgreSQL. New settings append after **line 131**.
3. `backend/config/urls.py` — **lines 20–22**, `urlpatterns` with only `path('admin/', admin.site.urls)`. Task 4 adds the `api/` include here. Note this file uses **single quotes** (it is generated code, untouched by story 01); match the surrounding style when editing it, unlike `base.py` which uses double quotes.
4. `backend/config/settings/dev.py` — all 7 lines. `DEBUG` defaults to `True` here, which is what gates the traceback in the 500 envelope.
5. `backend/config/tests/test_settings.py` — the existing test module, 7 tests across 5 `SimpleTestCase` classes (`BaseDirTests`, `SecretKeyTests`, `DatabaseSettingsTests`, `JwtSettingsTests`, `SettingsSplitTests`). Match this structure and the `SimpleTestCase`-unless-you-need-the-DB habit. `test_database_reads_env_vars` (**lines 37–44**) shows how env values are asserted.
6. `backend/requirements.txt` — 5 lines, comment + 3 range-pinned dependencies. Task 4 appends to it in the same style; do not switch to exact pins.
7. `backend/.env.example` — 22 lines. New variables go in a new section, and **every** new key must also land in the README table (see rule below).
8. `README.md` — **lines 210–235** the backend env-var table, **lines 216–235** the rows to extend; **line 269** starts `## Troubleshooting`. Task 7 adds an `## API conventions` section and a migrations subsection.
9. `SupportOs backlog.MD` — **lines 61–85** the FND-2 story this plan implements; **lines 87–111** FND-3, whose "typed API response helpers matching the backend envelope" consume the shape defined here; **line 19** the `API` shared-spec definition.
10. Grep for `Envelope` across `backend/` before you start — it must return nothing. If it returns hits, part of this story is already applied.

---

## Product rules (from story)

| Rule | Source | Enforcement point |
|---|---|---|
| Organise by **domain, not technical layer**. | Intake, task 1 constraints | `backend/apps/<domain>/`; no top-level `serializers/`, `services/`, or `views/` package. Written down in `backend/apps/README.md`. |
| **Avoid premature abstractions.** | Intake, task 1 constraints | Domain apps ship exactly what `startapp` generates. No per-app `urls.py`, `serializers.py`, or `services.py` until a feature needs one. |
| Every future endpoint **reuses this envelope**; no per-feature error formats. | Intake, task 2 constraints | Enforced by a **renderer** (`EnvelopeJSONRenderer`) and a global `EXCEPTION_HANDLER`, not by a helper a view author must remember to call. |
| Errors are **uniform**. | Intake, task 2 outcome | `envelope_exception_handler` returns a `Response` even for unhandled non-API exceptions, so nothing escapes as HTML from a DRF view. |
| **Local install only; no Docker dependency.** | Intake, task 3 constraints | Migration workflow documented against the local PostgreSQL from story 01. No container files. |
| No secrets committed. | Story 01 `ENV` contract | New env vars carry non-secret defaults; `.env.example` and the README table stay in lockstep. |

---

## Backend Tasks

### 1 — Create the `apps/` package and the shared `core` app

**Create file: `backend/apps/__init__.py`** — empty. This makes `apps` a package so app labels resolve as `apps.<domain>`.

> **Naming trap:** the package is `apps`, and Django's app-config attribute is also called `apps`. They never collide because nothing imports `django.apps` as a bare name inside these modules, but **do not** rename `backend/apps/` to `applications/` or similar — every `INSTALLED_APPS` string below assumes `apps.`.

**Create the `core` app:**

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
New-Item -ItemType Directory apps\core
python manage.py startapp core apps\core
```

`startapp <name> <dir>` requires the target directory to exist first. It generates `apps/core/{__init__.py,admin.py,apps.py,models.py,tests.py,views.py,migrations/__init__.py}`.

**File: `backend/apps/core/apps.py`**

`startapp` writes `name = "core"`, which is wrong for a nested app and will fail at import. Change it:

```python
from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"
```

Django derives the app **label** from the last dotted component, so the label stays `core` and future table names stay `core_*` rather than `apps_core_*`. Do not set `label` explicitly.

**Delete file: `backend/apps/core/tests.py`** — replaced by the `tests/` package created in the Test Plan.

**Create file: `backend/apps/core/models.py`** (replacing the generated stub)

```python
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base for every domain model: creation and update timestamps.

    Abstract, so it produces no migration and no table of its own.
    """

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        get_latest_by = "created_at"
```

This is the only model this story adds, and being `abstract = True` it creates **no migration**. Do not add concrete models to `core`.

---

### 2 — Create the twelve empty domain apps

Run from `backend/` with the venv active. The app list comes verbatim from the intake:

```powershell
$domains = @(
  "customers","tickets","communications","agents","sla",
  "knowledge_base","portal","reports","ai","integrations",
  "accounts","organization"
)
foreach ($d in $domains) {
  New-Item -ItemType Directory "apps\$d" | Out-Null
  python manage.py startapp $d "apps\$d"
}
```

POSIX equivalent:

```bash
for d in customers tickets communications agents sla \
         knowledge_base portal reports ai integrations \
         accounts organization; do
  mkdir -p "apps/$d" && python manage.py startapp "$d" "apps/$d"
done
```

**For each of the twelve, edit `backend/apps/<domain>/apps.py`** and prefix `name` with `apps.`, exactly as in task 1. Example for `knowledge_base`:

```python
from django.apps import AppConfig


class KnowledgeBaseConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.knowledge_base"
```

`startapp` derives the class name by title-casing and stripping underscores, so the generated classes are `CustomersConfig`, `KnowledgeBaseConfig`, `AiConfig`, `SlaConfig`, and so on. **Keep the generated class names**; only the `name` string changes.

**Delete `backend/apps/<domain>/tests.py` for all twelve.** Empty apps have nothing to test yet, and leaving a stub `tests.py` behind blocks the later switch to a `tests/` package.

Leave `models.py`, `views.py`, and `admin.py` as the generated empty stubs. **Do not** create `urls.py`, `serializers.py`, `services.py`, or `selectors.py` in any domain app — that is the "avoid premature abstractions" constraint, and the placement rule in task 3 tells future authors when to add them.

---

### 3 — Write the backend placement rule

**Create file: `backend/apps/README.md`**

This is the backend half of `ARCH`. Keep it short — it is a decision record, not a tutorial. It must state:

1. **One app per business area.** The twelve domain apps map to business boundaries, not to technical layers. There is no `serializers/`, `views/`, or `services/` top-level package and there never will be.
2. **Where new code goes**, as a decision list an author can follow without asking:
   - Belongs to exactly one business area → that app.
   - Needed by two or more apps → `apps/core`.
   - Needed by two or more apps but only as a *type* or *constant* → `apps/core`, not duplicated.
   - Genuinely a new business area → a new app plus a row in the table below, reviewed before it is added.
3. **What lives in `apps/core`** and what does not: cross-cutting response/error/pagination machinery, `TimeStampedModel`, shared enums and validators. **Not** a dumping ground — no business logic, and nothing that only one app uses.
4. **Files are created on demand.** An app gets a `serializers.py` when it has a serializer, a `urls.py` when it has a route. Do not pre-create empty modules.
5. **A table of the twelve apps** with a one-line business scope each, so the boundary is written down rather than inferred:

   | App | Owns |
   |---|---|
   | `accounts` | Users, profiles, credentials, sessions. |
   | `organization` | Tenant/company records, teams, org-level settings. |
   | `customers` | Customer records, contacts, interaction history. |
   | `tickets` | Tickets, categories, priorities, status transitions, history. |
   | `communications` | Channel adapters and messages (email, WhatsApp, chat, SMS, web forms). |
   | `agents` | Agent workspace: assignment views, tasks, quick replies, collaboration. |
   | `sla` | SLA policies, timers, breach detection, escalation rules. |
   | `knowledge_base` | Articles, categories, search. |
   | `portal` | Customer-facing self-service surface. |
   | `reports` | Aggregations, dashboards, exports. |
   | `ai` | AI-assisted features (suggestions, summarisation, classification). |
   | `integrations` | Third-party system connectors and webhooks. |

6. **A pointer forward:** the full conventions document is `CONV` (FND-4) and will reference this file rather than restate it.

---

### 4 — Install and configure DRF

**File: `backend/requirements.txt`**

Append, keeping the existing range-pin style:

```text
djangorestframework>=3.16,<4
django-cors-headers>=4.4,<5
```

Install into the existing venv:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**File: `backend/config/settings/base.py`**

**Replace `INSTALLED_APPS` (lines 32–40)** — the placeholder comment on line 39 goes away. Group by origin, Django → third-party → local, and comment the groups:

```python
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
]

# Domain apps: one per business area. See backend/apps/README.md for the rule
# that decides where new code goes.
LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.organization",
    "apps.customers",
    "apps.tickets",
    "apps.communications",
    "apps.agents",
    "apps.sla",
    "apps.knowledge_base",
    "apps.portal",
    "apps.reports",
    "apps.ai",
    "apps.integrations",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS
```

**Edit `MIDDLEWARE` (lines 42–50)** — insert `corsheaders.middleware.CorsMiddleware` as the **first** entry, above `SecurityMiddleware`:

```python
MIDDLEWARE = [
    # Must sit above CommonMiddleware so preflight responses are not rewritten.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    # … existing entries unchanged …
]
```

**Append after line 131** (after the `JWT_*` block):

```python
# --- CORS ---------------------------------------------------------------
# The Vite dev server runs on a different origin from Django, so the browser
# needs these headers to let the frontend call the API at all.
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS", default=["http://localhost:5173", "http://127.0.0.1:5173"]
)
CORS_ALLOW_CREDENTIALS = env.bool("CORS_ALLOW_CREDENTIALS", default=True)


# --- DRF ----------------------------------------------------------------
# The renderer and the exception handler together are the `API` contract: every
# response body — success or failure — leaves this app in envelope form.
DRF_PAGE_SIZE = env.int("DRF_PAGE_SIZE", default=25)
DRF_MAX_PAGE_SIZE = env.int("DRF_MAX_PAGE_SIZE", default=100)

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "apps.core.renderers.EnvelopeJSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.envelope_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPageNumberPagination",
    "PAGE_SIZE": DRF_PAGE_SIZE,
    # AUTH-1 fills in authentication; AUTH-2 tightens permissions to
    # IsAuthenticated. Until then the API is deliberately open — see the
    # security note in the story plan.
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}
```

`BrowsableAPIRenderer` is deliberately absent: with only a JSON renderer registered, a browser hitting an API URL gets a `406` **in envelope form** rather than an HTML page that bypasses the contract.

**File: `backend/.env.example`**

Append a new section:

```dotenv
# --- API / CORS ---
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
CORS_ALLOW_CREDENTIALS=True
DRF_PAGE_SIZE=25
DRF_MAX_PAGE_SIZE=100
```

All four have working defaults in `base.py`, so an existing `backend/.env` from story 01 keeps working without edits.

---

### 5 — Build the envelope: `core` response machinery

Four new modules under `backend/apps/core/`. Read them in this order — each depends on the one before.

**Create file: `backend/apps/core/envelope.py`**

```python
"""The single response shape for the whole API (`API` shared spec).

Every response body is:

    {
      "success": bool,
      "data":    <payload> | null,
      "error":   null | {"code": str, "message": str, "fields": {str: [str]}},
      "meta":    null | {"pagination": {...}}
    }

All four keys are always present, so a client can discriminate on `success`
without probing for optional keys.
"""

from typing import Any


class Envelope(dict):
    """Marker type for a body that is already in envelope form.

    A subclass of `dict` rather than a sniff for a "success" key: an endpoint
    whose own payload happens to contain "success" must never be mistaken for
    an already-wrapped body.
    """


def success_envelope(data: Any = None, meta: dict | None = None) -> Envelope:
    return Envelope(success=True, data=data, error=None, meta=meta)


def error_envelope(
    code: str,
    message: str,
    fields: dict[str, list[str]] | None = None,
    debug: dict | None = None,
) -> Envelope:
    error: dict[str, Any] = {"code": code, "message": message, "fields": fields or {}}
    if debug is not None:
        error["debug"] = debug
    return Envelope(success=False, data=None, error=error, meta=None)
```

`error.fields` is **always a dict**, empty for non-validation errors. That keeps the frontend's React-Hook-Form wiring (FORM-1) from needing a null check on every submit.

**Create file: `backend/apps/core/renderers.py`**

```python
from rest_framework.renderers import JSONRenderer

from .envelope import Envelope, success_envelope


class EnvelopeJSONRenderer(JSONRenderer):
    """Wrap every successful response body in the standard envelope.

    A renderer, not a helper function: a view author cannot forget to call it.
    Bodies that already are an `Envelope` — produced by the exception handler
    or by `DefaultPageNumberPagination` — pass through untouched.
    """

    def render(self, data, accepted_media_type=None, renderer_context=None):
        response = (renderer_context or {}).get("response")

        # 204 and 304 must carry an empty body.
        if response is not None and response.status_code in (204, 304):
            return b""

        if not isinstance(data, Envelope):
            data = success_envelope(data)

        return super().render(data, accepted_media_type, renderer_context)
```

**Create file: `backend/apps/core/exceptions.py`**

```python
"""Global DRF exception handler: one error shape for the whole API."""

import logging
import traceback

from django.conf import settings
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .envelope import error_envelope

logger = logging.getLogger(__name__)

VALIDATION_MESSAGE = "The submitted data is invalid."
INTERNAL_MESSAGE = "An unexpected error occurred."
NON_FIELD_KEY = "non_field_errors"


def envelope_exception_handler(exc, context):
    """Map any exception raised inside a DRF view to the standard envelope."""
    exc = _to_drf_exception(exc)
    response = drf_exception_handler(exc, context)

    if response is None:
        # DRF does not recognise this exception. Returning a Response rather
        # than None is what stops it escaping as an HTML 500.
        return _internal_error_response(exc, context)

    if isinstance(exc, drf_exceptions.ValidationError):
        code, message, fields = "validation_error", VALIDATION_MESSAGE, _normalise_fields(exc.detail)
    else:
        code = getattr(exc, "default_code", "error")
        message = _first_message(exc.detail)
        fields = {}

    response.data = error_envelope(code=code, message=message, fields=fields)
    return response


def _to_drf_exception(exc):
    """Translate Django's own exceptions into their DRF equivalents."""
    if isinstance(exc, Http404):
        return drf_exceptions.NotFound()
    if isinstance(exc, DjangoPermissionDenied):
        return drf_exceptions.PermissionDenied()
    if isinstance(exc, DjangoValidationError):
        detail = getattr(exc, "message_dict", None) or exc.messages
        return drf_exceptions.ValidationError(detail=detail)
    return exc


def _normalise_fields(detail) -> dict[str, list[str]]:
    """Flatten a DRF ValidationError detail into {field: [message, ...]}."""
    if isinstance(detail, dict):
        return {str(key): _as_message_list(value) for key, value in detail.items()}
    return {NON_FIELD_KEY: _as_message_list(detail)}


def _as_message_list(value) -> list[str]:
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    if isinstance(value, dict):
        # Nested serializer: flatten one level so the client gets flat strings.
        return [f"{key}: {msg}" for key, msgs in value.items() for msg in _as_message_list(msgs)]
    return [str(value)]


def _first_message(detail) -> str:
    if isinstance(detail, dict):
        return _first_message(next(iter(detail.values()), INTERNAL_MESSAGE))
    if isinstance(detail, (list, tuple)):
        return _first_message(detail[0]) if detail else INTERNAL_MESSAGE
    return str(detail)


def _internal_error_response(exc, context):
    request = context.get("request")
    logger.exception(
        "Unhandled exception at %s", getattr(request, "path", "<unknown>"), exc_info=exc
    )
    debug = None
    if settings.DEBUG:
        debug = {
            "exception": repr(exc),
            "traceback": traceback.format_exception(type(exc), exc, exc.__traceback__),
        }
    return Response(
        error_envelope("internal_error", INTERNAL_MESSAGE, debug=debug),
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
```

The `debug` key appears **only** when `DEBUG` is true, so a production 500 leaks nothing while a dev 500 still hands the developer a traceback through the same JSON shape the frontend already parses.

**Create file: `backend/apps/core/pagination.py`**

```python
from django.conf import settings
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .envelope import success_envelope


class DefaultPageNumberPagination(PageNumberPagination):
    """Project-wide pagination. Page size from ENV, clamped to a maximum.

    `get_paginated_response` returns an `Envelope`, so the renderer passes it
    through and the pagination block lands under `meta` instead of flattening
    DRF's default count/next/previous into the top level.
    """

    page_size_query_param = "page_size"
    max_page_size = getattr(settings, "DRF_MAX_PAGE_SIZE", 100)

    def get_paginated_response(self, data):
        return Response(
            success_envelope(
                data,
                meta={
                    "pagination": {
                        "count": self.page.paginator.count,
                        "page": self.page.number,
                        "page_size": self.get_page_size(self.request),
                        "num_pages": self.page.paginator.num_pages,
                        "next": self.get_next_link(),
                        "previous": self.get_previous_link(),
                    }
                },
            )
        )
```

`page_size` itself is not set on the class — it comes from `REST_FRAMEWORK["PAGE_SIZE"]`, which task 4 wired to `DRF_PAGE_SIZE`. Setting both would create two sources of truth.

---

### 6 — Base view conventions and `GET /api/health/`

**Create file: `backend/apps/core/views.py`** (replacing the generated stub)

```python
from django.db import connection
from django.db.utils import OperationalError
from rest_framework import status, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class BaseModelViewSet(viewsets.ModelViewSet):
    """Single inheritance point for every domain ModelViewSet.

    Deliberately empty. It exists so AUTH-2 can add project-wide permission
    and filtering defaults in one place instead of editing every viewset.
    Return plain payloads from actions — the renderer adds the envelope.
    """


class HealthView(APIView):
    """Liveness probe. Reports database reachability, not just process health."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            connection.ensure_connection()
            database = "ok"
        except OperationalError:
            database = "error"

        payload = {
            "status": "ok" if database == "ok" else "degraded",
            "database": database,
        }
        code = (
            status.HTTP_200_OK
            if database == "ok"
            else status.HTTP_503_SERVICE_UNAVAILABLE
        )
        return Response(payload, status=code)
```

`HealthView` returns a **plain dict**. It must not build an envelope itself — that is the renderer's job, and a view that wraps its own payload would double-wrap. Use this as the reference for every future view.

**Create file: `backend/apps/core/serializers.py`**

```python
from rest_framework import serializers


class BaseModelSerializer(serializers.ModelSerializer):
    """Single inheritance point for every domain ModelSerializer.

    `TimeStampedModel` fields are server-managed, so they are read-only
    everywhere; declaring that once here keeps it out of every Meta block.
    """

    class Meta:
        read_only_fields = ("id", "created_at", "updated_at")
```

Subclasses that define their own `Meta` must inherit it (`class Meta(BaseModelSerializer.Meta):`) for `read_only_fields` to apply. State that in the docstring — it is the one non-obvious part of this base class.

**Create file: `backend/apps/core/urls.py`**

```python
from django.urls import path

from .views import HealthView

app_name = "core"

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
]
```

**Create file: `backend/config/api_urls.py`**

```python
"""Root of the versionless `/api/` tree.

Every domain app that exposes endpoints gets one `include()` line here. This is
the single place to look to see the API surface.
"""

from django.urls import include, path

urlpatterns = [
    path("", include("apps.core.urls")),
]
```

**File: `backend/config/urls.py`**

Edit `urlpatterns` (**lines 20–22**). This file uses **single quotes** — match it:

```python
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('config.api_urls')),
]
```

`include` must be added to the existing `from django.urls import path` line.

---

### 7 — Document the API contract and the migration workflow

**File: `README.md`**

**a. Extend the backend env table** (currently lines 216–235). Add four rows after the `JWT_*` rows, keeping the existing column order:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `CORS_ALLOWED_ORIGINS` | no | `http://localhost:5173,http://127.0.0.1:5173` | Origins allowed to call the API from a browser. |
| `CORS_ALLOW_CREDENTIALS` | no | `True` | Allow cookies/auth headers on cross-origin requests. |
| `DRF_PAGE_SIZE` | no | `25` | Default page size for list endpoints. |
| `DRF_MAX_PAGE_SIZE` | no | `100` | Ceiling for the `?page_size=` query parameter. |

**b. Add a new `## API conventions` section** after `## 5. Run both apps together` (currently ends at line 209, before `## Environment variables`). It must contain:

1. The **success** envelope, as a fenced `json` block with a real example from `GET /api/health/`:

   ```json
   {
     "success": true,
     "data": { "status": "ok", "database": "ok" },
     "error": null,
     "meta": null
   }
   ```

2. The **error** envelope, with a real validation example:

   ```json
   {
     "success": false,
     "data": null,
     "error": {
       "code": "validation_error",
       "message": "The submitted data is invalid.",
       "fields": { "email": ["Enter a valid email address."] }
     },
     "meta": null
   }
   ```

3. The **paginated** envelope, showing `meta.pagination` with `count`, `page`, `page_size`, `num_pages`, `next`, `previous`.
4. A table of **error codes** → HTTP status: `validation_error` 400, `parse_error` 400, `not_authenticated` 401, `authentication_failed` 401, `permission_denied` 403, `not_found` 404, `method_not_allowed` 405, `not_acceptable` 406, `unsupported_media_type` 415, `throttled` 429, `internal_error` 500.
5. The rule for view authors, stated as a rule: **return plain payloads; never build an envelope in a view.** The renderer wraps successes, the exception handler wraps failures. Raise DRF exceptions rather than returning hand-built error bodies.
6. A note that `error.debug` appears **only when `DEBUG` is true** and must never be relied on by client code.

**c. Add a `### Migrations` subsection under `## 3. Backend setup`** (which currently ends at line 164):

```powershell
python manage.py makemigrations           # after changing any models.py
python manage.py migrate                  # apply to local PostgreSQL
python manage.py makemigrations --check --dry-run   # CI guard: fails if a model change has no migration
python manage.py showmigrations           # what is applied
python manage.py migrate <app> <number>   # roll one app back
```

State plainly: **the domain apps have no models yet, so `makemigrations` correctly reports `No changes detected`.** `apps.core.TimeStampedModel` is abstract and produces no migration. Do not hand-write an empty initial migration to make the tree "look complete" — the first real migration arrives with the first domain model. Add the rule that a migration is committed **in the same commit** as the model change that caused it.

---

### 8 — No frontend changes

`frontend/` is untouched by this story. The TypeScript types mirroring this envelope, the Axios instance that unwraps `data`, and the interceptor that reads `error.code`/`error.fields` are all **FND-3**. Do not start them here — but do not change the envelope shape afterwards without updating FND-3's plan, because that story is written against exactly the JSON above.

---

## Edge Cases & Failure Modes

- **`204 No Content` with a body.** Trigger: a `DELETE` action returning `Response(status=204)`. HTTP forbids a body; a naive renderer would emit `{"success":true,...}`. Handled by the status check in `EnvelopeJSONRenderer.render` (`backend/apps/core/renderers.py`), which returns `b""` for 204 and 304. Covered by test 4.
- **Endpoint payload that itself contains a `success` key.** Trigger: any future serializer with a boolean field named `success`. A key-sniffing renderer would treat it as pre-wrapped and skip the envelope. Handled by making `Envelope` a `dict` **subclass** and testing with `isinstance`, never by probing keys. Covered by test 3.
- **Double-wrapping.** Trigger: a view that helpfully calls `success_envelope()` itself. The renderer sees an `Envelope` and passes it through, so the result is correct but the view is wrong. The convention is documented in `HealthView`'s docstring and in README § API conventions; there is no runtime guard.
- **Unhandled non-API exception in a DRF view.** Trigger: a `KeyError` in a serializer's `to_representation`. DRF's stock handler returns `None`, which would let it escape as an HTML 500 and break "errors are uniform". Handled by `_internal_error_response` returning a real `Response`. The traceback is included **only** when `DEBUG` is true. Covered by tests 8 and 9.
- **Exceptions raised outside a DRF view.** Trigger: a failure in middleware, in `/admin/`, or in a Django (non-DRF) view. `EXCEPTION_HANDLER` is never consulted, so the response is Django's normal HTML error page. This is a real, accepted limitation — the envelope contract covers the `/api/` tree, not the whole WSGI app. State it in README § API conventions so no one debugs it as a bug.
- **`Http404` from `get_object_or_404`.** Trigger: any detail route with a bad pk. Django's `Http404` is not a DRF exception. Translated by `_to_drf_exception` into `NotFound` → `not_found` / 404. Covered by test 6.
- **Django's `PermissionDenied` and `ValidationError`, not DRF's.** Trigger: model `full_clean()` or a `@permission_required` decorator. Both are translated in `_to_drf_exception`; the Django `ValidationError` path uses `message_dict` when the error is field-scoped and falls back to `messages` when it is not. Covered by tests 7 and 10.
- **`ValidationError` raised with a bare string or list.** Trigger: `raise ValidationError("Too late.")` — there is no field name to key on. `_normalise_fields` puts it under `non_field_errors`. Covered by test 5.
- **Nested serializer validation errors.** Trigger: a writable nested serializer failing two levels down; `detail` is a dict of dicts. `_as_message_list` flattens one level into `"key: message"` strings so `fields` stays `{str: [str]}` and the frontend never has to walk a tree. Deeper nesting flattens to a repr — acceptable, and documented here rather than solved speculatively.
- **`Throttled` responses lose `Retry-After`.** Trigger: throttling once AUTH-2 configures it. `response.data` is reassigned but headers are not touched, so DRF's `Retry-After` survives. Verify with test 11 before any throttle class ships.
- **`406 Not Acceptable` from a browser.** Trigger: opening `http://127.0.0.1:8000/api/health/` in a browser, which sends `Accept: text/html`. With only `EnvelopeJSONRenderer` registered, DRF raises `NotAcceptable`. The handler still envelopes it, but DRF must pick *some* renderer to serialise the error — confirm the body is JSON and not an exception-during-exception. Covered by test 12.
- **Malformed JSON request body.** Trigger: `curl -d '{'`. Raises `ParseError` → `parse_error` / 400 in envelope form. Covered by test 13.
- **CORS preflight must not be enveloped.** Trigger: the browser's `OPTIONS` request before a cross-origin `POST`. `CorsMiddleware` answers it before DRF runs, so the response has no body and no envelope — correct. This is why the middleware must be **first** in `MIDDLEWARE`; placing it below `CommonMiddleware` produces preflight failures that look like network errors in the browser. Covered by test 15.
- **`?page_size=100000`.** Trigger: a client trying to dump a table. `max_page_size` clamps it to `DRF_MAX_PAGE_SIZE`. Covered by test 17.
- **`?page=9999` beyond the last page.** DRF raises `NotFound`, which becomes a `not_found` 404 envelope rather than an empty 200. Covered by test 18.
- **Nested app label wrong.** Trigger: leaving `startapp`'s generated `name = "customers"` while the package is at `apps/customers`. Symptom at startup: `ModuleNotFoundError: No module named 'customers'`. All thirteen `apps.py` files must carry the `apps.` prefix. Covered by test 1.
- **Duplicate app labels.** Trigger: adding a future app whose last dotted component collides with an existing label. Symptom: `django.core.exceptions.ImproperlyConfigured: Application labels aren't unique`. `manage.py check` catches it — Verification Step 1.
- **`makemigrations` produces nothing.** Trigger: running it right after this story. Expected and correct — twelve apps have no models and `TimeStampedModel` is abstract. **Do not** create an empty initial migration to compensate. Enforced by test 19 (`makemigrations --check` is clean).
- **Health endpoint when PostgreSQL is down.** Trigger: stop the service, then `GET /api/health/`. `ensure_connection()` raises `OperationalError`, caught to return `503` with `{"status": "degraded", "database": "error"}` in envelope form — not a 500 traceback. Covered by test 20. Note that `psycopg` can raise on the *first query* rather than on connect, so assert the status code, not the exception type.
- **Security: the API is open.** `DEFAULT_PERMISSION_CLASSES` is `AllowAny` and `DEFAULT_AUTHENTICATION_CLASSES` is empty for this story, so every endpoint added before AUTH-2 is world-readable. Only `/api/health/` exists today, so nothing is exposed yet — but **any story that adds an endpoint before AUTH-2 must set `permission_classes` explicitly on that view.** Flag it in the AUTH-2 plan as a sweep: flip the global default to `IsAuthenticated` and audit every view for an unintended `AllowAny`.

---

## Test Plan

Django's built-in test runner, matching story 01. Do **not** add pytest or DRF's `APITestCase` where a `SimpleTestCase` suffices — tests 1–13 need no database, and keeping them DB-free means they still run before the `supportos` role exists.

**Create file: `backend/apps/core/tests/__init__.py`** — empty.

**Create file: `backend/apps/core/tests/test_envelope.py`** — `SimpleTestCase`.

1. `test_all_domain_apps_are_installed`: assert every one of the thirteen `apps.*` strings from `LOCAL_APPS` is in `settings.INSTALLED_APPS`, and that `django.apps.apps.get_app_config(label)` resolves for each of `core`, `customers`, `tickets`, `communications`, `agents`, `sla`, `knowledge_base`, `portal`, `reports`, `ai`, `integrations`, `accounts`, `organization`. Catches the missing `apps.` prefix in any `apps.py`.
2. `test_success_envelope_shape`: `success_envelope({"a": 1})` has exactly the keys `success`, `data`, `error`, `meta`; `success is True`; `error is None`.
3. `test_renderer_does_not_double_wrap_payload_with_success_key`: render `{"success": "yes", "id": 3}` and assert the result is `{"success": True, "data": {"success": "yes", "id": 3}, ...}`. This is the `isinstance(Envelope)` guard.
4. `test_renderer_returns_empty_body_for_204_and_304`: render with a stub response at each status; assert `b""`.
5. `test_error_envelope_fields_always_dict`: `error_envelope("x", "y")["error"]["fields"] == {}`.

**Create file: `backend/apps/core/tests/test_exceptions.py`** — `SimpleTestCase`, driving `envelope_exception_handler` directly with a context built from `APIRequestFactory`.

6. `test_http404_maps_to_not_found`: pass `Http404()`; assert status 404 and `error.code == "not_found"`.
7. `test_django_permission_denied_maps_to_403`: pass `django.core.exceptions.PermissionDenied()`; assert 403 / `permission_denied`.
8. `test_unhandled_exception_returns_500_envelope`: pass `KeyError("boom")`; assert 500, `error.code == "internal_error"`, and `error.message == "An unexpected error occurred."`.
9. `test_traceback_only_present_when_debug`: same `KeyError` under `override_settings(DEBUG=False)` → `"debug" not in error`; under `DEBUG=True` → `error["debug"]["traceback"]` is a non-empty list. This is the leak guard.
10. `test_drf_validation_error_dict_becomes_fields`: `ValidationError({"email": ["Enter a valid email address."]})` → `error.fields == {"email": ["Enter a valid email address."]}` and `error.code == "validation_error"`.
11. `test_validation_error_string_goes_to_non_field_errors`: `ValidationError("Too late.")` → `error.fields == {"non_field_errors": ["Too late."]}`.
12. `test_throttled_keeps_retry_after_header`: pass `Throttled(wait=30)`; assert 429, `error.code == "throttled"`, and that the response's `Retry-After` header survived the `response.data` reassignment.

**Create file: `backend/apps/core/tests/test_health.py`** — `APITestCase` (needs the database).

13. `test_health_returns_envelope`: `GET /api/health/` → 200; body has all four envelope keys; `data == {"status": "ok", "database": "ok"}`; `error is None`. This is the intake's literal outcome for task 2.
14. `test_health_reverses_by_name`: `reverse("core:health") == "/api/health/"`. Pins the URL so FND-3 can hardcode it.
15. `test_html_accept_header_returns_json_envelope`: `self.client.get("/api/health/", HTTP_ACCEPT="text/html")` → 406, and `response.json()["error"]["code"] == "not_acceptable"`. Proves the exception path can still serialise when content negotiation itself failed.
16. `test_malformed_json_body_returns_parse_error`: `POST /api/health/` with `data="{"`, `content_type="application/json"` → the body is parsed before method dispatch, so assert 400 with `error.code == "parse_error"`. If DRF returns 405 first, assert 405/`method_not_allowed` instead and record which — either is uniform, and the point is that it is enveloped.
17. `test_cors_preflight_has_no_envelope`: `self.client.options("/api/health/", HTTP_ORIGIN="http://localhost:5173", HTTP_ACCESS_CONTROL_REQUEST_METHOD="GET")` → `Access-Control-Allow-Origin` header present and the body empty. Fails if `CorsMiddleware` is not first in `MIDDLEWARE`.
18. `test_health_reports_degraded_when_database_unreachable`: patch `apps.core.views.connection.ensure_connection` to raise `OperationalError`; assert 503, `data["database"] == "error"`, `data["status"] == "degraded"`, and that the body is still an envelope.

**Create file: `backend/apps/core/tests/test_pagination.py`** — `APITestCase`, exercising `DefaultPageNumberPagination` against a throwaway `APIView` registered on a test-only urlconf (`@override_settings(ROOT_URLCONF=__name__)`), paginating a plain list. No model is needed, so this does not depend on any domain app having one.

19. `test_paginated_response_puts_pagination_in_meta`: assert `meta["pagination"]` has exactly `count`, `page`, `page_size`, `num_pages`, `next`, `previous`, and that `data` is the page's items — **not** DRF's default flat `{count, next, previous, results}`.
20. `test_page_size_query_param_is_clamped_to_max`: request `?page_size=100000`; assert `meta["pagination"]["page_size"] == settings.DRF_MAX_PAGE_SIZE`.
21. `test_page_out_of_range_returns_not_found_envelope`: request `?page=9999`; assert 404 and `error.code == "not_found"`.

**File: `backend/config/tests/test_settings.py`** — extend the existing module with a new class alongside the five already there.

22. `class DrfSettingsTests(SimpleTestCase)` — assert `settings.REST_FRAMEWORK["EXCEPTION_HANDLER"] == "apps.core.exceptions.envelope_exception_handler"`, that `DEFAULT_RENDERER_CLASSES` is exactly `["apps.core.renderers.EnvelopeJSONRenderer"]` (so no one silently re-adds `BrowsableAPIRenderer`), that `PAGE_SIZE == settings.DRF_PAGE_SIZE`, and that `"corsheaders.middleware.CorsMiddleware"` is `settings.MIDDLEWARE[0]`.
23. `test_no_pending_migrations`: shell out to `call_command("makemigrations", "--check", "--dry-run")` and assert it does not raise `SystemExit`. Encodes "migrations are committed with their model change" as a test rather than a README sentence.

---

## Migration / Rollback

**Schema.** This story adds **no tables**. The twelve domain apps have no models; `apps.core.TimeStampedModel` is `abstract = True`. `INSTALLED_APPS` grows by fifteen entries, but `migrate` finds nothing new to apply and `django_migrations` is untouched. Adding `rest_framework` and `corsheaders` introduces no migrations of their own.

**Rollback.** Revert the commit. Because no migration ran, there is no database state to unwind — the only cleanup is `pip uninstall djangorestframework django-cors-headers`, and leaving them installed is harmless.

**What could go wrong on a half-applied state.** The dangerous window is between editing `INSTALLED_APPS` and fixing all thirteen `apps.py` files: Django refuses to start with `ModuleNotFoundError: No module named 'customers'`, which looks like a missing package rather than a wrong `name` string. Do tasks 1 and 2 — including every `apps.py` edit — **before** task 4's `INSTALLED_APPS` change, and `manage.py check` stays green throughout.

The second trap is ordering `MIDDLEWARE` wrongly. A `CorsMiddleware` placed below `CommonMiddleware` still starts cleanly and passes every backend test, then fails only in a real browser as an opaque CORS error during FND-3. Test 17 is the guard; do not skip it because "CORS is just config".

---

## Verification Steps

1. **Backend builds:** from `backend/` with the venv active — `python manage.py check` — reports `System check identified no issues (0 silenced).` This is the gate for all thirteen app labels resolving.
2. **No pending migrations:** from `backend/` — `python manage.py makemigrations --check --dry-run` — exits 0 printing `No changes detected`.
3. **Migrations apply:** from `backend/` — `python manage.py migrate` — succeeds against local PostgreSQL. (Requires the `supportos` role from README § 2 — see Prerequisites.)
4. **Tests pass:** from `backend/` — `python manage.py test` — all of story 01's 7 tests plus this story's new tests green. Run `python manage.py test apps.core config` if you want to scope it.
5. **Health endpoint returns the envelope:** with `python manage.py runserver` up —

   ```powershell
   curl.exe -s http://127.0.0.1:8000/api/health/
   ```

   returns exactly:

   ```json
   {"success":true,"data":{"status":"ok","database":"ok"},"error":null,"meta":null}
   ```

6. **Errors are uniform:** `curl.exe -s -i http://127.0.0.1:8000/api/nope/` → `404` whose body is `{"success":false,"data":null,"error":{"code":"not_found",...},"meta":null}`. Then `curl.exe -s -i -X POST http://127.0.0.1:8000/api/health/` → a `405` in the same shape. Two different failures, one body shape.
7. **CORS works from the real frontend origin:**

   ```powershell
   curl.exe -s -i -X OPTIONS http://127.0.0.1:8000/api/health/ -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: GET"
   ```

   response includes `Access-Control-Allow-Origin: http://localhost:5173`.
8. **Regression — story 01 still holds:** `python manage.py test config` green, `git ls-files` lists no `.env`, and `head -8 .gitignore` still matches the squad-kit managed block.

---

## Done Criteria

- [ ] `backend/apps/` contains `core` plus the twelve domain apps from the intake, each with `name = "apps.<domain>"` in its `apps.py` and no leftover `tests.py` stub.
- [ ] `backend/apps/README.md` states the one-app-per-business-area rule, the decision list for where new code goes, what belongs in `core`, and the twelve-app scope table.
- [ ] `INSTALLED_APPS` is grouped `DJANGO_APPS` / `THIRD_PARTY_APPS` / `LOCAL_APPS`, and the `# Domain apps are added by FND-2` placeholder comment is gone.
- [ ] `REST_FRAMEWORK` registers `EnvelopeJSONRenderer`, `envelope_exception_handler`, and `DefaultPageNumberPagination`; `PAGE_SIZE` comes from `DRF_PAGE_SIZE`.
- [ ] `corsheaders.middleware.CorsMiddleware` is the **first** entry in `MIDDLEWARE`.
- [ ] Every success response is wrapped by the renderer and every error by the handler — including unhandled exceptions, which return a `500` envelope and log via `logger.exception`.
- [ ] `error.debug` is present when `DEBUG` is true and absent when it is false (test 9).
- [ ] `GET /api/health/` returns `{"success":true,"data":{"status":"ok","database":"ok"},"error":null,"meta":null}` (Verification Step 5).
- [ ] `GET /api/nope/` and `POST /api/health/` return the same error envelope shape with different codes (Verification Step 6).
- [ ] Paginated responses put `count`/`page`/`page_size`/`num_pages`/`next`/`previous` under `meta.pagination`, not at the top level.
- [ ] `README.md` documents the success, error, and paginated envelopes, the error-code → status table, the "return plain payloads; never build an envelope in a view" rule, and the `makemigrations`/`migrate` workflow.
- [ ] The four new env vars are in **both** `backend/.env.example` and the README table.
- [ ] `python manage.py check` and `makemigrations --check --dry-run` are both clean (Verification Steps 1–2).
- [ ] `python manage.py test` is green, story 01's 7 tests included (Verification Step 4).
- [ ] No model, serializer, or endpoint was added to any domain app.
- [ ] `00-overview.md` updated with this story.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 03 (FND-3 — Frontend Foundation).**
