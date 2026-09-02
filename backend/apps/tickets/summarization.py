"""Ticket-conversation summarization — AI-1 (Story 75), built on AI-0's
`apps.ai.client.generate_completion` (Story 74). Same "module docstring,
one cap constant, one function returning plain data" shape as
`history.py`/`context.py` in this same app.
"""

from apps.ai.client import generate_completion
from apps.ai.prompts import resolve_language_name
from apps.communications.models import Message

from .models import Ticket

# Realistic ticket volumes in this project are dozens of messages, not
# thousands — the same scale assumption `apps/knowledge_base/search.py`
# (KB-3) makes for FAQ/Article counts. This is a safety bound against a
# pathological outlier, not a normal-case truncation: at Claude Opus 5's
# context window, even 50 long messages is a small fraction of what the
# model can accept.
MAX_TRANSCRIPT_MESSAGES = 50


def build_conversation_transcript(ticket: Ticket) -> str:
    """The ticket's subject, description, and up to its most recent
    `MAX_TRANSCRIPT_MESSAGES` messages, oldest-first within that window.
    An agent needs the conversation's CURRENT state summarized, not its
    earliest history, so a ticket over the cap keeps its most recent
    activity — `.order_by("-created_at")[:N]` then reversed back to
    chronological order, not `Message.Meta.ordering`'s own ascending
    order sliced directly (which would keep the OLDEST N instead).
    """
    lines = [f"Subject: {ticket.subject}", f"Description: {ticket.description}", ""]

    recent_messages = list(
        Message.objects.filter(ticket=ticket).order_by("-created_at")[:MAX_TRANSCRIPT_MESSAGES]
    )
    recent_messages.reverse()

    for message in recent_messages:
        speaker = "Customer" if message.direction == Message.Direction.INBOUND else "Agent"
        lines.append(f"{speaker}: {message.body}")

    return "\n".join(lines)


def summarize_ticket(ticket: Ticket) -> str:
    """Build the transcript and summarize it via AI-0's single integration
    point. Raises `apps.ai.exceptions.AIServiceError` on any failure —
    unchanged from `generate_completion`'s own contract; the caller
    (`TicketViewSet.summarize`) decides how to translate that for HTTP.
    """
    transcript = build_conversation_transcript(ticket)
    language_name = resolve_language_name()
    system = (
        "You are a support-ticket summarization assistant. Summarize the "
        "conversation below for a support agent in 2-4 concise sentences, "
        "focused on the customer's issue and its current state. Respond "
        f"in {language_name}."
    )
    return generate_completion(transcript, system=system, max_tokens=512)
