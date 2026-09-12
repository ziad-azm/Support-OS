from django.apps import AppConfig


class TicketsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.tickets"

    def ready(self):
        # `signals` registers its `@receiver` the same way
        # `apps.integrations.apps.py::ready()` documents for its own
        # (INT-4) — a decorator only takes effect if its module is
        # actually imported. SLA-6 (Story 112).
        from . import signals  # noqa: F401
