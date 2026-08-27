from django.contrib import admin

from .models import AssignmentRule, EscalationRule, SLAPolicy


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


@admin.register(AssignmentRule)
class AssignmentRuleAdmin(admin.ModelAdmin):
    """Also the de facto assignment-rules config UI for now — the third
    `Category`/`SLAPolicy`-precedented admin-as-config-UI call this
    session. See Story 29 `## Prerequisites`.
    """

    list_display = ("category", "strategy", "enabled", "last_assigned_agent", "created_at")
    list_filter = ("strategy", "enabled", "category")
    filter_horizontal = ("agents",)
    readonly_fields = ("created_at", "updated_at", "last_assigned_agent")


@admin.register(EscalationRule)
class EscalationRuleAdmin(admin.ModelAdmin):
    """Also the de facto escalation-rules config UI for now — the fourth
    `Category`/`SLAPolicy`/`AssignmentRule`-precedented admin-as-config-UI
    call this session. See Story 30 `## Prerequisites`. This only
    configures WHAT `evaluate_escalations` looks for — WHEN it runs is
    configured separately, through `django-celery-beat`'s own already
    installed `/admin/` (`PeriodicTask`/`IntervalSchedule`).
    """

    list_display = ("kind", "threshold_minutes", "enabled", "created_at")
    list_filter = ("kind", "enabled")
    readonly_fields = ("created_at", "updated_at")
