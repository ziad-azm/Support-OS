from django.contrib import admin

from .models import ApiKey, ErpConnection, ErpOrder, ErpSyncRun


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


@admin.register(ErpConnection)
class ErpConnectionAdmin(admin.ModelAdmin):
    """A lower-level fallback beside `/settings/erp` — the same
    both-paths-exist call `RoleAdmin` documents for `Role.permissions`.
    Adding is disabled: this is a singleton, `load()` creates the one row,
    and an admin "Add" button would offer a second that `save()` would
    silently collapse onto `pk=1`.
    """

    list_display = ("__str__", "enabled", "base_url", "export_enabled", "last_sync_at")
    readonly_fields = ("last_sync_at", "created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        # `ErpConnection.delete()` is already a no-op; hiding the button
        # keeps the admin from promising an action that does nothing.
        return False


@admin.register(ErpOrder)
class ErpOrderAdmin(admin.ModelAdmin):
    """Read-only: the ERP owns every field (Story 81 `## Product rules`).
    `raw` is visible here on purpose — this is where an operator debugging
    a field map looks to see what the ERP actually sent.
    """

    list_display = ("order_number", "external_id", "customer", "status", "placed_at", "synced_at")
    list_filter = ("status", "currency")
    list_select_related = ("customer",)
    search_fields = ("order_number", "external_id", "customer__name")
    readonly_fields = tuple(field.name for field in ErpOrder._meta.fields if field.name != "id")

    def has_add_permission(self, request) -> bool:
        return False


@admin.register(ErpSyncRun)
class ErpSyncRunAdmin(admin.ModelAdmin):
    """Immutable record, same posture as `AuditLogAdmin`."""

    list_display = (
        "started_at",
        "direction",
        "state",
        "created_count",
        "updated_count",
        "skipped_count",
        "failed_count",
        "triggered_by",
    )
    list_filter = ("direction", "state")
    list_select_related = ("triggered_by",)
    readonly_fields = tuple(field.name for field in ErpSyncRun._meta.fields if field.name != "id")

    def has_add_permission(self, request) -> bool:
        return False
