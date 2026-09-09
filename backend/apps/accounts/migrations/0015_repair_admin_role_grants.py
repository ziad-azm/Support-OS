from django.db import migrations

from apps.core.permissions import ALL_PERMISSIONS

# Both slugs, because a freshly-migrated database seeds `admin` (0003) while
# this project's own database carries `super_admin` and no `admin` row at all
# — so keying on either one alone repairs one environment and silently skips
# the other. Whichever exist are repaired. See Story 100
# `## What discovery changed` item 3.
ADMIN_SLUGS = ("admin", "super_admin")

# ORG-1/ORG-2 added `departments.*`/`branches.*` to `Permissions` and the
# viewsets that enforce them, but never wrote a grant migration — so on a
# FRESH database no role holds them at all, and they are enforced-but-
# ungrantable. `manager` already carries the two `.view` grants in this
# database by hand (verified: no migration produces that); this makes it
# intentional and reproducible everywhere.
#
# Deliberately NOT the `.manage` pair: creating and deleting departments or
# branches is org administration, which `ADMIN_SLUGS` above covers in full.
MANAGER_GRANTS = ("departments.view", "branches.view")


def repair(apps, schema_editor):
    Role = apps.get_model("accounts", "Role")

    roles = list(Role.objects.filter(slug__in=ADMIN_SLUGS))
    if not roles:
        # Loud, not silent. A no-op permission migration is indistinguishable
        # from a successful one — which is exactly how 0006/0008-0011 granted
        # nothing across five releases while every one of them reported as
        # applied. See CONVENTIONS.md § 22.
        raise RuntimeError(
            "No administrative role found (looked for slugs: %s). Refusing to "
            "no-op — see Story 100." % ", ".join(ADMIN_SLUGS)
        )

    # The rule, stated rather than replayed: the administrative role holds
    # every permission there is. The intended state is NOT recoverable from
    # the migration history (this database's roles were hand-edited through
    # SEC-2's UI), and two of the six ungranted permissions were never in any
    # migration to begin with — so replaying the skipped grants would still
    # leave the product with permissions no role can hold.
    for role in roles:
        role.permissions = sorted(ALL_PERMISSIONS)
        role.save(update_fields=["permissions"])

    # Additive, never assignment: `manager`'s other grants must survive.
    manager = Role.objects.filter(slug="manager").first()
    if manager is not None:
        manager.permissions = sorted(set(manager.permissions) | set(MANAGER_GRANTS))
        manager.save(update_fields=["permissions"])


def unrepair(apps, schema_editor):
    """Deliberately a no-op.

    There is no correct earlier state to restore to: this database's
    `super_admin` was hand-edited (`manager` held `departments.view` while
    `super_admin` did not — no migration produces that shape), so reversing
    would have to invent a permission set rather than restore one.

    Reversing this migration therefore leaves the grants in place. That is
    safe in the only direction that matters: the whole defect was too FEW
    grants, so an "undo" that re-removed them would re-break six admin
    screens. To genuinely revert, edit the role in SEC-2's UI.
    """


class Migration(migrations.Migration):
    dependencies = [("accounts", "0014_user_branch")]

    operations = [migrations.RunPython(repair, unrepair)]
