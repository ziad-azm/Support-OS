import hashlib
import hmac
import json
import logging
import urllib.error
import urllib.request

from apps.customers.models import ContactDetail, Customer
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message, WhatsAppProviderConfig

logger = logging.getLogger(__name__)


def verify_signature(secret: str, body: bytes, signature_header: str) -> bool:
    """Meta's `X-Hub-Signature-256` HMAC-SHA256 verification — the same
    convention Meta uses across WhatsApp, Messenger, and Instagram webhooks.
    `body` must be the exact raw request bytes Meta signed, read before DRF
    parses `request.data`. See Story 15 `## Prerequisites`.
    """
    if not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    provided = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, provided)


def extract_text_message(payload: dict) -> dict | None:
    """Meta's Cloud API webhook batches multiple entries/changes per
    request and includes non-message events (status updates, read
    receipts); this project only handles the first `type: "text"` message
    in the batch. Built from Meta's publicly documented Cloud API webhook
    shape — NOT verified against a live WhatsApp Business account. See
    Story 15 `## Prerequisites`.
    """
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for message in change.get("value", {}).get("messages", []):
                if message.get("type") != "text":
                    continue
                return {
                    "from": message.get("from", ""),
                    "body": message.get("text", {}).get("body", ""),
                    "message_id": message.get("id", ""),
                }
    return None


@register_adapter
class WhatsAppAdapter(ChannelAdapter):
    """WhatsApp channel — COMM-2, against Meta's WhatsApp Business (Cloud)
    API. Unlike `EmailAdapter` (COMM-1), routing has no per-conversation
    address tag to key on — a WhatsApp number is the customer's fixed
    identity, matched via `ContactDetail(channel="whatsapp")` (CUST-2,
    Story 11), not `Customer.phone` (unvalidated free text — matching two
    unnormalised fields against each other would only compound the
    unreliability). See Story 15 `## Prerequisites`.
    """

    channel = Message.Channel.WHATSAPP

    def receive(self, payload: dict) -> Message:
        extracted = extract_text_message(payload)
        if extracted is None:
            raise ValueError("No text message found in the WhatsApp webhook payload.")

        from_number = extracted["from"]
        body = extracted["body"]

        contact = (
            ContactDetail.objects.filter(channel=ContactDetail.Channel.WHATSAPP, value=from_number)
            .select_related("customer")
            .first()
        )
        if contact is not None:
            customer = contact.customer
        else:
            customer = Customer.objects.create(name=from_number, phone=from_number)
            ContactDetail.objects.create(
                customer=customer, channel=ContactDetail.Channel.WHATSAPP, value=from_number
            )

        # Continue the customer's most recent non-closed ticket, or start a
        # new one. No per-conversation address tag exists for WhatsApp the
        # way email's "+ticket-id" does — routing keys on customer identity.
        ticket = (
            Ticket.objects.filter(customer=customer)
            .exclude(status=Ticket.Status.CLOSED)
            .order_by("-created_at")
            .first()
        )
        if ticket is None:
            ticket = Ticket.objects.create(
                subject=f"WhatsApp from {from_number}",
                description=body,
                customer=customer,
            )
            # F-25: this brand-new ticket bypasses `TicketViewSet
            # .perform_create` — the only call site ever wired to queue
            # `AssignmentRule`'s own "applied on ticket creation" task
            # (Story 29) — so first-contact WhatsApp, exactly the case
            # that most needs routing, was never auto-assigned. Same
            # resilience contract as every other `.delay()` call site: the
            # row is already committed. Not queued when RESUMING an
            # existing ticket above — that ticket already has whatever
            # assignment it has.
            try:
                auto_assign_ticket.delay(ticket.id)
            except Exception:
                logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)

        return Message.objects.create(
            ticket=ticket,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.WHATSAPP,
            body=body,
            metadata={"from": from_number, "message_id": extracted["message_id"]},
        )

    def send(self, message: Message) -> None:
        config = WhatsAppProviderConfig.load()
        if not config.is_configured():
            raise ValueError("WhatsApp sending is not configured (set it at /settings/channels).")

        customer = message.ticket.customer
        # `message.target_address` (an agent's explicit choice, validated by
        # `MessageSerializer.validate`) wins when set. Otherwise, a
        # dedicated `ContactDetail(channel="whatsapp")` row wins — it was
        # deliberately added as this customer's WhatsApp identity, so it
        # stays the more specific candidate — falling back to
        # `Customer.phone` itself only if `whatsapp_enabled` (the shortcut
        # for "the primary phone is ALSO my WhatsApp number").
        to_number = (
            message.target_address
            or ContactDetail.objects.filter(
                customer=customer, channel=ContactDetail.Channel.WHATSAPP
            )
            .values_list("value", flat=True)
            .first()
            or (customer.phone if customer.whatsapp_enabled else None)
        )
        if not to_number:
            raise ValueError(
                f"Cannot send WhatsApp message for ticket #{message.ticket_id}: "
                "its customer has no WhatsApp contact on file."
            )

        url = f"{config.api_base_url}/{config.phone_number_id}/messages"
        body = json.dumps(
            {
                "messaging_product": "whatsapp",
                "to": to_number,
                "type": "text",
                "text": {"body": message.body},
            }
        ).encode()
        request = urllib.request.Request(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {config.access_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            urllib.request.urlopen(request, timeout=10)
        except urllib.error.URLError as exc:
            raise ValueError(
                f"WhatsApp send failed for ticket #{message.ticket_id}: {exc}"
            ) from exc
