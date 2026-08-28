from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel
from apps.tickets.models import Ticket


class Task(TimeStampedModel):
    """A personal task/reminder — AGENT-3. Owned by exactly one agent,
    never shared or assigned to anyone else; optionally linked to a
    ticket for follow-up context. This app's first real content — see
    Story 32 `## Prerequisites`.
    """

    owner = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="tasks",
        verbose_name=_("owner"),
    )
    # SET_NULL, not CASCADE: contrast `Notification.ticket` (Story 31,
    # CASCADE — a notification IS ABOUT an event on that ticket, so it has
    # no meaning once the ticket is gone). A task's own existence is not
    # tied to the ticket it optionally references — "optional ticket
    # link" (intake) — so deleting the ticket unlinks the task rather
    # than deleting it, the same reasoning `Ticket.category`'s own
    # SET_NULL uses. See Story 32 `## Prerequisites`.
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="agent_tasks",
        verbose_name=_("ticket"),
    )
    title = models.CharField(_("title"), max_length=255)
    description = models.CharField(_("description"), max_length=1000, blank=True)
    # Required: the intake's parenthetical ("optional ticket link, due
    # date") reads "optional" as modifying "ticket link" only — a
    # task/reminder with no due date has nothing for
    # `send_due_task_reminders` (task 6) to fire on. See Story 32
    # `## Prerequisites`.
    due_at = models.DateTimeField(_("due at"))
    completed_at = models.DateTimeField(_("completed at"), null=True, blank=True)
    # Idempotency guard mirroring `Notification.email_sent_at` (Story 31)
    # — `send_due_task_reminders` uses this to notify at most once per
    # task, however many times the periodic job runs while it stays
    # overdue.
    reminder_sent_at = models.DateTimeField(_("reminder sent at"), null=True, blank=True)

    class Meta:
        verbose_name = _("task")
        verbose_name_plural = _("tasks")
        # Soonest-due first — a to-do list, not an audit log (contrast
        # `TicketActivity.Meta.ordering`, newest-first).
        ordering = ("due_at",)

    def __str__(self) -> str:
        return self.title


class QuickReply(TimeStampedModel):
    """A reusable reply template — AGENT-4. Shared across every agent, the
    opposite shape from `Task`, above: no `owner`, visible to and usable
    by anyone who can reach `ReplyForm` (`tickets.manage`). See Story 33
    `## Prerequisites`.
    """

    title = models.CharField(_("title"), max_length=200)
    # TextField, no max_length — matches `apps.communications.models.Message.body`,
    # since a template's text becomes a message body verbatim.
    body = models.TextField(_("body"))

    class Meta:
        verbose_name = _("quick reply")
        verbose_name_plural = _("quick replies")
        # Alphabetical — a template library is browsed, not read as a
        # feed. Contrast `Task.Meta.ordering` (due-soonest) and
        # `TicketActivity.Meta.ordering` (newest-first).
        ordering = ("title",)

    def __str__(self) -> str:
        return self.title


class InternalNote(TimeStampedModel):
    """A private, ticket-scoped collaboration note — AGENT-5. Never
    customer-visible. Reuses `apps.customers.models.Note`'s exact shape
    one level over (a ticket instead of a customer), plus an explicit
    set of mentioned users. See Story 34 `## Prerequisites`.
    """

    # CASCADE: a note has no existence independent of its ticket, the
    # same reasoning `Note.customer` and `Message.ticket` already use.
    ticket = models.ForeignKey(
        Ticket,
        on_delete=models.CASCADE,
        related_name="internal_notes",
        verbose_name=_("ticket"),
    )
    # SET_NULL: content survives its author's account being removed, the
    # same reasoning `Note.author`/`Task.owner`'s siblings already use.
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="authored_internal_notes",
        verbose_name=_("author"),
    )
    body = models.TextField(_("body"))
    # The @mentions themselves: an explicit set, not free-text parsing of
    # `body` — see Story 34 `## Prerequisites`. Blank-allowed: a private
    # note need not mention anyone.
    mentioned_users = models.ManyToManyField(
        "accounts.User",
        related_name="mentioned_in_notes",
        blank=True,
        verbose_name=_("mentioned users"),
    )

    class Meta:
        verbose_name = _("internal note")
        verbose_name_plural = _("internal notes")
        # Newest-first, matching `Note.Meta.ordering` — a running log of
        # context reads best with the most recent entry on top.
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Note on ticket #{self.ticket_id}"
