import re

from django.conf import settings
from django.core.mail import EmailMessage, get_connection

from apps.customers.models import Customer
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import EmailProviderConfig, Message

# A plain email address only — this story's inbound payload is a
# provider-agnostic shape this project defines (no real MIME "To" header
# with display names/multiple recipients to parse). See Story 14
# `## Prerequisites`.
TICKET_TAG_RE = re.compile(r"\+(?P<ticket_id>\d+)@")


@register_adapter
class EmailAdapter(ChannelAdapter):
    """Email channel — COMM-1.

    Inbound: `EmailInboundWebhookView` (views.py) calls `receive()` with a
    provider-agnostic JSON payload — no live email provider is integrated,
    see Story 14 `## Prerequisites`.

    Outbound: `MessageViewSet.perform_create` calls `send()` automatically
    for every outbound `channel="email"` Message — see Story 14
    `## Product rules`.
    """

    channel = Message.Channel.EMAIL

    def receive(self, payload: dict) -> Message:
        to_address = payload.get("to", "")
        from_address = payload["from"]
        body = payload.get("body", "")

        ticket = None
        match = TICKET_TAG_RE.search(to_address)
        if match:
            ticket = Ticket.objects.filter(pk=int(match.group("ticket_id"))).first()

        # No tag, or the tagged ticket no longer exists: treat this as first
        # contact rather than dropping the email. Never lose an inbound
        # message over a stale or absent routing tag.
        if ticket is None:
            customer, _created = Customer.objects.get_or_create(
                email=from_address, defaults={"name": from_address}
            )
            ticket = Ticket.objects.create(
                subject=payload.get("subject") or "(no subject)",
                description=body,
                customer=customer,
            )

        return Message.objects.create(
            ticket=ticket,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.EMAIL,
            body=body,
            metadata={
                "from": from_address,
                "to": to_address,
                "message_id": payload.get("message_id", ""),
            },
        )

    def send(self, message: Message) -> None:
        customer = message.ticket.customer
        if not customer.email:
            raise ValueError(
                f"Cannot send email for ticket #{message.ticket_id}: "
                "its customer has no email address."
            )
        config = EmailProviderConfig.load()
        if not config.is_configured():
            raise ValueError("Email sending is not configured (set it at /settings/channels).")
        reply_to = (
            f"{settings.EMAIL_INBOUND_LOCAL_PART}+{message.ticket_id}"
            f"@{settings.EMAIL_INBOUND_DOMAIN}"
        )
        # `EMAIL_BACKEND` (console in dev, SMTP in prod) is still read from
        # Django settings — untouched, see Story 82 `## Prerequisites`. Only
        # host/port/username/password/use_tls come from the DB config; the
        # console backend accepts and ignores all five
        # (`django.core.mail.backends.base.BaseEmailBackend.__init__`
        # absorbs arbitrary kwargs), so this call is safe in every
        # environment without branching on which backend is active.
        connection = get_connection(
            host=config.host,
            port=config.port,
            username=config.host_user,
            password=config.host_password,
            use_tls=config.use_tls,
        )
        email = EmailMessage(
            subject=message.ticket.subject,
            body=message.body,
            from_email=config.default_from_email,
            to=[customer.email],
            reply_to=[reply_to],
            connection=connection,
        )
        email.send()
