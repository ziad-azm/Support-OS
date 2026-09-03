"""
Shared Django settings for SupportOS.

Every value that differs between machines or environments is read from the
environment (see ENV in `SupportOs backlog.MD`). Nothing in this file may
carry a secret literal.

Environment-specific overrides live in `dev.py` and `prod.py`; select one with
DJANGO_SETTINGS_MODULE.
"""

import logging
from datetime import timedelta
from pathlib import Path

import environ

# base.py lives at <repo>/backend/config/settings/base.py, so parents[2] == <repo>/backend
BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

# No default: a missing key must fail loudly at import time, not silently start
# the app with a throwaway secret.
SECRET_KEY = env("DJANGO_SECRET_KEY")

DEBUG = False
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=[])


# Application definition

DJANGO_APPS = [
    # Must precede django.contrib.staticfiles — Channels' own documented
    # setup requirement — so manage.py runserver becomes ASGI/WebSocket-aware.
    "daphne",
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
    "rest_framework_simplejwt.token_blacklist",
    "channels",
    "django_celery_beat",
    "drf_spectacular",
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
    "apps.notifications",
    "apps.knowledge_base",
    "apps.portal",
    "apps.reports",
    "apps.ai",
    "apps.integrations",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    # Must sit above CommonMiddleware so preflight responses are not rewritten.
    "corsheaders.middleware.CorsMiddleware",
    # PROD-1: as high as possible so every line logged below is correlated —
    # but NOT above CorsMiddleware, which config/tests/test_settings.py:96-99
    # pins at index 0. See CONVENTIONS.md § 34.
    "apps.core.middleware.RequestIDMiddleware",
    "apps.core.middleware.AccessLogMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # Must sit after SessionMiddleware and before CommonMiddleware.
    # Resolves the active language from the Accept-Language header.
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database — local PostgreSQL, no Docker required.
# Discrete POSTGRES_* variables rather than a DATABASE_URL, so passwords
# containing @ : / # need no percent-encoding.

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB"),
        "USER": env("POSTGRES_USER"),
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", default="localhost"),
        "PORT": env.int("POSTGRES_PORT", default=5432),
        "CONN_MAX_AGE": env.int("POSTGRES_CONN_MAX_AGE", default=0),
    }
}


# Password validation

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization

