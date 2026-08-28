from django.contrib import admin

from .models import Task


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — the same call
    `NotificationAdmin` (Story 31) already made: a `Task` is authored and
    edited by its owner through the app, not through `/admin/`.
    """

    list_display = ("title", "owner", "ticket", "due_at", "completed_at", "reminder_sent_at")
    list_filter = ("completed_at",)
    search_fields = ("title", "owner__email")
    readonly_fields = ("created_at", "updated_at")
