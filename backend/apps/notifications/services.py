"""The shared notification service's one entry point — SLA-4.

`notify(...)` is what "one notification system... so that all features send
alerts consistently" (intake) actually means in code: every event source
(today: `apps/tickets/assignment.py::apply_assignment`,
`apps/tickets/escalation.py::apply_escalation`; future: tasks, collaboration,
SLA, AI, per the intake's own "reused by" note) calls this and nothing else.
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from .models import Notification
from .serializers import NotificationSerializer
from .tasks import send_notification_email

logger = logging.getLogger(__name__)


def notify(recipient, kind: str, *, title: str, body: str = "", ticket=None) -> Notification:
    """Creates the in-app `Notification` row, then best-effort pushes it live
    over the channel layer and best-effort queues its email delivery.

    The row itself is a plain, synchronous DB write — no try/except around
    it, the same way `apply_assignment`/`apply_escalation`'s own `ticket.save()`
    calls right beside this one are not defensively wrapped either. The two
    steps *after* it are genuinely best-effort side effects (a down channel
    layer, or Redis/the Celery worker being unavailable), each independently
    guarded so one failing never blocks the other and neither ever undoes the
    already-committed row — the same commit-first idiom
    `MessageViewSet.perform_create`/`TicketViewSet.perform_create` already use
    (Stories 14/29), consolidated here in one place since `notify` has
    multiple call sites from day one, unlike either of those.
    """
    notification = Notification.objects.create(
        recipient=recipient, kind=kind, ticket=ticket, title=title, body=body
    )

    try:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"notifications_{recipient.id}",
            {
                "type": "notification.message",
                "notification": NotificationSerializer(notification).data,
            },
        )
    except Exception:
        logger.exception(
            "Failed to broadcast notification %s over the channel layer", notification.id
        )

    try:
        send_notification_email.delay(notification.id)
    except Exception:
        logger.exception("Failed to queue email delivery for notification %s", notification.id)

    return notification
