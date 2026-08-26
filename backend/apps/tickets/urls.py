from rest_framework.routers import SimpleRouter

from .views import TicketViewSet

app_name = "tickets"

# SimpleRouter, not DefaultRouter: apps.customers.urls already mounts a
# DefaultRouter at the same `path("")` prefix in config/api_urls.py, and its
# auto-generated API-root view already claims `/api/` (Story 10). A second
# DefaultRouter mounted at the same prefix would register a second, dead
# root view. SimpleRouter generates none — see Story 12 `## Prerequisites`.
router = SimpleRouter()
router.register("tickets", TicketViewSet, basename="ticket")

urlpatterns = router.urls
