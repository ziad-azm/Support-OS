import django.contrib.postgres.indexes
from django.conf import settings
from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    """PROD-2 (Story 91). `?search=` is ILIKE '%term%' (DRF SearchFilter),
    which no btree index can serve — measured 213.7 ms end-to-end at 250,000
    customers, 41.2 ms for the query shape alone at 50,000. pg_trgm is a
    stock PostgreSQL contrib module, not a new dependency; verified available
    in this project's install. See CONVENTIONS.md § 35.

    `TrigramExtension()` requires `CREATE EXTENSION` privilege. If the
    deploy role lacks it, a DBA runs `CREATE EXTENSION pg_trgm;` once by
    hand and this operation becomes a no-op (it is `IF NOT EXISTS`).
    """

    dependencies = [
        ("customers", "0008_customer_customer_name_idx"),
        ("organization", "0011_organizationsettings_primary_color"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        TrigramExtension(),
        migrations.AddIndex(
            model_name="customer",
            index=django.contrib.postgres.indexes.GinIndex(
                fields=["name"], name="customer_name_trgm", opclasses=["gin_trgm_ops"]
            ),
        ),
    ]
