from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — unlike SLAPolicy/
    AssignmentRule/EscalationRule (Stories 28-30), there is nothing to
    configure here: `kind` is a fixed code vocabulary, not admin-managed
    data.
    """

    list_display = ("recipient", "kind", "ticket", "read_at", "email_sent_at", "created_at")
    list_filter = ("kind",)
    search_fields = ("recipient__email", "title")
    readonly_fields = ("created_at", "updated_at")
