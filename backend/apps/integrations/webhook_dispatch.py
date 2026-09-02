"""The one entry point every domain-event source calls to notify webhook
subscribers — INT-4 (Story 83). Mirrors
`apps.notifications.services.notify`'s own "one entry point, called from
every event source" shape (Story 31) one layer up: `dispatch_event` is
webhooks' `notify`.

Today's only caller is `apps/integrations/signals.py`. A future
non-signal event source (if this project ever adds one) calls this
directly — never `WebhookSubscription`/`deliver_webhook` themselves.
"""

import logging

from django.utils import timezone

from .models import WebhookSubscription
from .tasks import deliver_webhook

logger = logging.getLogger(__name__)


def dispatch_event(event: str, data: dict, *, changes: dict | None = None) -> None:
    """Builds the payload once, then queues one `deliver_webhook` task
    per matching, enabled subscription. Each queue attempt is
    independently guarded — the same commit-first idiom
    `MessageViewSet.perform_create`/`TicketViewSet.perform_create` already
    use around their own `.delay(...)` calls: one subscription's queueing
    failure (a down Redis/worker) must never block another subscription's
    delivery, and the triggering save has already committed regardless.
    """
    payload = {"event": event, "occurred_at": timezone.now().isoformat(), "data": data}
    if changes:
        payload["changes"] = changes

    # `events__contains` on a JSONField is Postgres-only in Django —
    # already the verified, established pattern this project's own
    # `apps.tickets.assignment.assignable_agents` uses for
    # `role__permissions__contains` (Story 22 `## Prerequisites`).
    subscriptions = WebhookSubscription.objects.filter(enabled=True, events__contains=[event])
    for subscription in subscriptions:
        try:
            deliver_webhook.delay(subscription.id, event, payload)
        except Exception:
            logger.exception(
                "Failed to queue webhook delivery for subscription %s, event %s",
                subscription.id,
                event,
            )
