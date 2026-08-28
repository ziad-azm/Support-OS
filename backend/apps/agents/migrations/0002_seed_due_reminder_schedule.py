from django.db import migrations


def seed_due_reminder_schedule(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    # Matches the row `apps/sla/migrations/0004_seed_escalation_schedule.py`
    # (Story 30) already created — `get_or_create` reuses that same
    # `IntervalSchedule`, it does not create a second "every 5 minutes"
    # row. Two `PeriodicTask`s now point at it.
    schedule, _ = IntervalSchedule.objects.get_or_create(every=5, period="minutes")
    PeriodicTask.objects.get_or_create(
        name="AGENT-3: send due task reminders",
        defaults={
            "task": "apps.agents.tasks.send_due_task_reminders",
            "interval": schedule,
            "enabled": True,
        },
    )


def unseed_due_reminder_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="AGENT-3: send due task reminders").delete()
    # The shared `every=5, period="minutes"` IntervalSchedule row is
    # deliberately left in place on reverse, for the same reason Story
    # 30's own migration already documents — it is now shared by TWO
    # PeriodicTasks (this one and SLA-3's), so deleting it on this
    # migration's reverse would silently break the other one too.


class Migration(migrations.Migration):
    dependencies = [
        ("agents", "0001_initial"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(seed_due_reminder_schedule, unseed_due_reminder_schedule),
    ]
