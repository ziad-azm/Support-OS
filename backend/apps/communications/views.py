import logging

from django.conf import settings
from django.utils.crypto import constant_time_compare
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import Permissions
from apps.core.renderers import PlainTextRenderer
from apps.core.views import BaseModelViewSet

from .adapters import get_adapter
from .email_adapter import EmailAdapter
from .live_chat_adapter import LiveChatAdapter
from .models import Message
from .serializers import MessageSerializer
from .whatsapp_adapter import WhatsAppAdapter, extract_text_message, verify_signature

logger = logging.getLogger(__name__)


class MessageViewSet(BaseModelViewSet):
    """Message CRUD for one ticket's conversation. Reuses `tickets.*` — a
    message is a child of the ticket domain, not a separate permission
    domain (Story 13 `## Product rules`).
    """

    queryset = Message.objects.select_related("ticket").all()
    serializer_class = MessageSerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        ticket_id = self.request.query_params.get("ticket")
        if not ticket_id:
            raise ValidationError({"ticket": [_("This query parameter is required.")]})
        try:
            ticket_id = int(ticket_id)
        except ValueError:
            raise ValidationError({"ticket": [_("Must be a valid ticket id.")]}) from None
        return queryset.filter(ticket_id=ticket_id)

    def perform_create(self, serializer):
        instance = serializer.save()
        if instance.direction != Message.Direction.OUTBOUND:
            return
        adapter = get_adapter(instance.channel)
        if adapter is None:
            return
        try:
            adapter.send(instance)
        except Exception:
            # The Message row is already committed — the agent's reply is
            # recorded regardless of delivery outcome. See Story 14
            # `## Product rules`.
            logger.exception(
                "Failed to send outbound message %s via channel %s",
                instance.pk,
                instance.channel,
            )


class EmailInboundWebhookView(APIView):
    """Receives inbound email as a provider-agnostic JSON payload
    (`from`, `to`, `subject`, `body`, `message_id`) and turns it into a
    Message via `EmailAdapter.receive()`. No live email provider is
    integrated — see Story 14 `## Prerequisites`. A real provider's webhook
    would translate its own payload shape into this one and POST here.

    Token-authenticated, not JWT — the caller is an external system, not a
    signed-in user. `authentication_classes = []` / `permission_classes =
    [AllowAny]`, the same explicit-open shape as `HealthView`
    (`apps/core/views.py`) — CONVENTIONS.md §13.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        # Fail closed: an unconfigured token must reject every request, not
        # crash the app at import time over an optional feature that may not
        # be set up yet. See Story 14 `## Prerequisites`.
        if not settings.EMAIL_INBOUND_WEBHOOK_TOKEN:
            raise PermissionDenied()
        token = request.query_params.get("token", "")
        if not constant_time_compare(token, settings.EMAIL_INBOUND_WEBHOOK_TOKEN):
            raise PermissionDenied()

        payload = request.data
        missing = [key for key in ("from", "to", "body") if not payload.get(key)]
        if missing:
            raise ValidationError({key: [_("This field is required.")] for key in missing})

        message = EmailAdapter().receive(payload)
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)


class WhatsAppInboundWebhookView(APIView):
    """Meta's WhatsApp Business (Cloud) API webhook — one URL handles both
    the `GET` verification handshake and `POST` inbound message delivery,
    matching how Meta's own webhook configuration works (a single Callback
    URL). `POST` is signature-verified (`X-Hub-Signature-256`,
    `WHATSAPP_APP_SECRET`), not token-in-query-string like
    `EmailInboundWebhookView` — Meta's own convention, not this project's
    invention. See Story 15 `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get_renderers(self):
        if self.request.method == "GET":
            return [PlainTextRenderer()]
        return super().get_renderers()

    def get(self, request):
        # Fail closed, same reasoning as EmailInboundWebhookView (Story 14).
        if not settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
            raise PermissionDenied()
        mode = request.query_params.get("hub.mode")
        token = request.query_params.get("hub.verify_token", "")
        challenge = request.query_params.get("hub.challenge", "")
        if mode != "subscribe" or not constant_time_compare(
            token, settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN
        ):
            raise PermissionDenied()
        return Response(challenge)

    def post(self, request):
        if not settings.WHATSAPP_APP_SECRET:
            raise PermissionDenied()
        signature = request.headers.get("X-Hub-Signature-256", "")
        if not verify_signature(settings.WHATSAPP_APP_SECRET, request.body, signature):
            raise PermissionDenied()

        # Meta POSTs every webhook event (message delivered, read receipts,
        # ...) to this same URL, not just inbound text messages — Meta
        # requires 200 OK for all of them or it retries and eventually
        # disables the subscription. Only a text message is processed.
        if extract_text_message(request.data) is None:
            return Response(status=status.HTTP_200_OK)

        message = WhatsAppAdapter().receive(request.data)
        return Response(MessageSerializer(message).data, status=status.HTTP_201_CREATED)


class LiveChatStartView(APIView):
    """Starts (or resumes) an anonymous live-chat session: creates a
    Customer + Ticket (or continues the customer's most recent non-closed
    one) and returns a signed session token the widget uses to open its
    WebSocket connection. Public — a live-chat widget has no login;
    PORTAL-0 (`SupportOs backlog.MD:526-529`) owns real customer
    authentication, deliberately not pre-empted here. See Story 16
    `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": [_("This field is required.")]})
        email = (request.data.get("email") or "").strip() or None

        ticket, token = LiveChatAdapter().start_session(name, email)
        return Response(
            {"ticket_id": ticket.id, "session_token": token}, status=status.HTTP_201_CREATED
        )
