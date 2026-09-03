from django.db import migrations

from apps.core.permissions import Permissions

# Split for the same reason `0006_grant_department_permissions` splits
# DEPARTMENTS_*: reading the branch list is what populates the ticket form's
# picker, the customer form's picker, and three list filters, so an agent
# needs it. Changing the list is org configuration and stays with `admin`,
# alongside ROLES_MANAGE/SETTINGS_MANAGE. Reusing SETTINGS_MANAGE for the
# read would have handed every agent the power to rewrite the org's SLA
# defaults. See Story 89's `## Product rules`.
#
# The `customer` role (accounts/0004_seed_customer_role) is deliberately
# absent — a portal customer has no business listing the org's branches.
GRANTS = {
    "admin": [Permissions.BRANCHES_VIEW, Permissions.BRANCHES_MANAGE],
    "manager": [Permissions.BRANCHES_VIEW],
    "agent": [Permissions.BRANCHES_VIEW],
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
        ("organization", "0009_remove_organizationsettings_branches"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
