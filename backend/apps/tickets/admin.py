from django.contrib import admin

from .models import Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = ("subject", "customer", "status", "priority", "created_at")
    list_filter = ("status", "priority")
    search_fields = ("subject", "description", "customer__name")
    readonly_fields = ("created_at", "updated_at")