LANGUAGE_CODE = "en-us"
LANGUAGES = [
    ("en", "English"),
    ("ar", "Arabic"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = env("DJANGO_TIME_ZONE", default="UTC")
USE_I18N = True
USE_TZ = True


# Static files

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# --- Media / Attachments (CUST-4) -------------------------------------------
# Local filesystem storage — no S3/cloud dependency, matching this project's
# "Docker is deliberately absent" stance (requirements.txt). No MEDIA_URL:
# attachments are served exclusively through AttachmentViewSet.download
# (permission-gated), never through Django's own unguarded static/media
# serving. See Story 21 `## Prerequisites`.
# `.strip() or ...` rather than `default=...`: `.env`/`.env.example` both
# ship `MEDIA_ROOT=` (present but blank), and django-environ treats a
# present-blank value as set, so a plain `default=` never fires — the same
# footgun `JWT_SIGNING_KEY` below already guards against. Without this,
# `MEDIA_ROOT` silently resolved to the process's cwd (e.g.
# `backend/attachments/...` instead of `backend/media/attachments/...`) —
# confirmed live, and outside `.gitignore`'s `backend/media/` exclusion.
MEDIA_ROOT = Path(env("MEDIA_ROOT", default="").strip() or str(BASE_DIR / "media"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# JWT env contract, staged for AUTH-1. Story 08 (AUTH-1) is what reads these.
# `or SECRET_KEY` rather than `default=SECRET_KEY`: .env.example ships
# `JWT_SIGNING_KEY=` (present but blank), and django-environ treats a blank value
# as a value, so a plain default would never fire.
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
    # the concurrency hazard this creates on the frontend and how the
    # frontend's refreshAccessToken() avoids it.
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "SIGNING_KEY": JWT_SIGNING_KEY,
}


# --- CORS ---------------------------------------------------------------
# The Vite dev server runs on a different origin from Django, so the browser
# needs these headers to let the frontend call the API at all.
CORS_ALLOWED_ORIGINS = env.list(
    "CORS_ALLOWED_ORIGINS", default=["http://localhost:5173", "http://127.0.0.1:5173"]
)
CORS_ALLOW_CREDENTIALS = env.bool("CORS_ALLOW_CREDENTIALS", default=True)
# django-cors-headers' own default list, plus accept-language: the frontend
# sends it so the backend can localise via LocaleMiddleware (CONVENTIONS.md
# §18). Verified the default list omits it.
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-language",
    "authorization",
    "content-type",
    "user-agent",
    "x-csrftoken",
    "x-request-id",
    "x-requested-with",
]

# PROD-1: the two halves are NOT symmetrical. CORS_ALLOW_HEADERS above lets
# the browser SEND X-Request-ID; this lets JavaScript READ it back off the
# response. Omit it and the browser hides the header from JS with no console
# warning — which reads exactly like "the backend isn't sending it".
CORS_EXPOSE_HEADERS = ["x-request-id"]

# --- Frontend (SEC-5) ----------------------------------------------------
# Used to build the "set your password" link in SEC-5's invite email
# (apps/accounts/tasks.py::send_invite_email). Same default origin
# CORS_ALLOWED_ORIGINS above already allows for local dev.
FRONTEND_URL = env("FRONTEND_URL", default="http://localhost:5173")


# --- DRF ----------------------------------------------------------------
# The renderer and the exception handler together are the `API` contract: every
# response body — success or failure — leaves this app in envelope form.
# BrowsableAPIRenderer is deliberately absent: a browser hitting an API URL gets
# a 406 in envelope form rather than an HTML page that bypasses the contract.
DRF_PAGE_SIZE = env.int("DRF_PAGE_SIZE", default=25)
DRF_MAX_PAGE_SIZE = env.int("DRF_MAX_PAGE_SIZE", default=100)

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": [
        "apps.core.renderers.EnvelopeJSONRenderer",
    ],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    # OrderingFilter is what makes the frontend's `?ordering=field` /
    # `?ordering=-field` contract real — see CONVENTIONS.md §19 and
    # frontend/src/shared/ui/data-table/useServerTable.ts. SearchFilter does
    # the same for `?search=`. Both are inert until a view declares
    # `ordering_fields` / `search_fields` (or OrderingFilter falls back to its
    # serializer's fields), so adding them globally changes nothing for
    # existing views. DRF core — no new package.
    "DEFAULT_FILTER_BACKENDS": [
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.envelope_exception_handler",
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPageNumberPagination",
    "PAGE_SIZE": DRF_PAGE_SIZE,
    # AUTH-1 fills in authentication (this block). AUTH-2 tightens permissions
    # to IsAuthenticated and audits every view. Until then request.user
    # resolves correctly wherever a valid token is presented, but the API
    # stays open by default — any endpoint that must be protected sets
    # permission_classes explicitly on its own view. See CONVENTIONS.md §13.
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
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    # SEC-7: the request endpoint is the only throttled view in this
    # project today. Keyed by IP for an anonymous caller (DRF's own
    # `ScopedRateThrottle` default `get_ident` behavior) — a plain
    # constant, not an ENV var, the same internal-tuning-knob reasoning
    # `apps.accounts.tokens.RESET_TOKEN_MAX_AGE_SECONDS` documents for
    # itself.
    "DEFAULT_THROTTLE_RATES": {"password_reset_request": "5/hour"},
}


# --- Logging (PROD-1) ----------------------------------------------------
# Without this, `apps.*` loggers have no handler and fall through to Python's
# lastResort handler: WARNING+ only, no timestamp, no level, no logger name.
#
# Two formatters, one handler. `text` is the dev default because a human reads
# that stream; `json` is the prod default (set in prod.py) because a collector
# reads that one. ContextFilter is on the HANDLER, so every logger below
# inherits request correlation without declaring it. See CONVENTIONS.md § 34.
DJANGO_LOG_LEVEL = env("DJANGO_LOG_LEVEL", default="INFO")
DJANGO_LOG_FORMAT = env("DJANGO_LOG_FORMAT", default="text")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "context": {"()": "apps.core.logging.ContextFilter"},
    },
    "formatters": {
        # `{request_id}` only resolves because ContextFilter runs on the
        # handler and sets it on EVERY record. Move that filter onto a logger
        # and this format raises ValueError on every line it does not cover.
        "text": {
            "format": "{asctime} {levelname} {name} [{request_id}] {message}",
            "style": "{",
        },
        "json": {
            "()": "apps.core.logging.JsonFormatter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "filters": ["context"],
            "formatter": DJANGO_LOG_FORMAT,
        },
        # A logger with NO handler and propagate=False does not go quiet: it
        # falls to `logging.lastResort`, a WARNING-level stderr handler that
        # prints the bare message with no formatting. Silencing a logger
        # therefore needs an explicit NullHandler, not an empty list.
        "null": {
            "class": "logging.NullHandler",
        },
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        # Our own code. `apps.core.exceptions` logs every unhandled 500 here,
        # and `apps.core.middleware` logs every request here.
        "apps": {
            "handlers": ["console"],
            "level": DJANGO_LOG_LEVEL,
            "propagate": False,
        },
        # PROD-1: `config.celery` lives outside the `apps` tree, so without
        # this entry it falls through to root (WARNING) and its INFO lines are
        # silently dropped — which would have turned removing debug_task's
        # print() into a regression of the SLA-0 smoke test.
        "config": {
            "handlers": ["console"],
            "level": DJANGO_LOG_LEVEL,
            "propagate": False,
        },
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        # 4xx/5xx raised by Django itself; ERROR keeps normal 404 noise out.
        # Logs `request.path`, not the full path — verified in Django's own
        # `log_response`, so no query string reaches this line.
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        # PROD-1: SILENCED, and this is a secrets fix, not tidying. Channels'
        # runserver access log prints the FULL path — query string included —
        # so `?token=<EMAIL_INBOUND_WEBHOOK_TOKEN>` (COMM-1) landed in stdout
        # on every inbound-email delivery, in plain violation of § 10.
        # AccessLogMiddleware now logs every request with the same method,
        # path, and status (plus duration and user, minus the query string),
        # so this logger was also a duplicate line per request. No handler and
        # no propagation. Daphne's own lifecycle messages ("Starting server
        # at ...", "Listening on ...") come from the `daphne` logger and are
        # unaffected. See CONVENTIONS.md § 34.
        "django.channels.server": {
            "handlers": ["null"],
            "propagate": False,
        },
        # SLA-0's worker. Routed here so a task's log line is formatted and
        # correlated (celery_task_id) the same way a request's is.
        "celery": {
            "handlers": ["console"],
            "level": DJANGO_LOG_LEVEL,
            "propagate": False,
        },
    },
}


