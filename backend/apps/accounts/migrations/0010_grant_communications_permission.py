from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: this config holds live send credentials for three external
# messaging providers — at least as sensitive as editing a role, the same
# reasoning 0006/0008/0009 record for their own grants. INT-3 (Story 82).
GRANTS = {
    "admin": [Permissions.COMMUNICATIONS_MANAGE],
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
        ("accounts", "0009_grant_integrations_permission"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
