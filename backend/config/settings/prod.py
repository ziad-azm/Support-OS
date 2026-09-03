"""Production settings. Select with DJANGO_SETTINGS_MODULE=config.settings.prod."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = False

# No default: production must declare its hosts explicitly.
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")

SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
SECURE_HSTS_SECONDS = env.int("DJANGO_SECURE_HSTS_SECONDS", default=31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# PROD-1: structured by default in production. Still overridable — an operator
# debugging a live container may want the text stream back.
LOGGING["handlers"]["console"]["formatter"] = env("DJANGO_LOG_FORMAT", default="json")

# PROD-3: /api/schema/, /api/docs/ and /api/redoc/ publish the complete
# endpoint inventory. INT-1 made them public by default, which is right for
# development and wrong for a deployment whose goal is a reduced attack
# surface. Still overridable — a genuinely public API can set
# API_DOCS_PUBLIC=True — and the routes are never removed, only narrowed to
# IsAuthenticated, so an authenticated integrator keeps them.
API_DOCS_PUBLIC = env.bool("API_DOCS_PUBLIC", default=False)
# Re-deriving SERVE_PERMISSIONS is REQUIRED, not redundant: base.py already
# computed that key from base.py's own API_DOCS_PUBLIC (default True), so
# rebinding the flag above alone would change a variable nothing reads again
# and leave the docs public. Verified via the check in Story 92's
# `## Verification Steps` step 8. See CONVENTIONS.md § 36.
SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"] = (
    ["rest_framework.permissions.AllowAny"]
    if API_DOCS_PUBLIC
    else ["rest_framework.permissions.IsAuthenticated"]
)
