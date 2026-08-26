from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Role, User


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    """Until SEC-1 ships, this is the only way to create a role or edit its
    permissions.

    `permissions` is edited as a raw JSON textarea on purpose — a checkbox
    list over `ALL_PERMISSIONS` is what SEC-2 is for, and `Role.clean()`
    rejects an invalid string with a field error, so the raw editor is safe
    rather than merely tolerable. See CONVENTIONS.md §22.
    """

    list_display = ("name", "slug", "permission_count", "is_system")
    search_fields = ("name", "slug")
    readonly_fields = ("created_at", "updated_at")
    prepopulated_fields = {"slug": ("name",)}

    @admin.display(description="Permissions")
    def permission_count(self, role) -> int:
        return len(role.permissions)

    def get_readonly_fields(self, request, obj=None):
        # A seeded role's slug is referenced by code and by fixtures; renaming
        # it would silently detach both.
        readonly = list(super().get_readonly_fields(request, obj))
        if obj is not None and obj.is_system:
            readonly.append("slug")
        return readonly

    def get_prepopulated_fields(self, request, obj=None):
        # `prepopulated_fields` cannot name a read-only field, so drop the
        # slug helper once the slug is locked (an existing system role).
        if obj is not None and obj.is_system:
            return {}
        return super().get_prepopulated_fields(request, obj)

    def has_delete_permission(self, request, obj=None) -> bool:
        if obj is not None and obj.is_system:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """Adapted from Django's own `UserAdmin` for an email-only, username-less
    model. Verified against the installed Django 5.2 `UserAdmin` defaults —
    re-check `add_fieldsets` (the `usable_password` field is a 5.1+ addition)
    if the Django version pin ever moves.
    """

    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active", "is_superuser")
    list_select_related = ("role",)
    search_fields = ("email", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name")}),
        (
            "Permissions",
            {
                "fields": (
                    "role",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                )
            },
        ),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    # Unchanged from story 08: adding `role` to the create form would
    # complicate the `usable_password` flow for no gain, and a role is
    # assigned right after creation anyway.
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "usable_password", "password1", "password2"),
            },
        ),
    )
