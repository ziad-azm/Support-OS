"""Background tasks — SEC-5. The third `tasks.py` module after
`apps/sla/tasks.py` (Stories 29-30) and `apps/notifications/tasks.py`
(Story 31, SLA-4) — `app.autodiscover_tasks()` (`config/celery.py`) finds
this module with no further wiring, confirming CONVENTIONS.md § 24's own
"the second feature to add its own tasks.py module" note a third time.
"""

import logging

from celery import shared_task
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMessage
from django.utils.translation import gettext_lazy as _

from .tokens import RESET_SALT, make_password_token, password_fingerprint

logger = logging.getLogger(__name__)
User = get_user_model()


@shared_task
def send_invite_email(user_id: int) -> None:
    """Emails a newly-created, pending staff account its "set your
    password" link. A no-op if the user row no longer exists — the API
    itself never deletes a `User` (Story 48's `UserViewSet` drops the
    `delete` verb entirely), but Django admin still can, mirroring
    `send_notification_email`'s own `DoesNotExist` guard (Story 31).
    """
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    token = make_password_token(user.id)
    link = f"{settings.FRONTEND_URL}/set-password?token={token}"
    email = EmailMessage(
        subject=str(_("Set up your SupportOS account")),
        body=str(
            _("Welcome to SupportOS. Set your password to activate your account: %(link)s")
            % {"link": link}
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    email.send()


@shared_task
def send_password_reset_email(user_id: int) -> None:
    """Emails a "reset your password" link — SEC-7. A no-op if the
    account no longer qualifies by the time this runs (deleted,
    deactivated, or its password made unusable since the request) —
    `PasswordResetRequestView` already returned its generic 200
    regardless, so silently doing nothing here is correct, not a
    swallowed bug. Mirrors `send_invite_email`'s own `DoesNotExist` guard.
    """
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return
    if not user.is_active or not user.has_usable_password():
        return

    token = make_password_token([user.id, password_fingerprint(user)], salt=RESET_SALT)
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    email = EmailMessage(
        subject=str(_("Reset your SupportOS password")),
        body=str(
            _(
                "Someone requested a password reset for your SupportOS "
                "account. If this was you, set a new password here: "
                "%(link)s"
            )
            % {"link": link}
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    email.send()
