from django.db import migrations

from apps.core.permissions import Permissions

# admin-only: a subscription's secret can sign requests an external system
# will trust, and a subscription can receive customer/ticket data on every
# matching event — at least as sensitive as editing a role, the same
# reasoning 0006/0008/0009/0010 record for their own grants. INT-4 (Story 83).
GRANTS = {
    "admin": [Permissions.WEBHOOKS_MANAGE],
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
        ("accounts", "0010_grant_communications_permission"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
