from django.contrib import admin
from django.shortcuts import redirect
from django.urls import reverse

from .models import OrganizationSettings


@admin.register(OrganizationSettings)
class OrganizationSettingsAdmin(admin.ModelAdmin):
    """A singleton admin — `has_add_permission` refuses a second row, and
    `changelist_view` skips straight to the one row's change form via
    `OrganizationSettings.load()`, so visiting the changelist never shows
    an "Add" button next to an empty list the way a normal model would.
    Coexists with `SettingsView` (the primary UI per this story's own
    intake wording "admin UI") the same way `RoleAdmin`/`UserAdmin`
    coexist with SEC-1/2's frontend.
    """

    readonly_fields = ("created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return not OrganizationSettings.objects.exists()

    def has_delete_permission(self, request, obj=None) -> bool:
        return False

    def changelist_view(self, request, extra_context=None):
        obj = OrganizationSettings.load()
        return redirect(reverse("admin:organization_organizationsettings_change", args=[obj.pk]))
