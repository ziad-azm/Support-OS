from django.urls import path
from drf_spectacular.views import SpectacularRedocView, SpectacularSwaggerView
from rest_framework.routers import SimpleRouter

from .views import ApiKeyViewSet, SchemaView

app_name = "integrations"

# SimpleRouter, not DefaultRouter: apps.customers.urls already owns the
# auto-generated API-root view at path(""). Same note as
# apps/knowledge_base/urls.py.
router = SimpleRouter()
router.register("api-keys", ApiKeyViewSet, basename="api-key")

# The three doc routes live here rather than in config/api_urls.py so this
# app keeps its single include() line (backend/apps/README.md). Each view
# declares its own renderer_classes, so EnvelopeJSONRenderer does not
# wrap the YAML document or the HTML pages; their permissions come from
# SPECTACULAR_SETTINGS["SERVE_PERMISSIONS"] (API_DOCS_PUBLIC).
urlpatterns = router.urls + [
    path("schema/", SchemaView.as_view(), name="schema"),
    path(
        "docs/",
        SpectacularSwaggerView.as_view(url_name="integrations:schema"),
        name="swagger-ui",
    ),
    path(
        "redoc/",
        SpectacularRedocView.as_view(url_name="integrations:schema"),
        name="redoc",
    ),
]
