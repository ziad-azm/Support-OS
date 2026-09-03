import logging

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.utils.crypto import constant_time_compare
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions
from apps.core.renderers import PlainTextRenderer
from apps.core.throttling import FailOpenScopedRateThrottle
from apps.core.views import BaseModelViewSet
from apps.tickets.models import Category
from apps.tickets.serializers import CategorySerializer

from .adapters import get_adapter
from .email_adapter import EmailAdapter
from .live_chat_adapter import LiveChatAdapter
from .models import EmailProviderConfig, Message, SmsProviderConfig, WhatsAppProviderConfig
from .serializers import (
    EmailProviderConfigSerializer,
    MessageSerializer,
    SmsProviderConfigSerializer,
    WhatsAppProviderConfigSerializer,
)
from .sms_adapter import SMSAdapter
from .sms_adapter import verify_signature as verify_sms_signature
from .web_form_adapter import WebFormAdapter
from .whatsapp_adapter import WhatsAppAdapter, extract_text_message, verify_signature

logger = logging.getLogger(__name__)


def validate_optional_email(value: str | None) -> None:
    """Shared by `LiveChatStartView`/`WebFormSubmissionView` — both accept an
    optional customer email with no format check of their own. Neither
    `Customer.objects.get_or_create()`/`.create()` calls `full_clean()`, so
    `EmailField`'s own validator never ran; a malformed value (e.g. "not-an-
    email") was stored as-is. The frontend's `optionalEmail()` Zod schema
    already enforces this — this only guards a direct API call bypassing it.
    """
    if not value:
        return
    try:
        validate_email(value)
    except DjangoValidationError:
        raise ValidationError({"email": [_("Enter a valid email address.")]}) from None


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
    # PROD-3: anonymous, and each creates a Ticket/Message. Rate is
    # deliberately HIGH — a dropped webhook is lost customer data, and
    # providers retry only for a bounded window. This bound exists to stop a
    # flood from exhausting the database, not to shape a provider's
    # legitimate burst. Never tighten it without measuring the provider's
    # real delivery rate first. See CONVENTIONS.md § 36.
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "webhook_inbound"

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
    # PROD-3: anonymous, and each creates a Ticket/Message. Rate is
    # deliberately HIGH — a dropped webhook is lost customer data, and
    # providers retry only for a bounded window. This bound exists to stop a
    # flood from exhausting the database, not to shape a provider's
    # legitimate burst. Never tighten it without measuring the provider's
    # real delivery rate first. See CONVENTIONS.md § 36.
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "webhook_inbound"

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


