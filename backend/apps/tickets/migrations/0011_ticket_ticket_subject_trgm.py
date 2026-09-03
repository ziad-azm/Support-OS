import django.contrib.postgres.indexes
from django.conf import settings
from django.db import migrations


class Migration(migrations.Migration):
    """PROD-2 (Story 91). Same `pg_trgm` rationale as
    `apps/customers/migrations/0009_customer_customer_name_trgm.py`, whose
    `TrigramExtension()` this migration depends on transitively via the
    `customers` dependency below — the extension is not re-declared here.
    See CONVENTIONS.md § 35.
    """

    dependencies = [
        ("customers", "0009_customer_customer_name_trgm"),
        ("organization", "0011_organizationsettings_primary_color"),
        ("tickets", "0010_ticket_ticket_status_created_idx_and_more"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddIndex(
            model_name="ticket",
            index=django.contrib.postgres.indexes.GinIndex(
                fields=["subject"], name="ticket_subject_trgm", opclasses=["gin_trgm_ops"]
            ),
        ),
    ]
