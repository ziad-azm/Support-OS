from django.contrib import admin

from .models import FAQ, Article, Category


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


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """Also the de facto category-management UI for now — this story ships
    no frontend CRUD screen for categories, the same call
    `apps.tickets.admin.CategoryAdmin` already makes. See Story 40
    `## Story Goal`.
    """

    list_display = ("name", "color", "created_at")
    search_fields = ("name",)
    readonly_fields = ("created_at", "updated_at")


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    """Read-only ops visibility, not a config UI — the same call
    `TaskAdmin`/`FAQAdmin` already make: an `Article` is authored and
    edited through the app's own `ArticleListPage`/`ArticleFormPage`, not
    through `/admin/`.
    """

    list_display = ("title_en", "category", "status", "created_at", "updated_at")
    list_filter = ("status", "category")
    search_fields = ("title_en", "title_ar", "body_en", "body_ar")
    readonly_fields = ("created_at", "updated_at")
