from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: seeing who changed a user's role/status or a role's
# permissions is at least as sensitive as making that change, which
# `Permissions.ROLES_MANAGE` already restricts to `admin` alone
# (0003_seed_roles.py). See the plan's `## Prerequisites`.
GRANTS = {
    "admin": [Permissions.AUDIT_LOG_VIEW],
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
        ("accounts", "0005_auditlog"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
