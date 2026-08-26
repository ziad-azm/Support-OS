from django.db import migrations

from apps.core.permissions import Permissions

# Same reasoning as customers/0002_grant_customer_permissions.py: agents work
# tickets day to day, managers need oversight, admin is explicit-by-grant
# (role-based, not automatic) — a superuser bypasses roles entirely
# (CONVENTIONS.md §22).
GRANTS = {
    "admin": [Permissions.TICKETS_VIEW, Permissions.TICKETS_MANAGE],
    "manager": [Permissions.TICKETS_VIEW, Permissions.TICKETS_MANAGE],
    "agent": [Permissions.TICKETS_VIEW, Permissions.TICKETS_MANAGE],
}


def grant(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")
    for slug, permissions in GRANTS.items():
        role = Role.objects.filter(slug=slug).first()
        if role is None:
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
    dependencies = [
        ("tickets", "0001_initial"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
