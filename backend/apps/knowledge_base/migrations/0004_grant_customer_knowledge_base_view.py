from django.db import migrations

from apps.core.permissions import Permissions

# Same reasoning and shape as 0002_grant_knowledge_base_permissions: a
# customer may read FAQs/published articles for self-service, never manage
# them — only KNOWLEDGE_BASE_VIEW is granted, never KNOWLEDGE_BASE_MANAGE.
GRANTS = {
    "customer": [Permissions.KNOWLEDGE_BASE_VIEW],
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
    # Cross-app: the row lives in `accounts`, the grant belongs to the
    # feature whose permission is being granted (knowledge_base) — the
    # same reasoning 0002_grant_knowledge_base_permissions.py already uses.
    dependencies = [
        ("knowledge_base", "0003_category_article"),
        ("accounts", "0004_seed_customer_role"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
