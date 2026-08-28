from rest_framework.routers import SimpleRouter

from .views import ArticleViewSet, CategoryViewSet, FAQViewSet

app_name = "knowledge_base"

# SimpleRouter, not DefaultRouter: apps.customers.urls already owns the
# auto-generated API-root view at path(""). See Story 12 `## Prerequisites`
# and Story 39 `## Context` item 9.
router = SimpleRouter()
router.register("faqs", FAQViewSet, basename="faq")
router.register("articles", ArticleViewSet, basename="article")
# "article-categories", not "categories" — apps.tickets.urls already claims
# /api/categories/ on the same router-mounted prefix; a second registration
# there would shadow it. See Story 40 `## Prerequisites`.
router.register("article-categories", CategoryViewSet, basename="article-category")

urlpatterns = router.urls