class SMSInboundWebhookView(APIView):
    """Twilio's Programmable Messaging webhook — POST-only, form-encoded
    (unlike WhatsApp's JSON), no verification-handshake GET (unlike Meta's
    Callback URL setup). Signature-verified via `X-Twilio-Signature`
    (`sms_adapter.verify_signature`) against `SMS_WEBHOOK_URL` — the exact
    URL configured in the Twilio console, not reconstructed from the
    request, so a reverse proxy/tunnel rewriting `Host` does not silently
    break verification. See Story 17 `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    # PROD-3: anonymous, and each creates a Ticket/Message. Rate is
    # deliberately HIGH — a dropped webhook is lost customer data, and
    # providers retry only for a bounded window. This bound exists to stop a
    # flood from exhausting the database, not to shape a provider's
    # legitimate burst. Never tighten it without measuring the provider's
    # real delivery rate first. See CONVENTIONS.md § 36.
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "webhook_inbound"
    parser_classes = [FormParser]

    def post(self, request):
        # Fail closed, same reasoning as EmailInboundWebhookView (Story 14).
        sms_config = SmsProviderConfig.load()
        if not (sms_config.auth_token and settings.SMS_WEBHOOK_URL):
            raise PermissionDenied()
        signature = request.headers.get("X-Twilio-Signature", "")
        params = {key: request.data.get(key, "") for key in request.data}
        if not verify_sms_signature(
            sms_config.auth_token, settings.SMS_WEBHOOK_URL, params, signature
        ):
            raise PermissionDenied()

        from_number = request.data.get("From", "")
        body = request.data.get("Body", "")
        if not from_number or not body:
            return Response(status=status.HTTP_200_OK)

        message = SMSAdapter().receive(
            {"from": from_number, "body": body, "message_sid": request.data.get("MessageSid", "")}
        )
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
    # PROD-3: creates a Customer AND a Ticket from wholly anonymous input —
    # unbounded storage growth and agent-queue flooding. 10/hour per client
    # is well above a real visitor opening a chat or filing a form, and far
    # below a script. See CONVENTIONS.md § 36.
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "anon_write"

    def post(self, request):
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": [_("This field is required.")]})
        # `LiveChatAdapter.start_session` writes `name` straight into
        # `Customer.name` (`max_length=200`) and `Ticket.subject` (also
        # `max_length=200`, via a "Live chat with {name}" prefix) with no
        # validation of its own — an over-length value reaches Postgres and
        # raises an unhandled `DataError` (500), not a clean 400. The
        # frontend's own Zod schema already caps this at 200
        # (`LiveChatWidget.tsx`), so this only guards a direct API call.
        if len(name) > 200:
            raise ValidationError(
                {"name": [_("Ensure this field has no more than 200 characters.")]}
            )
        email = (request.data.get("email") or "").strip() or None
        if email and len(email) > 254:
            raise ValidationError(
                {"email": [_("Ensure this field has no more than 254 characters.")]}
            )
        validate_optional_email(email)

        ticket, token = LiveChatAdapter().start_session(name, email)
        return Response(
            {"ticket_id": ticket.id, "session_token": token}, status=status.HTTP_201_CREATED
        )


class WebFormCategoriesView(APIView):
    """Public, read-only category list for the anonymous web form —
    `Category` (TKT-2, Story 18) is otherwise gated behind `tickets.view`
    via `CategoryViewSet`, which an anonymous visitor never holds. See
    Story 19 `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        categories = Category.objects.all()
        return Response(CategorySerializer(categories, many=True).data)


class WebFormSubmissionView(APIView):
    """Creates a Customer (find-or-create by email) + a brand-new Ticket +
    the first inbound Message from a public web-form submission. Public —
    same `authentication_classes`/`permission_classes` shape as
    `LiveChatStartView` (Story 16); no session token, since a submission has
    no follow-up interaction to resume. See Story 19 `## Prerequisites`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    # PROD-3: creates a Customer AND a Ticket from wholly anonymous input —
    # unbounded storage growth and agent-queue flooding. 10/hour per client
    # is well above a real visitor opening a chat or filing a form, and far
    # below a script. See CONVENTIONS.md § 36.
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "anon_write"

    def post(self, request):
        # `WebFormAdapter.receive` writes each of these straight into
        # `Customer.name`/`Ticket.subject` (both `max_length=200`) with no
        # validation of its own — an over-length value reaches Postgres and
        # raises an unhandled `DataError` (500), not a clean 400. The
        # frontend's own Zod schema already caps `name`/`subject`/
        # `description` (`WebFormPage.tsx`), so these only guard a direct
        # API call bypassing the UI.
        name = (request.data.get("name") or "").strip()
        if not name:
            raise ValidationError({"name": [_("This field is required.")]})
        if len(name) > 200:
            raise ValidationError(
                {"name": [_("Ensure this field has no more than 200 characters.")]}
            )
        subject = (request.data.get("subject") or "").strip()
        if not subject:
            raise ValidationError({"subject": [_("This field is required.")]})
        if len(subject) > 200:
            raise ValidationError(
                {"subject": [_("Ensure this field has no more than 200 characters.")]}
            )
        description = (request.data.get("description") or "").strip()
        if not description:
            raise ValidationError({"description": [_("This field is required.")]})
        if len(description) > 5000:
            raise ValidationError(
                {"description": [_("Ensure this field has no more than 5000 characters.")]}
            )
        email = (request.data.get("email") or "").strip() or None
        if email and len(email) > 254:
            raise ValidationError(
                {"email": [_("Ensure this field has no more than 254 characters.")]}
            )
        validate_optional_email(email)

        category_id = request.data.get("category")
        if category_id is not None:
            try:
                category_id = int(category_id)
            except (TypeError, ValueError):
                raise ValidationError({"category": [_("Must be a valid category id.")]}) from None
            if not Category.objects.filter(id=category_id).exists():
                raise ValidationError({"category": [_("Must be a valid category id.")]})

        message = WebFormAdapter().receive(
            {
                "name": name,
                "email": email,
                "subject": subject,
                "description": description,
                "category": category_id,
            }
        )
        return Response({"ticket_id": message.ticket_id}, status=status.HTTP_201_CREATED)


class EmailProviderConfigView(APIView):
    """The one email provider config record — INT-3. `GET`/`PATCH` only,
    no id in the path, the same singleton shape
    `apps.organization.views.SettingsView`/`apps.integrations.views
    .ErpConnectionView` (Story 81) already establish.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.COMMUNICATIONS_MANAGE,
        "patch": Permissions.COMMUNICATIONS_MANAGE,
    }

    @extend_schema(responses={200: EmailProviderConfigSerializer})
    def get(self, request):
        return Response(EmailProviderConfigSerializer(EmailProviderConfig.load()).data)

    @extend_schema(
        request=EmailProviderConfigSerializer, responses={200: EmailProviderConfigSerializer}
    )
    def patch(self, request):
        config = EmailProviderConfig.load()
        serializer = EmailProviderConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class WhatsAppProviderConfigView(APIView):
    """The one WhatsApp provider config record — INT-3."""

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.COMMUNICATIONS_MANAGE,
        "patch": Permissions.COMMUNICATIONS_MANAGE,
    }

    @extend_schema(responses={200: WhatsAppProviderConfigSerializer})
    def get(self, request):
        return Response(WhatsAppProviderConfigSerializer(WhatsAppProviderConfig.load()).data)

    @extend_schema(
        request=WhatsAppProviderConfigSerializer,
        responses={200: WhatsAppProviderConfigSerializer},
    )
    def patch(self, request):
        config = WhatsAppProviderConfig.load()
        serializer = WhatsAppProviderConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SmsProviderConfigView(APIView):
    """The one SMS provider config record — INT-3."""

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.COMMUNICATIONS_MANAGE,
        "patch": Permissions.COMMUNICATIONS_MANAGE,
    }

    @extend_schema(responses={200: SmsProviderConfigSerializer})
    def get(self, request):
        return Response(SmsProviderConfigSerializer(SmsProviderConfig.load()).data)

    @extend_schema(
        request=SmsProviderConfigSerializer, responses={200: SmsProviderConfigSerializer}
    )
    def patch(self, request):
        config = SmsProviderConfig.load()
        serializer = SmsProviderConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
