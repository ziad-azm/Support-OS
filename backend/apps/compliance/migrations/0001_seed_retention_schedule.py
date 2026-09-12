from django.db import migrations


def seed_retention_schedule(apps, schema_editor):
    CrontabSchedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = CrontabSchedule.objects.get_or_create(
        minute="0", hour="2", day_of_week="*", day_of_month="*", month_of_year="*"
    )
    PeriodicTask.objects.get_or_create(
        name="SEC-10: data retention sweep",
        defaults={
            "task": "apps.compliance.tasks.run_data_retention",
            "crontab": schedule,
            "enabled": True,
        },
    )


def unseed_retention_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="SEC-10: data retention sweep").delete()
    # The CrontabSchedule row is deliberately left in place on reverse — the
    # same "this migration only owns the PeriodicTask row it created" call
    # apps/sla/migrations/0004_seed_escalation_schedule.py already makes.


class Migration(migrations.Migration):

    dependencies = [
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(seed_retention_schedule, unseed_retention_schedule),
    ]
