from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core import signing
from django.utils.translation import gettext_lazy as _

from apps.customers.models import Customer
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message
from .serializers import MessageSerializer

LIVE_CHAT_SALT = "apps.communications.live_chat"
# A week: long enough for a customer to resume a conversation across visits,
# short enough that a stale/leaked token is not a standing liability. A
# plain constant, not an ENV var — an internal tuning knob, not provider
# config (contrast EMAIL_*/WHATSAPP_*, Stories 14-15).
SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7


def resolve_session_ticket(token: str) -> int | None:
    """Verify a customer's live-chat session token and return the ticket id
    it names, or None if the token is missing, tampered with, or expired.
    """
    if not token:
        return None
    try:
        return signing.loads(token, salt=LIVE_CHAT_SALT, max_age=SESSION_MAX_AGE_SECONDS)
    except signing.BadSignature:
        return None


@register_adapter
class LiveChatAdapter(ChannelAdapter):
    """Live chat — COMM-3. Unlike Email/WhatsApp, there is no external
    provider: "delivery" for an outbound message is a WebSocket broadcast
    to the ticket's own channel-layer group (not a call to a third-party
    API), and "receiving" an inbound message is a WebSocket frame from the
    widget, not a webhook. See Story 16 `## Prerequisites`.
    """

    channel = Message.Channel.CHAT

    def start_session(self, name: str, email: str | None) -> tuple[Ticket, str]:
        """Find-or-create the customer/ticket for a new widget session and
        return `(ticket, signed_session_token)`. Mirrors the "continue the
        most recent non-closed ticket, else start a new one" rule Story 15
        established for WhatsApp — a chat widget has no per-conversation
        address either.
        """
        if email:
            customer, _created = Customer.objects.get_or_create(
                email=email, defaults={"name": name}
            )
        else:
            customer = Customer.objects.create(name=name)

        ticket = (
            Ticket.objects.filter(customer=customer)
            .exclude(status=Ticket.Status.CLOSED)
            .order_by("-created_at")
            .first()
        )
        if ticket is None:
            # `Ticket.subject` is `max_length=200`. `LiveChatStartView.post`
            # already rejects a `name` over 200 chars, but the "Live chat
            # with {name}" prefix still needs its own room — and the
            # prefix's own translated length varies by locale, so this
            # slices the final string defensively (a plain slice, not
            # `Truncator.chars()` — that appends its own suffix on top of
            # the requested length instead of capping the total at it)
            # rather than trying to precompute a locale-specific safe
            # `name` length in the view. Without this, an over-length
            # `name` reaches Postgres and raises an unhandled `DataError`
            # (500), not a clean 400.
            subject = (_("Live chat with %(name)s") % {"name": name})[:200]
            ticket = Ticket.objects.create(
                subject=subject,
                description=_("Started via the live chat widget."),
                customer=customer,
            )
        token = signing.dumps(ticket.id, salt=LIVE_CHAT_SALT)
        return ticket, token

    def receive(self, payload: dict) -> Message:
        return Message.objects.create(
            ticket_id=payload["ticket_id"],
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.CHAT,
            body=payload["body"],
        )

    def send(self, message: Message) -> None:
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"ticket_{message.ticket_id}",
            {"type": "chat.message", "message": MessageSerializer(message).data},
        )
