from django.contrib import admin

from .models import EmailProviderConfig, Message, SmsProviderConfig, WhatsAppProviderConfig


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("ticket", "direction", "channel", "created_at")
    list_filter = ("direction", "channel")
    search_fields = ("body", "ticket__subject")
    readonly_fields = ("created_at", "updated_at")


@admin.register(EmailProviderConfig)
class EmailProviderConfigAdmin(admin.ModelAdmin):
    """A lower-level fallback beside `/settings/channels` — the same
    both-paths-exist call `ErpConnectionAdmin` (Story 81) documents.
    Adding is disabled: this is a singleton, `load()` creates the one
    row, and an "Add" button would offer a second `save()` would
    silently collapse onto `pk=1`.
    """

    list_display = ("__str__", "host", "default_from_email")
    readonly_fields = ("created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(WhatsAppProviderConfig)
class WhatsAppProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("__str__", "api_base_url", "phone_number_id")
    readonly_fields = ("created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False


@admin.register(SmsProviderConfig)
class SmsProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("__str__", "api_base_url", "account_sid", "from_number")
    readonly_fields = ("created_at", "updated_at")

    def has_add_permission(self, request) -> bool:
        return False

    def has_delete_permission(self, request, obj=None) -> bool:
        return False