# --- Email (COMM-1) -------------------------------------------------------
# Outbound uses Django's own SMTP backend. EMAIL_BACKEND itself is NOT read
# from ENV — dev.py hardcodes the console backend so local development can
# never accidentally send a real email; prod.py hardcodes SMTP. These six
# settings remain for SYSTEM email only (invite/password-reset —
# apps.accounts.tasks — and notification email — apps.notifications.tasks).
# Ticket-reply email now reads its own DB-stored config instead
# (apps.communications.models.EmailProviderConfig, INT-3, Story 82) — a
# deliberately narrower scope than "every outbound email", confirmed with
# the user during that story's planning. See CONVENTIONS.md § 31.
EMAIL_HOST = env("EMAIL_HOST", default="")
EMAIL_PORT = env.int("EMAIL_PORT", default=587)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", default="support@example.com")

# Inbound routing: a reply lands on `{EMAIL_INBOUND_LOCAL_PART}+<ticket
# id>@{EMAIL_INBOUND_DOMAIN}`. See apps/communications/email_adapter.py.
EMAIL_INBOUND_LOCAL_PART = env("EMAIL_INBOUND_LOCAL_PART", default="support")
EMAIL_INBOUND_DOMAIN = env("EMAIL_INBOUND_DOMAIN", default="support.example.com")
# No safe default: an empty token makes EmailInboundWebhookView reject every
# request (fail closed), rather than crash the app at import time over an
# optional feature that may not be configured yet.
EMAIL_INBOUND_WEBHOOK_TOKEN = env("EMAIL_INBOUND_WEBHOOK_TOKEN", default="")


# --- WhatsApp (COMM-2) -----------------------------------------------------
# Meta's WhatsApp Business (Cloud) API. Send credentials
# (api_base_url/phone_number_id/access_token) moved to a DB-backed config —
# apps.communications.models.WhatsAppProviderConfig, INT-3 (Story 82) — read
# by WhatsAppAdapter.send(), which refuses to run against blank config
# exactly as it did against these settings before the move. Only the two
# inbound-only webhook secrets remain here: neither is read by any adapter,
# so neither is "a credential reused by a channel adapter" (CONVENTIONS.md
# § 31).
# Fail closed: GET verification handshake rejects every request until set.
WHATSAPP_WEBHOOK_VERIFY_TOKEN = env("WHATSAPP_WEBHOOK_VERIFY_TOKEN", default="")
# Fail closed: POST signature verification rejects every request until set.
WHATSAPP_APP_SECRET = env("WHATSAPP_APP_SECRET", default="")

# --- Live Chat / Channels (COMM-3) ------------------------------------------
# Django Channels' ASGI entrypoint and channel layer. InMemoryChannelLayer is
# single-process only — a deliberate scope limit, unrelated to Celery's own
# Redis broker (below, SLA-0): Redis entered this project through Celery,
# and CHANNEL_LAYERS does not (yet) reuse it. See Story 16 `## Prerequisites`
# and Story 27 `## Prerequisites`.
ASGI_APPLICATION = "config.asgi.application"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

