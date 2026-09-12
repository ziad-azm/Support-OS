from django.db import migrations

from apps.core.permissions import Permissions

# `admin` gets both — configuring working hours is org configuration,
# alongside BRANCHES_MANAGE/SETTINGS_MANAGE. `manager` gets VIEW only, so
# a manager editing a Branch (BranchFormPage's new calendar picker) can
# see the list of calendars to choose from, even though only `admin`
# holds BRANCHES_MANAGE today. `agent` is deliberately absent: nothing
# agent-facing ever surfaces a calendar (no ticket-list column, no
# picker on the ticket form) — see Story 111 `## Prerequisites`.
GRANTS = {
    "admin": [Permissions.CALENDARS_VIEW, Permissions.CALENDARS_MANAGE],
    "manager": [Permissions.CALENDARS_VIEW],
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
        ("organization", "0016_businesscalendar_branch_calendar_holiday_and_more"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
