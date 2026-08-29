from rest_framework.routers import SimpleRouter

from .views import AuditLogViewSet, RoleViewSet, UserViewSet

app_name = "accounts_admin"

# SimpleRouter, not DefaultRouter: apps.customers.urls already owns the
# auto-generated API-root view at path(""). See Story 39 `## Context` item 9.
router = SimpleRouter()
router.register("users", UserViewSet, basename="user")
router.register("roles", RoleViewSet, basename="role")
router.register("audit-logs", AuditLogViewSet, basename="auditlog")

urlpatterns = router.urls
