import re

from django.conf import settings
from django.core.mail import EmailMessage, get_connection

from apps.customers.models import ContactDetail, Customer
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
        # `message.target_address` (an agent's explicit choice, validated by
        # `MessageSerializer.validate` against this customer's own known
        # addresses) wins when set. Otherwise, `Customer.email` (the one
        # unique, primary address) wins whenever it's set AND
        # `email_contact_enabled` (a staff member can switch this off
        # without blanking the address itself — e.g. the customer asked not
        # to be emailed) — the same "primary first" call this project
        # already makes for a customer's identity everywhere else (CUST-1).
        # A secondary `ContactDetail(channel="email")` row is a fallback for
        # a customer whose primary email is blank OR disabled, never a
        # competing target — contrast `WhatsAppAdapter.send`/
        # `SMSAdapter.send`, which have no equivalent primary field on
        # `Customer` to prefer and so go straight to `ContactDetail`. Same
        # `.first()` tie-break as those two if a customer somehow has more
        # than one secondary email on file.
        to_address = (
            message.target_address
            or (customer.email if customer.email_contact_enabled else None)
            or (
                ContactDetail.objects.filter(customer=customer, channel=ContactDetail.Channel.EMAIL)
                .values_list("value", flat=True)
                .first()
            )
        )
        if not to_address:
            raise ValueError(
                f"Cannot send email for ticket #{message.ticket_id}: "
                "its customer has no email address on file."
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
            to=[to_address],
            reply_to=[reply_to],
            connection=connection,
        )
        email.send()
