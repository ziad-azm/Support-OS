from django.apps import AppConfig


class IntegrationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.integrations"

    def ready(self):
        # `authentication` registers `ApiKeyScheme` (an
        # OpenApiAuthenticationExtension) on import, so `manage.py
        # spectacular` emits the ApiKeyAuth security scheme without
        # depending on a request having already made DRF import it
        # (INT-1, Story 80). `signals` registers its `@receiver`s the
        # same way — a decorator only takes effect if its module is
        # actually imported, the same reasoning
        # `apps.communications.apps.py::ready()` documents for its own
        # `@register_adapter` imports (Story 13). INT-4 (Story 83).
        from . import (  # noqa: F401
            authentication,
            signals,
        )
