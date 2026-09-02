from django.db import migrations

from apps.core.permissions import Permissions

# Split, unlike SETTINGS_MANAGE's admin-only grant: reading the department
# list is what populates the ticket form's picker and the ticket list's
# filter, so an agent needs it. Changing the list is org configuration and
# stays with `admin`, alongside ROLES_MANAGE/SETTINGS_MANAGE. Reusing
# SETTINGS_MANAGE for the read would have handed every agent the power to
# rewrite the org's SLA defaults. See the plan's `## Product rules`.
GRANTS = {
    "admin": [Permissions.DEPARTMENTS_VIEW, Permissions.DEPARTMENTS_MANAGE],
    "manager": [Permissions.DEPARTMENTS_VIEW],
    "agent": [Permissions.DEPARTMENTS_VIEW],
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
        ("organization", "0005_remove_organizationsettings_departments"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
