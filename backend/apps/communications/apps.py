from django.apps import AppConfig


class CommunicationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.communications"

    def ready(self):
        from . import email_adapter, whatsapp_adapter  # noqa: F401 — imports run @register_adapter
