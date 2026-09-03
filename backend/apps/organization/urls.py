from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import BranchViewSet, BrandingView, DepartmentViewSet, SettingsView

app_name = "organization"

# SimpleRouter, not DefaultRouter: `apps.customers.urls` already mounts a
# DefaultRouter at the same `path("")` prefix in config/api_urls.py and its
# auto-generated API-root view already claims `/api/`. The same rule
# `apps/tickets/urls.py:7-12` records.
router = SimpleRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("branches", BranchViewSet, basename="branch")

urlpatterns = router.urls + [
    # Public (see BrandingView). Deliberately a sibling of `settings/`
    # rather than nested under it — nesting a public path inside a path
    # whose siblings are all admin-gated is how one gets opened by
    # accident later.
    path("branding/", BrandingView.as_view(), name="branding"),
    path("settings/", SettingsView.as_view(), name="settings"),
]
