from django.db import migrations


def seed_escalation_schedule(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = IntervalSchedule.objects.get_or_create(every=5, period="minutes")
    PeriodicTask.objects.get_or_create(
        name="SLA-3: evaluate escalations",
        defaults={
            "task": "apps.sla.tasks.evaluate_escalations",
            "interval": schedule,
            "enabled": True,
        },
    )


def unseed_escalation_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="SLA-3: evaluate escalations").delete()
    # The `every=5, period="minutes"` IntervalSchedule row is deliberately
    # left in place on reverse — this migration only owns the PeriodicTask
    # row it created, and deleting a shared IntervalSchedule could break
    # some other PeriodicTask an admin has since pointed at the same
    # interval.


class Migration(migrations.Migration):
    dependencies = [
        ("sla", "0003_escalationrule"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(seed_escalation_schedule, unseed_escalation_schedule),
    ]
