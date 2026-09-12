"""Automatic ticket-status reaction to inbound messages — SLA-6
(Story 112).

The SECOND deliberate exception to this codebase's explicit-call-site
convention, after `apps.integrations.signals` (INT-4) — read that module
and `CONVENTIONS.md` §32 first. Same justification: an inbound `Message`
(a customer's own reply) is created from FIVE independent call sites
today — `EmailAdapter`, `SMSAdapter`, `WhatsAppAdapter`, `WebFormAdapter`,
`LiveChatAdapter` (the last also reached through
`TicketChatConsumer.receive`, `apps/communications/consumers.py:101`) —
with more channels likely in the future. An explicit call at every one,
forever, is the same wrong trade INT-4's own docstring rejected for "a
ticket was created." This codebase has already been bitten by exactly
this failure mode once: `EmailAdapter.receive`'s own "F-25" comment
records a brand-new ticket silently missing auto-assignment because it
bypassed the one call site that queued it.

Watches `apps.communications.models.Message`, never the reverse — this
module imports `apps.communications.models`; that app has no reason to
import anything about SLA pause behaviour. `Message` rows are never
updated after creation (verified — `apps.integrations.signals
._dispatch_message_created`'s own docstring already documents this), so
`post_save`'s free `created` flag is all this needs; no `pre_save`
change-tracking, unlike INT-4's own `Ticket` receiver.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.communications.models import Message

from .status import resume_from_pending_customer


@receiver(post_save, sender=Message)
def _resume_ticket_on_customer_reply(sender, instance, created, **kwargs):
    """A no-op for every case but one: a newly created INBOUND message.
    `resume_from_pending_customer` itself guards against the ticket
    already having left `pending_customer`, so no status check is
    duplicated here.
    """
    if not created or instance.direction != Message.Direction.INBOUND:
        return
    resume_from_pending_customer(instance.ticket)