# --- SMS (COMM-4) ------------------------------------------------------------
# Twilio's Programmable Messaging API. Send credentials
# (api_base_url/account_sid/auth_token/from_number) moved to a DB-backed
# config — apps.communications.models.SmsProviderConfig, INT-3 (Story 82).
# `auth_token` is dual-purpose in Twilio's own model — SMSAdapter.send()
# (outbound Basic Auth) and SMSInboundWebhookView (inbound
# X-Twilio-Signature verification) both now read the same DB-stored value,
# not this settings module. See CONVENTIONS.md § 31.
# The exact URL configured in the Twilio console for this webhook — used to
# verify X-Twilio-Signature. Not reconstructed from the request: Twilio's
# algorithm signs the URL it was told to POST to, and a proxy/tunnel
# rewriting Host would otherwise break every signature check silently. Stays
# an ENV setting: a fixed, deployment-level URL, not a rotatable credential.
SMS_WEBHOOK_URL = env("SMS_WEBHOOK_URL", default="")

# --- Background jobs (SLA-0) -------------------------------------------------
# The shared async/scheduled-job foundation SLA, escalation, notifications,
# AI, and integrations all build on (SupportOs backlog.MD:460). Redis is
# both broker and result backend — one new locally-installed service,
# documented in README § 6 exactly like PostgreSQL (§ 1), never Docker.
CELERY_BROKER_URL = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = env("REDIS_URL", default="redis://localhost:6379/0")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
# django-celery-beat: the periodic-task schedule lives in the database,
# editable via /admin/ (PeriodicTask, IntervalSchedule, CrontabSchedule —
# all registered by the package itself, no admin code to write here), not a
# hardcoded `beat_schedule` dict — so a future scheduled job (e.g. SLA-3's
# escalation evaluation) is configured without a settings deploy.
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# --- AI (AI-0) ------------------------------------------------------------
# The one server-side AI integration point every AI-1..AI-5 story calls
# (SupportOs backlog.MD:822) — apps/ai/client.py, never a second
# `import anthropic` anywhere else in this codebase. Read explicitly via
# env(), the same WHATSAPP_*/SMS_* pattern (above), rather than relying on
# the anthropic SDK's own ANTHROPIC_API_KEY auto-discovery — this project
# reads every environment-differing value the same explicit way. No safe
# default: apps/ai/client.py::get_client refuses to construct a client
# against a blank key, the same "fail closed until configured" rule
# WHATSAPP_*/SMS_* already establish. See Story 74 `## Edge Cases`.
# Which provider apps/ai/client.py::get_client constructs — an explicit
# switch, not "whichever key happens to be set": with both keys populated,
# AI_PROVIDER alone decides, so a stale second key left in .env can never
# silently take over. Only "anthropic" or "gemini" are valid; get_client
# raises AIServiceError on anything else, and also when the API key for
# the selected provider is blank — the same "fail closed until
# configured" rule WHATSAPP_*/SMS_* already establish.
AI_PROVIDER = env("AI_PROVIDER", default="anthropic")
ANTHROPIC_API_KEY = env("ANTHROPIC_API_KEY", default="")
# Overridable per environment so a later AI-* story (or an ops change) can
# trade cost for quality without a code change — no feature hardcodes a
# model id of its own.
AI_MODEL = env("AI_MODEL", default="claude-opus-5")
GEMINI_API_KEY = env("GEMINI_API_KEY", default="")
GEMINI_MODEL = env("GEMINI_MODEL", default="gemini-3.6-flash")

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


# --- Error monitoring (PROD-1) -------------------------------------------
# Entirely inert with SENTRY_DSN unset, which is the default in .env.example
# and therefore in every existing clone: no network call, no import beyond
# this module, no behaviour change.
#
# Initialised HERE and not in apps/core/apps.py::ready(), unlike Story 80's
# `from . import authentication`: that pattern exists to make a decorator
# register, and `ready()` runs after the app registry is built. Sentry must be
# armed before that, or an exception raised while Django is still loading apps
# — a bad migration import, a broken settings-dependent module — is exactly
# the failure it never sees. See CONVENTIONS.md § 34.
SENTRY_DSN = env("SENTRY_DSN", default="")
SENTRY_ENVIRONMENT = env("SENTRY_ENVIRONMENT", default="local")
# Errors only. Performance tracing is PROD-2's decision, not this story's.
SENTRY_TRACES_SAMPLE_RATE = env.float("SENTRY_TRACES_SAMPLE_RATE", default=0.0)

if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    from apps.core.monitoring import before_send

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=SENTRY_ENVIRONMENT,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            # ERROR+ becomes an event; INFO+ becomes a breadcrumb. This is what
            # makes the access log show up as context on a 500.
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        # CONVENTIONS.md § 10: no emails, no usernames, no IPs, no bodies.
        send_default_pii=False,
        max_request_body_size="never",
        before_send=before_send,
    )
