from django.contrib import admin

from .models import ApiKey


@admin.register(ApiKey)
class ApiKeyAdmin(admin.ModelAdmin):
    """A read-and-revoke surface only. `prefix`/`hashed_key` are
    `editable=False` on the model, so neither appears on the form and
    neither can be hand-edited into a working credential. Adding a key
    from here is disabled outright — `ApiKeyViewSet.create` is the only
    path that mints one, and the only path that can hand the plaintext
    back. INT-1 (Story 80).
    """

    list_display = ("name", "prefix", "user", "is_active", "expires_at", "last_used_at")
    list_filter = ("is_active",)
    list_select_related = ("user",)
    search_fields = ("name", "prefix", "user__email")
    readonly_fields = ("prefix", "created_by", "last_used_at", "created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False
