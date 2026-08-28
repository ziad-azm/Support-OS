from django.contrib import admin

from .models import FAQ


@admin.register(FAQ)
class FAQAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — the same call
    `TaskAdmin` (`apps.agents`) already makes: an `FAQ` is authored and
    edited through the app's own `FaqListPage`/`FaqFormPage`, not through
    `/admin/`. See Story 39 `## Prerequisites`.
    """

    list_display = ("question", "order", "created_at", "updated_at")
    search_fields = ("question", "answer")
    readonly_fields = ("created_at", "updated_at")
