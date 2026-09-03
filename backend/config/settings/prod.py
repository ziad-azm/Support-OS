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
