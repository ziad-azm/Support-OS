from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.integrations"

    def ready(self):
        # Imports `ApiKeyScheme` (an OpenApiAuthenticationExtension, which
        # registers itself on import) at startup, so `manage.py
        # spectacular` emits the ApiKeyAuth security scheme without
        # depending on a request having already made DRF import the
        # authentication module. INT-1 (Story 80).
        from . import authentication  # noqa: F401
