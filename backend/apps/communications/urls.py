from django.urls import path
from rest_framework.routers import SimpleRouter

from .views import (
    EmailInboundWebhookView,
    LiveChatStartView,
    MessageViewSet,
    SMSInboundWebhookView,
    WebFormCategoriesView,
    WebFormSubmissionView,
    WhatsAppInboundWebhookView,
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
    *router.urls,
]
