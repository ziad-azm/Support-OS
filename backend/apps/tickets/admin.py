from django.contrib import admin

from apps.communications.models import Message

from .models import Category, Feedback, SavedView, Ticket, TicketActivity


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ("direction", "channel", "body", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Retained alongside the frontend CRUD screen (`/categories`, Story 54)
    as a superuser-only fallback — not the only management path anymore.
    """

    list_display = ("name", "created_at")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display = (
        "subject",
        "customer",
        "category",
        "department",
        "branch",
        "assigned_agent",
        "status",
        "priority",
        "escalated",
        "merged_into",
        "created_at",
    )
    list_filter = (
        "status",
        "priority",
        "category",
        "department",
        "branch",
        "assigned_agent",
        "escalated",
    )
    search_fields = ("subject", "description", "customer__name")
    readonly_fields = ("created_at", "updated_at")
    inlines = (MessageInline,)


@admin.register(TicketActivity)
class TicketActivityAdmin(admin.ModelAdmin):
    list_display = ("ticket", "kind", "actor", "from_value", "to_value", "created_at")
    list_filter = ("kind",)
    search_fields = ("ticket__subject",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    """The only way to see submitted feedback until RPT-4 builds a real
    report — same interim-admin pattern as `RoleAdmin` before SEC-1.
    """

    list_display = ("ticket", "customer", "rating", "created_at")
    list_filter = ("rating",)
    search_fields = ("ticket__subject", "customer__name", "comment")
    readonly_fields = ("created_at", "updated_at")


@admin.register(SavedView)
class SavedViewAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — follows `TaskAdmin`'s
    precedent (apps/agents/admin.py:6-17): a `SavedView` is authored,
    renamed, and deleted by its owner (or a manager, for a shared row)
    through the app's own switcher, not through `/admin/`. See Story 108
    `## Context`, item 14.
    """

    list_display = ("name", "owner", "is_shared", "is_default", "created_at")
    list_filter = ("is_shared", "is_default")
    search_fields = ("name", "owner__email")
    readonly_fields = ("created_at", "updated_at")
