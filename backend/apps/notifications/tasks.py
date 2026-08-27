"""Background tasks — SLA-4. The project's second `@shared_task` module,
after `apps/sla/tasks.py` (Stories 29-30). `app.autodiscover_tasks()`
(`config/celery.py`) finds this module with no further wiring.
"""

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from .models import Notification


@shared_task
def send_notification_email(notification_id: int) -> None:
    """Sends the email half of an in-app notification. A no-op if the
    notification was deleted before this ran (mirrors `auto_assign_ticket`'s
    own `DoesNotExist` guard, Story 29) or if it was already emailed
    (idempotent against a retried task). Unlike `EmailAdapter.send`
    (Story 14), there is no "recipient has no email" guard needed —
    `accounts.User.email` is a required, unique field, unlike
    `Customer.email`.
    """
    try:
        notification = Notification.objects.select_related("recipient").get(pk=notification_id)
    except Notification.DoesNotExist:
        return
    if notification.email_sent_at is not None:
        return

    email = EmailMessage(
        subject=notification.title,
        body=notification.body or notification.title,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[notification.recipient.email],
    )
    email.send()
    notification.email_sent_at = timezone.now()
    notification.save(update_fields=["email_sent_at", "updated_at"])
