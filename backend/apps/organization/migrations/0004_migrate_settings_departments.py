from django.db import migrations


def promote(apps, schema_editor):
    """Every distinct, non-blank string in the one `OrganizationSettings`
    row's `departments` list becomes a `Department` row.

    `get_or_create` on `name`, not `bulk_create`: the JSON list has no
    uniqueness guarantee (`_validate_string_list` only checks "non-empty
    string"), so a settings blob containing "Support" twice must produce
    one row, not an IntegrityError that aborts the whole migration.

    `.first()`, not `OrganizationSettings.load()`: a historical model has
    no custom manager or classmethod, and on a database where the settings
    row was never created there is simply nothing to promote.
    """
    OrganizationSettings = apps.get_model("organization", "OrganizationSettings")
    Department = apps.get_model("organization", "Department")
    settings_row = OrganizationSettings.objects.first()
    if settings_row is None:
        return
    for raw in settings_row.departments or []:
        name = (raw or "").strip()
        if name:
            Department.objects.get_or_create(name=name)


def demote(apps, schema_editor):
    """Writes the rows back into the JSON list so `0003_department`'s own
    reverse (`DeleteModel`) does not lose an admin's configuration.

    Django unapplies in reverse dependency order, so `0005`'s RemoveField
    is reversed — re-adding the `departments` column, empty — BEFORE this
    runs. That is what makes writing the column here possible at all. See
    `## Migration / Rollback`.
    """
    OrganizationSettings = apps.get_model("organization", "OrganizationSettings")
    Department = apps.get_model("organization", "Department")
    settings_row = OrganizationSettings.objects.first()
    if settings_row is None:
        return
    settings_row.departments = list(
        Department.objects.order_by("name").values_list("name", flat=True)
    )
    settings_row.save(update_fields=["departments", "updated_at"])


class Migration(migrations.Migration):
    dependencies = [("organization", "0003_department")]

    operations = [migrations.RunPython(promote, demote)]
