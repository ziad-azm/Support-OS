from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.customers.models import Customer


class Category(TimeStampedModel):
    """A ticket classification tag — TKT-2's own model. Unlike
    `ContactDetail` (shared machinery reused by every channel adapter),
    nothing outside `apps.tickets` references this model. See Story 18
    `## Story Goal`.
    """

    name = models.CharField(_("name"), max_length=100, unique=True)

    class Meta:
        verbose_name = _("category")
        verbose_name_plural = _("categories")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Ticket(TimeStampedModel):
    """A support ticket — the core record EPIC 4's sibling stories extend.

    `priority` and `category` are real as of Story 18 (TKT-2): `Category`
    is a full CRUD resource (`CategoryViewSet`), and `priority` has always
    been the editable `TextChoices` field it appears as. `status` is still
    a placeholder pending TKT-4 (status-transition validation, escalation).
    TKT-3 owns assignment, TKT-5 owns activity history. None of that is
    pre-empted here.
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
    # SET_NULL, not PROTECT or CASCADE: the project's first nullable FK.
    # Contrast `customer` above (PROTECT — an identity that must not
    # silently vanish) and `Message.ticket` (CASCADE — no existence
    # independent of its parent, Story 13). A category is a classification
    # tag: deleting one should leave every ticket that had it intact, just
    # uncategorized. See Story 18 `## Prerequisites`.
    category = models.ForeignKey(
        Category,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tickets",
        verbose_name=_("category"),
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
