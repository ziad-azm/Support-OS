from django.db import migrations

from apps.core.permissions import Permissions

# Same reasoning as customers/0002 and tickets/0002: agents/managers/admin
# all work with FAQs day to day; a superuser bypasses roles entirely
# (CONVENTIONS.md §22).
GRANTS = {
    "admin": [Permissions.KNOWLEDGE_BASE_VIEW, Permissions.KNOWLEDGE_BASE_MANAGE],
    "manager": [Permissions.KNOWLEDGE_BASE_VIEW, Permissions.KNOWLEDGE_BASE_MANAGE],
    "agent": [Permissions.KNOWLEDGE_BASE_VIEW, Permissions.KNOWLEDGE_BASE_MANAGE],
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
        ("knowledge_base", "0001_initial"),
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
