from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: org-level configuration (branding, departments, branches,
# SLA defaults) is the same class of sensitive, infrequent, admin-facing
# change `Permissions.ROLES_MANAGE`/`AUDIT_LOG_VIEW` already restrict to
# `admin` alone. See the plan's `## Prerequisites`.
GRANTS = {
    "admin": [Permissions.SETTINGS_MANAGE],
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
        ("organization", "0001_initial"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
