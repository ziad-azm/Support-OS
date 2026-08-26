from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.customers.models import Customer


class Ticket(TimeStampedModel):
    """A support ticket — the core record EPIC 4's sibling stories extend.

    `status` and `priority` are deliberately minimal placeholders: TKT-2 owns
    real priority/category management, TKT-3 owns assignment, TKT-4 owns
    status-transition validation and escalation, TKT-5 owns activity history.
    None of that is pre-empted here. See Story 12 `## Story Goal`.
    """

    class Status(models.TextChoices):
        OPEN = "open", _("Open")
        IN_PROGRESS = "in_progress", _("In progress")
        RESOLVED = "resolved", _("Resolved")
        CLOSED = "closed", _("Closed")

    class Priority(models.TextChoices):
        LOW = "low", _("Low")
        MEDIUM = "medium", _("Medium")
        HIGH = "high", _("High")
        URGENT = "urgent", _("Urgent")

    subject = models.CharField(_("subject"), max_length=200)
    # Required, not blank=True: a ticket records an issue, and a title with
    # no detail does not do that. Contrast Customer.phone/company, which are
    # secondary contact fields, not the record's whole purpose.
    description = models.TextField(_("description"))
    # PROTECT, not CASCADE: Story 10's own forward note names this exact
    # decision — a customer with ticket history must not silently vanish.
    # `apps/core/exceptions.py` gains ProtectedError handling in task 6
    # because this makes DELETE /api/customers/<id>/ fail cleanly instead of
    # with an unhandled 500 the moment a customer has tickets.
    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, related_name="tickets", verbose_name=_("customer")
    )
    status = models.CharField(
        _("status"), max_length=20, choices=Status.choices, default=Status.OPEN
    )
    priority = models.CharField(
        _("priority"), max_length=20, choices=Priority.choices, default=Priority.MEDIUM
    )

    class Meta:
        verbose_name = _("ticket")
        verbose_name_plural = _("tickets")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.subject
