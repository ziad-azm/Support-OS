import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core import signing
from django.utils.translation import gettext_lazy as _

from apps.customers.models import Customer
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message
from .serializers import MessageSerializer

logger = logging.getLogger(__name__)

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
        """Create the customer/ticket for a new widget session and return
        `(ticket, signed_session_token)`.

        **Always starts a NEW ticket.** This deliberately does NOT mirror the
        "continue the most recent non-closed ticket" rule Story 15
        established for WhatsApp, which an earlier version of this method
        copied. That rule is safe there and unsafe here, and the difference
        is who vouches for the identity:

        * WhatsApp/SMS resume on a phone number asserted by the **provider
          webhook** — the carrier says who sent the message, and the caller
          cannot choose it.
        * This endpoint is `AllowAny` with no authentication, and `email` is
          a free-text field typed by an anonymous stranger.

        With the resume lookup in place, `get_or_create(email=...)` returned
        the *existing* customer for any address already on file, and this
        method then handed the caller that customer's most recent non-closed
        ticket **plus a signed 7-day session token for it**. Since
        `Customer.email` is globally unique, `POST` with a known address was
        enough to read every agent reply on a stranger's ticket (the token
        joins the `ticket_<id>` channel group in
        `TicketChatConsumer.connect`) and to post messages onto it recorded
        as that customer's own INBOUND traffic. The ticket did not even have
        to be a chat ticket — any non-closed ticket from any channel was
        reachable.

        `web_form_adapter.py` is the other anonymous, unauthenticated intake
        path in this package and is the right precedent: dedup the customer
        record, never adopt an existing ticket. Resuming a conversation
        across visits still works for the real visitor, because the widget
        holds its own session token in `localStorage`
        (`frontend/src/features/live-chat/lib/session.ts`) and reconnects
        with that — it never re-posts here to resume.
        """
        if email:
            # Customer-record dedup only, exactly as `WebFormAdapter.receive`
            # does it: this attaches the new ticket to an existing CRM record
            # but grants no access to anything already on that record, so an
            # unverified email cannot reach another person's conversation.
            customer, _created = Customer.objects.get_or_create(
                email=email, defaults={"name": name}
            )
        else:
            customer = Customer.objects.create(name=name)

        # `Ticket.subject` is `max_length=200`. `LiveChatStartView.post`
        # already rejects a `name` over 200 chars, but the "Live chat with
        # {name}" prefix still needs its own room — and the prefix's own
        # translated length varies by locale, so this slices the final
        # string defensively (a plain slice, not `Truncator.chars()` — that
        # appends its own suffix on top of the requested length instead of
        # capping the total at it) rather than trying to precompute a
        # locale-specific safe `name` length in the view. Without this, an
        # over-length `name` reaches Postgres and raises an unhandled
        # `DataError` (500), not a clean 400.
        subject = (_("Live chat with %(name)s") % {"name": name})[:200]
        ticket = Ticket.objects.create(
            subject=subject,
            description=_("Started via the live chat widget."),
            customer=customer,
        )
        # F-25: same fix as `WebFormAdapter.receive` — see its comment.
        try:
            auto_assign_ticket.delay(ticket.id)
        except Exception:
            logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)
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
