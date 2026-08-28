from django.contrib import admin

from .models import QuickReply, Task


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


@admin.register(QuickReply)
class QuickReplyAdmin(admin.ModelAdmin):
    """Also the de facto template-management UI for now — this story
    ships no frontend CRUD screen, the same call already made for
    `Category` (`CategoryAdmin`), `SLAPolicy`, `AssignmentRule`, and
    `EscalationRule`. Editable, unlike `TaskAdmin`/`NotificationAdmin`
    above — a `QuickReply` IS authored through `/admin/`, unlike a
    `Task` (authored by its owner through the app) or a `Notification`
    (system-managed only).
    """

    list_display = ("title", "created_at", "updated_at")
    search_fields = ("title", "body")
    readonly_fields = ("created_at", "updated_at")
