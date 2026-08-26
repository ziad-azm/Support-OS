"""Local development settings. Default target of DJANGO_SETTINGS_MODULE."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# Console backend: every outbound email prints to the dev server's stdout
# instead of attempting a real send. Hardcoded, not ENV-driven, so local
# development can never accidentally deliver a real email.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
