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

    `priority`/`category` (Story 18, TKT-2), `assigned_agent` (Story 22,
    TKT-3), `status`/`escalated` (Story 23, TKT-4), and now `TicketActivity`
    (Story 24, TKT-5) are all real. EPIC 4 is complete.
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
    # SET_NULL, nullable: the project's fourth use of this behaviour, after
    # `category` above and `Note.author`/`Attachment.uploaded_by` (Story 21).
    # Deactivating or deleting an agent's account must not delete their
    # tickets (CASCADE) or block the deletion (PROTECT) — the ticket simply
    # becomes unassigned. Written ONLY through `TicketViewSet.assign`;
    # `TicketSerializer` keeps it read-only. See Story 22 `## Prerequisites`.
    assigned_agent = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_tickets",
        verbose_name=_("assigned agent"),
    )
    # SET_NULL, nullable — the same call `category` and `assigned_agent`
    # above already make, for the same reason: deleting a department must
    # neither delete its tickets (CASCADE) nor block the deletion
    # (PROTECT); the ticket simply becomes department-less. Unlike
    # `assigned_agent` this is NOT action-only: it is written through
    # `TicketSerializer` on ordinary create/update, because moving a ticket
    # between departments is routine triage, not a privileged state
    # change. String reference, not an import — see
    # `accounts.User.department`.
    department = models.ForeignKey(
        "organization.Department",
        verbose_name=_("department"),
        related_name="tickets",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    status = models.CharField(
        _("status"), max_length=20, choices=Status.choices, default=Status.OPEN
    )
    priority = models.CharField(
        _("priority"), max_length=20, choices=Priority.choices, default=Priority.MEDIUM
    )
    # A manual signal, not the automatic rule-driven escalation SLA-3 will
    # add later (SupportOs backlog.MD:476-481) — that story depends on a
    # Celery foundation (SLA-0) that does not exist yet, and can drive this
    # SAME field once it does. A flag, not a tier/level: the intake's UI
    # task says "escalate action" (one button), not "choose a level". See
    # Story 23 `## Prerequisites`.
    escalated = models.BooleanField(_("escalated"), default=False)
    # Set when `escalated` becomes True, cleared to None when it becomes
    # False — written only through `TicketViewSet.escalate`, never directly.
    escalated_at = models.DateTimeField(_("escalated at"), null=True, blank=True)

    class Meta:
        verbose_name = _("ticket")
        verbose_name_plural = _("tickets")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.subject


class TicketActivity(TimeStampedModel):
    """An immutable audit-log entry for a ticket's status/assignment
    changes — TKT-5's "reusable activity-log pattern" (`SupportOs
    backlog.MD` lines 343-348). Replies are NOT logged here: `Message`
    already is the record of them, and duplicating message bodies into a
    second table would be a real data-integrity risk (two sources of truth
    for one reply). See `apps/tickets/history.py::build_history`, which
    merges this table with `Message` into one read-only feed.
    """

    class Kind(models.TextChoices):
        STATUS_CHANGED = "status_changed", _("Status changed")
        ASSIGNED = "assigned", _("Assignment changed")

    # CASCADE, not PROTECT: an activity entry has no existence independent
    # of its ticket, the same reasoning `Message.ticket` uses (Story 13).
    ticket = models.ForeignKey(
        Ticket, on_delete=models.CASCADE, related_name="activities", verbose_name=_("ticket")
    )
    # SET_NULL: the project's now-settled pattern (`Note.author`,
    # `Attachment.uploaded_by`, `Ticket.assigned_agent`) for a reference
    # that must survive the referenced account being removed — the log
    # entry still means something after its actor's account is gone.
    actor = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ticket_activities",
        verbose_name=_("actor"),
    )
    kind = models.CharField(_("kind"), max_length=20, choices=Kind.choices)
    # Raw values, not pre-rendered sentences. `status_changed` stores the
    # `Ticket.Status` value string (e.g. "open"), which the frontend
    # translates via the SAME `statuses.<value>` i18n keys every other
    # status display already uses. `assigned` stores a NAME SNAPSHOT
    # (`User.get_full_name()` at write time, "" for unassigned) rather than
    # a user id, so the log stays historically correct even after the
    # referenced user is deleted (`assigned_agent` is itself SET_NULL) — the
    # standard audit-log tradeoff of a point-in-time snapshot over a live
    # reference. See Story 24 `## Prerequisites`.
    from_value = models.CharField(_("from value"), max_length=150, blank=True)
    to_value = models.CharField(_("to value"), max_length=150, blank=True)

    class Meta:
        verbose_name = _("ticket activity")
        verbose_name_plural = _("ticket activities")
        # Newest-first: an audit log reads like a feed, the same choice
        # `Note.Meta.ordering` makes (Story 21), not `Message.Meta.ordering`
        # (oldest-first — a conversation reads top-to-bottom).
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_kind_display()} on ticket #{self.ticket_id}"


class Feedback(TimeStampedModel):
    """Post-resolution customer satisfaction rating — PORTAL-5. One row per
    ticket (`ticket` is a `OneToOneField`), submitted by the customer
    through the portal. No staff-facing viewer or report exists yet —
    `RPT-4` (Customer Satisfaction, `SupportOs backlog.MD:623-627`, not
    yet planned) is the eventual consumer named in the intake ("feeds
    Reports CSAT"); this story ships the model, the portal submission
    endpoint, and Django admin as the interim way to see the data.
    """

    class Rating(models.TextChoices):
        # Matches CONVENTIONS.md §25's already-recorded RPT-4 chart design
        # ("satisfied/neutral/dissatisfied breakdown", a Waffle Chart over
        # exactly these three categories) — this vocabulary is not invented
        # here, it is the one already decided for reporting.
        SATISFIED = "satisfied", _("Satisfied")
        NEUTRAL = "neutral", _("Neutral")
        DISSATISFIED = "dissatisfied", _("Dissatisfied")

    # CASCADE, not PROTECT: feedback has no existence independent of the
    # ticket it is about, the same reasoning TicketActivity.ticket uses
    # (above). OneToOneField, not ForeignKey: one CSAT rating per ticket —
    # the DB-level uniqueness DRF turns into a free UniqueValidator on
    # create (see apps/portal/serializers.py, PortalFeedbackSerializer).
    ticket = models.OneToOneField(
        Ticket, on_delete=models.CASCADE, related_name="feedback", verbose_name=_("ticket")
    )
    # Denormalized from `ticket.customer` — deliberately a direct FK, not
    # reached via a `ticket__customer` lookup. CustomerScopedModelViewSet's
    # `customer_field` and HasPermission.has_object_permission both resolve
    # `customer_field` as `getattr(obj, f"{customer_field}_id", None)` — a
    # single real attribute, not an ORM double-underscore path. A nested
    # field name would satisfy `get_queryset()`'s `filter(**{...})` but
    # silently break `has_object_permission` (`getattr(obj,
    # "ticket__customer_id", None)` is never a real attribute) — the exact
    # class of bug Story 46 found and fixed in ArticleViewSet.retrieve, in
    # the opposite direction. CASCADE, matching `ticket` above.
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, related_name="feedback", verbose_name=_("customer")
    )
    rating = models.CharField(_("rating"), max_length=20, choices=Rating.choices)
    comment = models.TextField(_("comment"), blank=True)

    class Meta:
        verbose_name = _("feedback")
        verbose_name_plural = _("feedback")
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.get_rating_display()} — ticket #{self.ticket_id}"
