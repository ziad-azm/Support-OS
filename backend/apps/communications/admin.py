from django.contrib import admin

from .models import Message


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("ticket", "direction", "channel", "created_at")
    list_filter = ("direction", "channel")
    search_fields = ("body", "ticket__subject")
    readonly_fields = ("created_at", "updated_at")
