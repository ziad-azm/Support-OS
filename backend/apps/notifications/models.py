from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Ticket


class Notification(TimeStampedModel):
    """The shared notification service's in-app record — SLA-4.

    Created only by `apps.notifications.services.notify`, never directly by
    the API (see `apps/notifications/views.py::NotificationViewSet`, which is
    read-plus-mark-read only). `kind` starts with exactly the two event
    sources this story wires: automatic/manual ticket assignment and
    automatic/manual ticket escalation. See Story 31 `## Prerequisites`.
    """

    class Kind(models.TextChoices):
        TICKET_ASSIGNED = "ticket_assigned", _("Ticket assigned")
        TICKET_ESCALATED = "ticket_escalated", _("Ticket escalated")

    # CASCADE, not SET_NULL: unlike Ticket.assigned_agent (which keeps the
    # ticket when its agent is removed), a Notification exists *for* its
    # recipient — one has no meaning without the other. See Story 31
    # `## Prerequisites` for the contrast with Ticket.customer's PROTECT.
    recipient = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name=_("recipient"),
    )
    kind = models.CharField(_("kind"), max_length=30, choices=Kind.choices)
    # Nullable: a plain FK to the one target type that exists today, not a
    # GenericForeignKey — see Story 31 `## Prerequisites`.
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
        verbose_name=_("ticket"),
    )
    title = models.CharField(_("title"), max_length=255)
    body = models.CharField(_("body"), max_length=500, blank=True)
    read_at = models.DateTimeField(_("read at"), null=True, blank=True)
    email_sent_at = models.DateTimeField(_("email sent at"), null=True, blank=True)

    class Meta:
        verbose_name = _("notification")
        verbose_name_plural = _("notifications")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_kind_display()} → {self.recipient}"
