"""Background tasks — AGENT-3. The project's third `@shared_task`
module, after `apps/sla/tasks.py` (Stories 29-30) and
`apps/notifications/tasks.py` (Story 31). `app.autodiscover_tasks()`
(`config/celery.py`) finds this module with no further wiring.
"""

from celery import shared_task
from django.utils import timezone

from apps.notifications.models import Notification
from apps.notifications.services import notify

from .models import Task


@shared_task
def send_due_task_reminders() -> None:
    """Notifies each task's owner once its `due_at` has passed, for
    every task that is not yet completed and has not already been
    reminded. Runs on `django-celery-beat`'s own schedule, seeded by
    this app's `0002_seed_due_reminder_schedule` data migration — the
    same 5-minute cadence `apps/sla/migrations/0004_seed_escalation_schedule.py`
    (Story 30) already established, reused rather than reinvented.
    `reminder_sent_at` makes this idempotent against a task that stays
    overdue across multiple runs: only the first run after `due_at`
    notifies. A run that finds nothing due is a normal no-op, not an
    error — same tone as `evaluate_escalations`.
    """
    due = Task.objects.filter(
        due_at__lte=timezone.now(), completed_at__isnull=True, reminder_sent_at__isnull=True
    ).select_related("owner", "ticket")
    for task in due:
        notify(
            task.owner,
            Notification.Kind.TASK_DUE,
            ticket=task.ticket,
            title=f"Reminder: {task.title}",
            body=task.description,
        )
        task.reminder_sent_at = timezone.now()
        task.save(update_fields=["reminder_sent_at", "updated_at"])
