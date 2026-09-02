from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: configuring the ERP connection means holding a third-party
# credential and being able to fire a job that rewrites customer records in
# bulk — at least as sensitive as editing a role, the same reasoning
# 0006/0008 record for their own grants. INT-2 (Story 81).
GRANTS = {
    "admin": [Permissions.INTEGRATIONS_MANAGE],
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
        ("accounts", "0008_grant_api_keys_permission"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
