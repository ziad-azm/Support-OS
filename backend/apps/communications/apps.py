from django.apps import AppConfig


class CommunicationsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.communications"

    def ready(self):
        from . import (  # noqa: F401 — imports run @register_adapter
            email_adapter,
            live_chat_adapter,
            sms_adapter,
            web_form_adapter,
            whatsapp_adapter,
        )
