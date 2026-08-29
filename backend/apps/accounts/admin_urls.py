from rest_framework.routers import SimpleRouter

from .views import RoleViewSet, UserViewSet

app_name = "accounts_admin"

# SimpleRouter, not DefaultRouter: apps.customers.urls already owns the
# auto-generated API-root view at path(""). See Story 39 `## Context` item 9.
router = SimpleRouter()
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")

urlpatterns = router.urls
