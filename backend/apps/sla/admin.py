from django.contrib import admin

from .models import SLAPolicy


@admin.register(SLAPolicy)
class SLAPolicyAdmin(admin.ModelAdmin):
    """Also the de facto SLA-policy config UI for now — the same call
    Story 18 made for `Category` (`CategoryAdmin`'s own docstring). See
    Story 28 `## Prerequisites`.
    """

    list_display = (
        "priority",
        "category",
        "response_target_minutes",
        "resolution_target_minutes",
        "created_at",
    )
    list_filter = ("priority", "category")
    readonly_fields = ("created_at", "updated_at")
