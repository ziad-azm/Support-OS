from rest_framework.routers import SimpleRouter

from .views import FAQViewSet

app_name = "knowledge_base"

# SimpleRouter, not DefaultRouter: apps.customers.urls already owns the
# auto-generated API-root view at path(""). See Story 12 `## Prerequisites`
# and Story 39 `## Context` item 9.
router = SimpleRouter()
router.register("faqs", FAQViewSet, basename="faq")

urlpatterns = router.urls
