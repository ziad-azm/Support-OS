"""Local development settings. Default target of DJANGO_SETTINGS_MODULE."""

from .base import *  # noqa: F401,F403
from .base import env

DEBUG = env.bool("DJANGO_DEBUG", default=True)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# Console backend by default: every outbound email prints to the dev
# server's stdout instead of attempting a real send, so leaving EMAIL_HOST
# unset (the default) can never accidentally deliver a real email. Setting
# EMAIL_HOST in .env is an explicit, deliberate opt-in to real SMTP
# sending (e.g. a Mailtrap sandbox) for local testing of system email
# (invite/password-reset/notification — apps.accounts.tasks,
# apps.notifications.tasks); it does not affect ticket-reply email, which
# already reads its own DB-stored EmailProviderConfig (INT-3).
EMAIL_BACKEND = (
    "django.core.mail.backends.smtp.EmailBackend"
    if EMAIL_HOST
    else "django.core.mail.backends.console.EmailBackend"
)
