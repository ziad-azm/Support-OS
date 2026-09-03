from django.db import migrations


def promote(apps, schema_editor):
    """Every distinct, non-blank string in the one `OrganizationSettings`
    row's `branches` list becomes a `Branch` row.

    `get_or_create` on `name`, not `bulk_create`: the JSON list has no
    uniqueness guarantee (`_validate_string_list` only ever checked
    "non-empty string"), so a settings blob containing "Riyadh" twice must
    produce one row, not an IntegrityError that aborts the whole migration.

    `.first()`, not `OrganizationSettings.load()`: a historical model has
    no custom manager or classmethod, and on a database where the settings
    row was never created there is simply nothing to promote.

    Identical to `0004_migrate_settings_departments.promote` — see that
    migration for the reasoning this one inherits.
    """
    OrganizationSettings = apps.get_model("organization", "OrganizationSettings")
    Branch = apps.get_model("organization", "Branch")
    settings_row = OrganizationSettings.objects.first()
    if settings_row is None:
        return
    for raw in settings_row.branches or []:
        name = (raw or "").strip()
        if name:
            Branch.objects.get_or_create(name=name)


def demote(apps, schema_editor):
    """Writes the rows back into the JSON list so `0007_branch`'s own
    reverse (`DeleteModel`) does not lose an admin's configuration.

    Django unapplies in reverse dependency order, so `0009`'s RemoveField
    is reversed — re-adding the `branches` column, empty — BEFORE this
    runs. That is what makes writing the column here possible at all. See
    Story 89 `## Migration / Rollback`.
    """
    OrganizationSettings = apps.get_model("organization", "OrganizationSettings")
    Branch = apps.get_model("organization", "Branch")
    settings_row = OrganizationSettings.objects.first()
    if settings_row is None:
        return
    settings_row.branches = list(Branch.objects.order_by("name").values_list("name", flat=True))
    settings_row.save(update_fields=["branches", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [("organization", "0007_branch")]

    operations = [migrations.RunPython(promote, demote)]
