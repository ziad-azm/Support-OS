from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Ticket


class ChatbotSession(TimeStampedModel):
    """One bot-handled conversation — AI-5. The conversation itself lives
    in the ticket's own `Message` rows (the same spine the anonymous
    live-chat widget already uses, `COMM-3`); this model holds the one
    piece of state those rows cannot express: whether the bot is still
    answering.

    `handed_off_at is None` is the ONLY definition of "bot-handled." It is
    deliberately not inferred from `Ticket.assigned_agent` — `SLA-2`'s
    `auto_assign_ticket` can assign a ticket for unrelated reasons, which
    would silently mute the bot — nor from `Ticket.escalated`, which
    carries `TKT-4`/`SLA-3`'s own meaning. See Story 79 `## Prerequisites`.
    """

    # CASCADE + OneToOne: the session has no meaning without its ticket,
    # and a ticket is either bot-handled or it is not — the same
    # one-row-per-ticket shape `tickets.Feedback` already uses (PORTAL-5).
    ticket = models.OneToOneField(
        Ticket,
        on_delete=models.CASCADE,
        related_name="chatbot_session",
        verbose_name=_("ticket"),
    )
    handed_off_at = models.DateTimeField(_("handed off at"), null=True, blank=True)

    class Meta:
        verbose_name = _("chatbot session")
        verbose_name_plural = _("chatbot sessions")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Chatbot session for ticket #{self.ticket_id}"
