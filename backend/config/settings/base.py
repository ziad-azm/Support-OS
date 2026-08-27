"""
Shared Django settings for SupportOS.

Every value that differs between machines or environments is read from the
environment (see ENV in `SupportOs backlog.MD`). Nothing in this file may
carry a secret literal.

Environment-specific overrides live in `dev.py` and `prod.py`; select one with
DJANGO_SETTINGS_MODULE.
"""

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

AUTH_USER_MODEL = "accounts.User"

MIDDLEWARE = [
    # Must sit above CommonMiddleware so preflight responses are not rewritten.
    "corsheaders.middleware.CorsMiddleware",
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
MEDIA_ROOT = Path(env("MEDIA_ROOT", default=str(BASE_DIR / "media")))

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
    "x-requested-with",
]


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
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}


# --- Logging -------------------------------------------------------------
# Without this, `apps.*` loggers have no handler and fall through to Python's
# lastResort handler: WARNING+ only, no timestamp, no level, no logger name.
DJANGO_LOG_LEVEL = env("DJANGO_LOG_LEVEL", default="INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{asctime} {levelname} {name} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "WARNING"},
    "loggers": {
        # Our own code. `apps.core.exceptions` logs every unhandled 500 here.
        "apps": {
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
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
    },
}


# --- Email (COMM-1) -------------------------------------------------------
# Outbound uses Django's own SMTP backend. EMAIL_BACKEND itself is NOT read
# from ENV — dev.py hardcodes the console backend so local development can
# never accidentally send a real email; prod.py hardcodes SMTP. Provider
# config stays ENV-only for this story; INT-3 (SupportOs backlog.MD:661-665)
# is where a DB-backed config UI eventually lands.
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
# Meta's WhatsApp Business (Cloud) API. No safe default anywhere — unlike
# email's dev/prod EMAIL_BACKEND split, there is no "print instead of send"
# abstraction for an arbitrary HTTP call, so every WHATSAPP_* setting stays
# blank until explicitly configured, in every environment.
# WhatsAppAdapter.send refuses to run against blank config rather than
# firing a real request at Meta's live API with empty credentials. See
# Story 15 `## Prerequisites`.
WHATSAPP_API_BASE_URL = env("WHATSAPP_API_BASE_URL", default="")
WHATSAPP_PHONE_NUMBER_ID = env("WHATSAPP_PHONE_NUMBER_ID", default="")
WHATSAPP_ACCESS_TOKEN = env("WHATSAPP_ACCESS_TOKEN", default="")
# Fail closed: GET verification handshake rejects every request until set.
WHATSAPP_WEBHOOK_VERIFY_TOKEN = env("WHATSAPP_WEBHOOK_VERIFY_TOKEN", default="")
# Fail closed: POST signature verification rejects every request until set.
WHATSAPP_APP_SECRET = env("WHATSAPP_APP_SECRET", default="")

# --- Live Chat / Channels (COMM-3) ------------------------------------------
# Django Channels' ASGI entrypoint and channel layer. InMemoryChannelLayer is
# single-process only — a deliberate scope limit, no Redis dependency in this
# project. See Story 16 `## Prerequisites`.
ASGI_APPLICATION = "config.asgi.application"
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}

# --- SMS (COMM-4) ------------------------------------------------------------
# Twilio's Programmable Messaging API. No safe default anywhere, same
# reasoning as WhatsApp (COMM-2) — every SMS_* setting stays blank until
# explicitly configured, in every environment. SMSAdapter.send refuses to
# run against blank config rather than firing a real request at Twilio's
# live API with empty credentials. See Story 17 `## Prerequisites`.
SMS_API_BASE_URL = env("SMS_API_BASE_URL", default="")
SMS_ACCOUNT_SID = env("SMS_ACCOUNT_SID", default="")
SMS_AUTH_TOKEN = env("SMS_AUTH_TOKEN", default="")
SMS_FROM_NUMBER = env("SMS_FROM_NUMBER", default="")
# The exact URL configured in the Twilio console for this webhook — used to
# verify X-Twilio-Signature. Not reconstructed from the request: Twilio's
# algorithm signs the URL it was told to POST to, and a proxy/tunnel
# rewriting Host would otherwise break every signature check silently.
SMS_WEBHOOK_URL = env("SMS_WEBHOOK_URL", default="")
