from django.db import migrations


def seed_erp_sync_schedule(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    schedule, _ = IntervalSchedule.objects.get_or_create(every=1, period="hours")
    PeriodicTask.objects.get_or_create(
        name="INT-2: ERP import sync",
        defaults={
            "task": "apps.integrations.tasks.run_erp_sync",
            "interval": schedule,
            # Enabled, like SLA-3's own seeded task: `run_erp_sync`
            # returns immediately unless `ErpConnection.is_configured()`,
            # so this is live-but-inert until an operator fills in
            # /settings/erp. See CONVENTIONS.md § 24 and Story 81 task 6.
            "enabled": True,
        },
    )


def unseed_erp_sync_schedule(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(name="INT-2: ERP import sync").delete()
    # The `every=1, period="hours"` IntervalSchedule row is deliberately
    # left in place on reverse — this migration owns only the PeriodicTask
    # it created, and a shared IntervalSchedule may back some other task.
    # The same reasoning sla/0004's own reverse records.


class Migration(migrations.Migration):
    dependencies = [
        ("integrations", "0002_erpconnection_erporder_erpsyncrun"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(seed_erp_sync_schedule, unseed_erp_sync_schedule),
    ]
