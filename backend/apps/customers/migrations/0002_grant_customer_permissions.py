from django.db import migrations

from apps.core.permissions import Permissions

# Who gets what. Agents work customers day to day, so they get full manage;
# managers see everything. Admin already holds every permission by role, and
# a superuser bypasses roles entirely (CONVENTIONS.md §22).
GRANTS = {
    "admin": [Permissions.CUSTOMERS_VIEW, Permissions.CUSTOMERS_MANAGE],
    "manager": [Permissions.CUSTOMERS_VIEW, Permissions.CUSTOMERS_MANAGE],
    "agent": [Permissions.CUSTOMERS_VIEW, Permissions.CUSTOMERS_MANAGE],
}


def grant(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            # A deployment that renamed or removed a seeded role is not an
            # error here — SEC-1 owns role administration.
            continue
        role.permissions = sorted(set(role.permissions) | set(permissions))
        role.save(update_fields=["permissions"])


def revoke(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
            continue
        role.permissions = sorted(set(role.permissions) - set(permissions))
        role.save(update_fields=["permissions"])


class Migration(migrations.Migration):
    # Cross-app: the rows live in `accounts`, the grant belongs to the feature.
    # Naming `accounts.0003_seed_roles` guarantees the roles exist first.
    dependencies = [
        ("customers", "0001_initial"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
