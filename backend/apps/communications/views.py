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
from apps.core.views import BaseModelViewSet

from .adapters import get_adapter
from .email_adapter import EmailAdapter
from .models import Message
from .serializers import MessageSerializer

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
