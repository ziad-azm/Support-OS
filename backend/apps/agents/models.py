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
