from django.urls import path

from .views import HealthView, PermissionCatalogView

app_name = "core"

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("permissions/", PermissionCatalogView.as_view(), name="permissions"),
]
