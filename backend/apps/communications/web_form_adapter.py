import logging

from apps.customers.models import Customer
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket

from .adapters import ChannelAdapter, register_adapter
from .models import Message

logger = logging.getLogger(__name__)


@register_adapter
class WebFormAdapter(ChannelAdapter):
    """Web form — COMM-5. Unlike every other channel, a web form has no
    "reply" concept: it is inbound-only, a one-shot structured intake, not
    a back-and-forth conversation. Unlike WhatsApp/SMS/Live Chat, a
    submission always starts a brand-new Ticket — there is no per-customer
    "continue the most recent open ticket" rule, because each submission is
    a discrete, structured request by design (the intake's own wording),
    not a message in an ongoing exchange. See Story 19 `## Prerequisites`.
    """

    channel = Message.Channel.WEB_FORM

    def receive(self, payload: dict) -> Message:
        name = payload["name"]
        email = payload.get("email")
        subject = payload["subject"]
        description = payload["description"]
        category_id = payload.get("category")

        if email:
            customer, _created = Customer.objects.get_or_create(
                email=email, defaults={"name": name}
            )
        else:
            customer = Customer.objects.create(name=name)

        ticket = Ticket.objects.create(
            subject=subject,
            description=description,
            customer=customer,
            category_id=category_id,
        )
        # F-25: `AssignmentRule`'s own intake goal is "applied on ticket
        # creation" (Story 29), but this adapter creates the `Ticket` row
        # directly rather than going through `TicketViewSet.perform_create`
        # — the one call site that was ever wired to queue it. An
        # unsolicited web-form submission is exactly the "most needs
        # routing" case this rules engine exists for, and it was silently
        # skipping all of them. Same resilience contract as every other
        # `.delay()` call site (`TicketViewSet.perform_create`, Story 29):
        # the row is already committed, so a failure to even queue the task
        # must not fail this request.
        try:
            auto_assign_ticket.delay(ticket.id)
        except Exception:
            logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)

        return Message.objects.create(
            ticket=ticket,
            direction=Message.Direction.INBOUND,
            channel=Message.Channel.WEB_FORM,
            body=description,
        )

    def send(self, message: Message) -> None:
        # A web form has no delivery channel back to whoever submitted it —
        # there is no "reply via web form." MessageViewSet.perform_create
        # (Story 13) catches and logs this like any other adapter.send()
        # failure; the Message itself is already committed regardless.
        raise ValueError("Web form has no outbound delivery — it is an inbound-only channel.")
