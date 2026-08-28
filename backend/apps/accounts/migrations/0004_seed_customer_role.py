from django.db import migrations

from apps.core.permissions import Permissions

# Same reasoning as 0003_seed_roles: importing `Permissions` here is a plain
# string-constants module with no model imports, so there is no circular
# import and a renamed constant breaks this migration loudly rather than
# seeding a string nothing checks.
SEEDED_ROLES = [
    {
        "slug": "customer",
        "name": "Customer",
        "description": "A customer with portal login access. Holds no staff permissions.",
        "permissions": [Permissions.PORTAL_ACCESS],
    },
]


def seed_roles(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for spec in SEEDED_ROLES:
        Role.objects.update_or_create(
            slug=spec["slug"],
            defaults={**spec, "is_system": True},
        )


def unseed_roles(apps, schema_editor):
    # Fails on PROTECT if any user still holds this role — correct, same as
    # 0003_seed_roles's reverse. See the plan's `## Migration / Rollback`.
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(slug__in=[spec["slug"] for spec in SEEDED_ROLES]).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0003_seed_roles")]

    operations = [migrations.RunPython(seed_roles, unseed_roles)]
