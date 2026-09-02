from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    EmailInboundWebhookView,
    EmailProviderConfigView,
    LiveChatStartView,
    MessageViewSet,
    SMSInboundWebhookView,
    SmsProviderConfigView,
    WebFormCategoriesView,
    WebFormSubmissionView,
    WhatsAppInboundWebhookView,
    WhatsAppProviderConfigView,
)

app_name = "communications"

# SimpleRouter, continuing the precedent apps/tickets/urls.py set (Story 12):
# apps.customers.urls already owns the DefaultRouter-generated root view at
# `/api/`. A third DefaultRouter here would collide the same way a second
# one would have.
router = SimpleRouter()
router.register("messages", MessageViewSet, basename="message")

urlpatterns = [
    path(
        "webhooks/email/inbound/", EmailInboundWebhookView.as_view(), name="email-inbound-webhook"
    ),
    path(
        "webhooks/whatsapp/inbound/",
        WhatsAppInboundWebhookView.as_view(),
        name="whatsapp-inbound-webhook",
    ),
    path("webhooks/sms/inbound/", SMSInboundWebhookView.as_view(), name="sms-inbound-webhook"),
    path("live-chat/start/", LiveChatStartView.as_view(), name="live-chat-start"),
    path("web-form/categories/", WebFormCategoriesView.as_view(), name="web-form-categories"),
    path("web-form/submit/", WebFormSubmissionView.as_view(), name="web-form-submit"),
    # INT-3 (Story 82) — provider config, grouped under one prefix so the
    # three endpoints read as one feature at a glance, matching the "one
    # place to connect channels" outcome.
    path("providers/email/", EmailProviderConfigView.as_view(), name="provider-email"),
    path("providers/whatsapp/", WhatsAppProviderConfigView.as_view(), name="provider-whatsapp"),
    path("providers/sms/", SmsProviderConfigView.as_view(), name="provider-sms"),
    *router.urls,
]
