from django.db import migrations

from apps.core.permissions import Permissions

# admin and manager, NOT agent. `tickets/migrations/0002`'s own comment
# states this project's role reasoning: "agents work tickets day to day,
# managers need oversight". A cross-team volume report is oversight, not
# day-to-day queue work. Narrower than `tickets.view` on purpose — an
# agent can already see every ticket they need through the ticket list.
GRANTS = {
    "admin": [Permissions.REPORTS_VIEW],
    "manager": [Permissions.REPORTS_VIEW],
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
    # No `("reports", ...)` entry: this is the app's first migration. The
    # accounts dependency is what guarantees the seeded roles exist before
    # `grant` runs — same as tickets/0002 and accounts/0006.
    dependencies = [
        ("accounts", "0003_seed_roles"),
    ]

    operations = [migrations.RunPython(grant, revoke)]
