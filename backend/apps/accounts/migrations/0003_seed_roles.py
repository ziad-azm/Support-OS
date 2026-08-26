from django.db import migrations

from apps.core.permissions import Permissions

# Importing `Permissions` here is deliberate: it is a module of plain string
# constants in `core` with no model imports, so there is no circular import
# and no `apps.get_model` violation. It also means a renamed constant breaks
# this migration loudly instead of seeding a string nothing checks.
SEEDED_ROLES = [
    {
        "slug": "admin",
        "name": "Admin",
        "description": "Full access, including user and role administration.",
        "permissions": [
            Permissions.USERS_VIEW,
            Permissions.USERS_MANAGE,
            Permissions.ROLES_MANAGE,
        ],
    },
    {
        "slug": "manager",
        "name": "Manager",
        "description": "Can see the team; cannot change users or roles.",
        "permissions": [Permissions.USERS_VIEW],
    },
    {
        "slug": "agent",
        "name": "Agent",
        "description": "Day-to-day support work. Gains permissions as features land.",
        "permissions": [],
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
    # Fails on PROTECT if any user still holds a seeded role. That is correct:
    # see the plan's `## Migration / Rollback` for the real reverse sequence.
    Role = apps.get_model("accounts", "Role")
    Role.objects.filter(slug__in=[spec["slug"] for spec in SEEDED_ROLES]).delete()


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_role_user_role")]

    operations = [migrations.RunPython(seed_roles, unseed_roles)]
