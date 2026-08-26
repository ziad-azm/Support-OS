from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Ticket


class Message(TimeStampedModel):
    """A single message in a ticket's conversation — the reusable spine
    every channel (COMM-1 Email, COMM-2 WhatsApp, COMM-3 Live Chat, COMM-4
    SMS) attaches to via `ChannelAdapter` (`adapters.py`). No channel has a
    bespoke model — everything is a `Message`. See Story 13 `## Story Goal`.
    """

    class Direction(models.TextChoices):
        INBOUND = "inbound", _("Inbound")
        OUTBOUND = "outbound", _("Outbound")

    class Channel(models.TextChoices):
        EMAIL = "email", _("Email")
        WHATSAPP = "whatsapp", _("WhatsApp")
        CHAT = "chat", _("Live chat")
        SMS = "sms", _("SMS")
        WEB_FORM = "web_form", _("Web form")

    # CASCADE, not PROTECT: contrast `Ticket.customer` (Story 12, PROTECT —
    # the customer outlives the relationship). A message has no existence
    # independent of its ticket.
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="messages", verbose_name=_("ticket")
    )
    # No default, unlike Ticket.status/priority: direction is real content,
    # not a placeholder, and there is no correct default — an inbound
    # webhook payload and an agent's typed reply must never be accidentally
    # interchangeable.
    direction = models.CharField(_("direction"), max_length=10, choices=Direction.choices)
    channel = models.CharField(_("channel"), max_length=20, choices=Channel.choices)
    body = models.TextField(_("body"))
    # Schemaless on purpose: each channel adapter defines its own keys (an
    # email Message-ID, a WhatsApp message SID, ...). Read-only via the API
    # — see MessageSerializer (task 3).
    metadata = models.JSONField(_("metadata"), default=dict, blank=True)

    class Meta:
        verbose_name = _("message")
        verbose_name_plural = _("messages")
        # Chronological, oldest first — a conversation reads top-to-bottom.
        # Contrast Ticket.Meta.ordering, a queue read newest-first.
        ordering = ("created_at",)

    def __str__(self) -> str:
        direction = self.get_direction_display()
        channel = self.get_channel_display()
        return f"{direction} {channel} on ticket #{self.ticket_id}"
