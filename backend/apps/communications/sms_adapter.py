import base64
import hashlib
import hmac
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

from apps.customers.models import ContactDetail, Customer
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message


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

        return Message.objects.create(
            ticket=ticket,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.SMS,
            body=body,
            metadata={"from": from_number, "message_sid": message_sid},
        )

    def send(self, message: Message) -> None:
        if not (
            settings.SMS_API_BASE_URL
            and settings.SMS_ACCOUNT_SID
            and settings.SMS_AUTH_TOKEN
            and settings.SMS_FROM_NUMBER
        ):
            raise ValueError("SMS sending is not configured (SMS_* settings are blank).")

        contact = ContactDetail.objects.filter(
            customer=message.ticket.customer, channel=ContactDetail.Channel.PHONE
        ).first()
        if contact is None:
            raise ValueError(
                f"Cannot send SMS for ticket #{message.ticket_id}: "
                "its customer has no phone contact on file."
            )

        url = f"{settings.SMS_API_BASE_URL}/Accounts/{settings.SMS_ACCOUNT_SID}/Messages.json"
        body = urllib.parse.urlencode(
            {"To": contact.value, "From": settings.SMS_FROM_NUMBER, "Body": message.body}
        ).encode()
        credentials = base64.b64encode(
            f"{settings.SMS_ACCOUNT_SID}:{settings.SMS_AUTH_TOKEN}".encode()
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
