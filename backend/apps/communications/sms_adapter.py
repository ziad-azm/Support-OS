import base64
import hashlib
import hmac
import logging
import urllib.error
import urllib.parse
import urllib.request

from apps.customers.models import ContactDetail, Customer
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message, SmsProviderConfig

logger = logging.getLogger(__name__)


def verify_signature(auth_token: str, url: str, params: dict, signature_header: str) -> bool:
    """Twilio's request-signing algorithm: HMAC-SHA1 over the exact webhook
    URL, followed by every POST parameter's name and value concatenated (no
    separator) in sorted-by-name order, base64-encoded. `params` must
    contain every parameter Twilio sent — Twilio includes all of them
    (`AccountSid`, `To`, `ApiVersion`, ... — not just the fields this
    project reads) in its own computation, so a filtered subset would never
    match. Publicly documented at Twilio's "Validating requests" reference;
    NOT verified against a live Twilio account — see `## Prerequisites`.
    """
    data = url
    for key in sorted(params):
        data += key + params[key]
    expected = base64.b64encode(
        hmac.new(auth_token.encode(), data.encode(), hashlib.sha1).digest()
    ).decode()
    return hmac.compare_digest(expected, signature_header)


@register_adapter
class SMSAdapter(ChannelAdapter):
    """SMS channel — COMM-4, against Twilio's Programmable Messaging API.
    Routing mirrors WhatsApp (Story 15): no per-conversation address tag,
    so identity is matched via `ContactDetail(channel="phone")` (CUST-2) —
    the existing phone contact-detail channel, not a new SMS-specific one,
    since a phone number is the same identity for SMS as for a voice
    contact. See `## Prerequisites`.
    """

    channel = Message.Channel.SMS

    def receive(self, payload: dict) -> Message:
        from_number = payload["from"]
        body = payload["body"]
        message_sid = payload.get("message_sid", "")

        contact = (
            ContactDetail.objects.filter(channel=ContactDetail.Channel.PHONE, value=from_number)
            .select_related("customer")
            .first()
        )
        if contact is not None:
            customer = contact.customer
        else:
            customer = Customer.objects.create(name=from_number, phone=from_number)
            ContactDetail.objects.create(
                customer=customer, channel=ContactDetail.Channel.PHONE, value=from_number
            )

        # Continue the customer's most recent non-closed ticket, or start a
        # new one — same routing rule as WhatsApp (Story 15): SMS has no
        # per-conversation address tag the way email's "+ticket-id" does.
        ticket = (
            Ticket.objects.filter(customer=customer)
            .exclude(status=Ticket.Status.CLOSED)
            .order_by("-created_at")
            .first()
        )
        if ticket is None:
            ticket = Ticket.objects.create(
                subject=f"SMS from {from_number}",
                description=body,
                customer=customer,
            )
            # F-25: same fix as `WhatsAppAdapter.receive` — see its comment.
            try:
                auto_assign_ticket.delay(ticket.id)
            except Exception:
                logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)

        return Message.objects.create(
            ticket=ticket,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.SMS,
            body=body,
            metadata={"from": from_number, "message_sid": message_sid},
        )

    def send(self, message: Message) -> None:
        config = SmsProviderConfig.load()
        if not config.is_configured():
            raise ValueError("SMS sending is not configured (set it at /settings/channels).")

        customer = message.ticket.customer
        # `message.target_address` (an agent's explicit choice, validated by
        # `MessageSerializer.validate`) wins when set. Otherwise, a
        # dedicated `ContactDetail(channel="phone")` row wins — it was
        # deliberately added as a phone contact, so it stays the more
        # specific candidate — falling back to `Customer.phone` itself only
        # if `phone_contact_enabled` (a staff member can switch this off
        # without blanking the number — e.g. it's disconnected).
        to_number = (
            message.target_address
            or ContactDetail.objects.filter(customer=customer, channel=ContactDetail.Channel.PHONE)
            .values_list("value", flat=True)
            .first()
            or (customer.phone if customer.phone_contact_enabled else None)
        )
        if not to_number:
            raise ValueError(
                f"Cannot send SMS for ticket #{message.ticket_id}: "
                "its customer has no phone contact on file."
            )

        url = f"{config.api_base_url}/Accounts/{config.account_sid}/Messages.json"
        body = urllib.parse.urlencode(
            {"To": to_number, "From": config.from_number, "Body": message.body}
        ).encode()
        credentials = base64.b64encode(
            f"{config.account_sid}:{config.auth_token}".encode()
        ).decode()
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            method="POST",
        )
        try:
            urllib.request.urlopen(request, timeout=10)
        except urllib.error.URLError as exc:
            raise ValueError(f"SMS send failed for ticket #{message.ticket_id}: {exc}") from exc
