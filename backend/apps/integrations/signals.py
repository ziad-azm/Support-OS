"""Domain-event -> webhook dispatch bridge — INT-4 (Story 83).

The only place in this project that watches another app's models via
Django signals — see Story 83 `## Prerequisites` for why this one story
is the deliberate exception to the explicit-call-site convention every
other "something happened, tell someone" hook in this codebase uses
(`notify(...)`, `apply_assignment`, `apply_escalation`). No other app
needs to know webhooks exist; this module imports their models, never
the reverse.
"""

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.communications.models import Message
from apps.communications.serializers import MessageSerializer
from apps.customers.models import Customer
from apps.customers.serializers import CustomerSerializer
from apps.tickets.models import Ticket
from apps.tickets.serializers import TicketSerializer

from .webhook_dispatch import dispatch_event

# The three Ticket fields a webhook subscriber can care about changing.
# Extending this tuple is how a future ticket-lifecycle event is added —
# alongside a new entry in `models.WEBHOOK_EVENTS` and a branch below.
_TRACKED_TICKET_FIELDS = ("status", "assigned_agent_id", "escalated")


@receiver(pre_save, sender=Ticket)
def _capture_ticket_changes(sender, instance, **kwargs):
    """Stashes what changed onto `instance` for `_dispatch_ticket_events`
    (below) to read. Costs one extra `SELECT` per `Ticket` UPDATE — see
    Story 83 `## Prerequisites` for why this is an accepted, deliberate
    cost of a signals-only design with no new dependency.
    """
    if instance.pk is None:
        instance._webhook_changes = {}
        return
    try:
        old = Ticket.objects.get(pk=instance.pk)
    except Ticket.DoesNotExist:
        instance._webhook_changes = {}
        return
    changes = {}
    for field in _TRACKED_TICKET_FIELDS:
        old_value, new_value = getattr(old, field), getattr(instance, field)
        if old_value != new_value:
            changes[field] = (old_value, new_value)
    instance._webhook_changes = changes


@receiver(post_save, sender=Ticket)
def _dispatch_ticket_events(sender, instance, created, **kwargs):
    if created:
        dispatch_event("ticket.created", TicketSerializer(instance).data)
        return

    changes = getattr(instance, "_webhook_changes", {})
    if "status" in changes:
        old_status, new_status = changes["status"]
        dispatch_event(
            "ticket.status_changed",
            TicketSerializer(instance).data,
            changes={"status": {"from": old_status, "to": new_status}},
        )
    # Only a real assignment, not an unassignment (`agent=None`) — mirrors
    # `apply_assignment`'s own `if agent is not None: notify(...)` guard
    # (apps/tickets/assignment.py:65-71) for the identical reason: nobody
    # to notify an external system "about" when the ticket is unassigned.
    if "assigned_agent_id" in changes and instance.assigned_agent_id is not None:
        dispatch_event("ticket.assigned", TicketSerializer(instance).data)
    # Only escalating, never de-escalating — mirrors `apply_escalation`'s
    # own `if escalated and ...: notify(...)` guard
    # (apps/tickets/escalation.py:29-35).
    if "escalated" in changes and instance.escalated:
        dispatch_event("ticket.escalated", TicketSerializer(instance).data)


@receiver(post_save, sender=Customer)
def _dispatch_customer_created(sender, instance, created, **kwargs):
    if created:
        dispatch_event("customer.created", CustomerSerializer(instance).data)


@receiver(post_save, sender=Message)
def _dispatch_message_created(sender, instance, created, **kwargs):
    """Fires for both inbound and outbound messages — `data.direction`
    already distinguishes them, so this is one event
    (`message.created`), not two (`message.received`/`message.sent`) for
    what is fundamentally the same underlying fact: a `Message` row was
    created. `Message` rows are never updated after creation (verified
    live, Story 83 `## Context` item 6), so no `pre_save` tracking is
    needed here the way `Ticket` needs it.
    """
    if created:
        dispatch_event("message.created", MessageSerializer(instance).data)
