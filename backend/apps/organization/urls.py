from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import DepartmentViewSet, SettingsView

app_name = "organization"

# SimpleRouter, not DefaultRouter: `apps.customers.urls` already mounts a
# DefaultRouter at the same `path("")` prefix in config/api_urls.py and its
# auto-generated API-root view already claims `/api/`. The same rule
# `apps/tickets/urls.py:7-12` records.
router = SimpleRouter()
router.register("departments", DepartmentViewSet, basename="department")

urlpatterns = router.urls + [
    path("settings/", SettingsView.as_view(), name="settings"),
]
