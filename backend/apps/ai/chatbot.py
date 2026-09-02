"""The KB-grounded portal chatbot — AI-5 (Story 79). Built on AI-0's
`generate_chat_completion` (task 1) and `apps.ai.prompts`; the
conversation itself is a `Ticket` plus `Message` rows, the same spine
`COMM-3`'s live-chat widget already uses.
"""

import logging

from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.communications.models import Message
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket
from apps.tickets.summarization import MAX_TRANSCRIPT_MESSAGES

from .client import generate_chat_completion
from .models import ChatbotSession
from .prompts import build_grounded_system_prompt, resolve_language_name

logger = logging.getLogger(__name__)

BOT_AUTHOR = "chatbot"
# The model is told to emit this exact token when it cannot help. Checked
# with `in`, then stripped, so a reply that both answers partially AND
# gives up still reaches the customer without the marker leaking.
HANDOFF_MARKER = "[HANDOFF]"
MAX_TOKENS = 1024


def get_or_start_session(customer) -> ChatbotSession:
    """The customer's current bot conversation, or a new one. Returns the
    customer's most recent NON-CLOSED session regardless of handoff
    state — a handed-off-but-still-open ticket is returned as-is, so a
    `GET`/`POST` against it keeps seeing `handed_off_at` set (the widget
    keeps showing the handoff banner; `PortalChatbotView.post` correctly
    rejects a further message) until staff closes the ticket. Excluding
    handed-off sessions here would make that rejection unreachable — a
    customer messaging a stale, already-handed-off tab would silently get
    a brand-new bot conversation instead of the "this is now with a
    human" response the story's own Edge Cases specify. Only a CLOSED
    ticket starts a genuinely fresh session.
    """
    session = (
        ChatbotSession.objects.filter(ticket__customer=customer)
        .exclude(ticket__status=Ticket.Status.CLOSED)
        .select_related("ticket")
        .order_by("-created_at")
        .first()
    )
    if session is not None:
        return session

    # `[:200]` for the same reason `LiveChatAdapter.start_session` slices:
    # `Ticket.subject` is `max_length=200`, and the translated prefix's own
    # length varies by locale, so an over-long customer name would
    # otherwise reach Postgres as an unhandled `DataError`.
    subject = (_("Assistant chat with %(name)s") % {"name": customer.name})[:200]
    ticket = Ticket.objects.create(
        subject=subject,
        description=_("Started via the portal assistant."),
        customer=customer,
    )
    return ChatbotSession.objects.create(ticket=ticket)


def build_history(ticket: Ticket) -> list[dict]:
    """The ticket's messages as an Anthropic-shaped alternating history,
    oldest first, capped to the most recent `MAX_TRANSCRIPT_MESSAGES`
    (reusing AI-1's own window rather than a second constant). An inbound
    message is the customer (`user`); anything outbound — the bot's own
    turns, and any reply a human agent has since sent — is `assistant`.
    """
    recent = list(
        Message.objects.filter(ticket=ticket).order_by("-created_at")[:MAX_TRANSCRIPT_MESSAGES]
    )
    recent.reverse()
    return [
        {
            "role": "user" if message.direction == Message.Direction.INBOUND else "assistant",
            "content": message.body,
        }
        for message in recent
    ]


def _system_prompt(latest_body: str) -> str:
    instructions = (
        "You are a customer-support assistant for this company's help "
        "portal. Answer the customer's question directly and concisely, "
        "using the knowledge base context when it is relevant. If you "
        "cannot answer confidently, or the customer asks for a person, "
        f"end your reply with the exact token {HANDOFF_MARKER} so the "
        "conversation is passed to a human agent. Never invent policies, "
        "prices, or account details. Respond in "
        f"{resolve_language_name()}."
    )
    return build_grounded_system_prompt(instructions, kb_query=latest_body)


def answer(session: ChatbotSession, body: str) -> None:
    """Persist the customer's turn, generate the bot's grounded reply,
    persist it, and hand off if the model asked to. Raises
    `apps.ai.exceptions.AIServiceError` on provider failure — the
    customer's own message is already committed by then, so their turn is
    never lost to a provider outage (the same "the record is already
    committed" resilience rule `MessageViewSet.perform_create` follows).
    """
    Message.objects.create(
        ticket=session.ticket,
        direction=Message.Direction.INBOUND,
        channel=Message.Channel.CHAT,
        body=body,
    )

    reply = generate_chat_completion(
        build_history(session.ticket),
        system=_system_prompt(body),
        max_tokens=MAX_TOKENS,
    )
    wants_handoff = HANDOFF_MARKER in reply
    cleaned = reply.replace(HANDOFF_MARKER, "").strip()

    Message.objects.create(
        ticket=session.ticket,
        direction=Message.Direction.OUTBOUND,
        channel=Message.Channel.CHAT,
        body=cleaned,
        metadata={"author": BOT_AUTHOR},
    )
    if wants_handoff:
        hand_off(session)


def hand_off(session: ChatbotSession) -> None:
    """Stop the bot and put the ticket in front of a human. Idempotent —
    a second call on an already-handed-off session is a no-op, not an
    error. Queues `SLA-2`'s own `auto_assign_ticket` (a chatbot ticket is
    deliberately NOT auto-assigned at creation, only here) inside the
    same `try/except` every other caller of it uses.
    """
    if session.handed_off_at is not None:
        return
    session.handed_off_at = timezone.now()
    session.save(update_fields=["handed_off_at", "updated_at"])
    try:
        auto_assign_ticket.delay(session.ticket_id)
    except Exception:
        # Same resilience contract as every other `.delay()` call site in
        # this project — the handoff itself is already committed.
        logger.exception("Failed to queue auto-assignment for ticket %s", session.ticket_id)
