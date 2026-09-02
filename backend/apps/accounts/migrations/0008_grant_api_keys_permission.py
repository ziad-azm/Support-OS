from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: an API key inherits its user's full permission set, so
# issuing one is at least as sensitive as editing a role — the same
# reasoning 0006_grant_audit_log_permission.py records for
# `Permissions.AUDIT_LOG_VIEW`. See Story 80 `## Product rules`.
GRANTS = {
    "admin": [Permissions.API_KEYS_MANAGE],
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
        ("accounts", "0007_alter_auditlog_action"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
