"""AI-drafted reply suggestions — AI-2 (Story 76), built on AI-0's
`apps.ai.client.generate_completion` and
`apps.ai.prompts.build_grounded_system_prompt` (Story 74). Reuses
`apps.tickets.summarization.build_conversation_transcript` (Story 75) —
the intake's "Draft replies from ticket" text names the same
ticket-plus-messages input `AI-1` already builds.
"""

from apps.ai.client import generate_completion
from apps.ai.prompts import build_grounded_system_prompt, resolve_language_name

from .models import Ticket
from .summarization import build_conversation_transcript

MAX_TOKENS = 1024


def draft_reply(ticket: Ticket) -> str:
    """Draft a reply to the ticket's conversation, grounded in the
    knowledge base via the ticket's subject — a short, stable search
    term across a whole thread; the full transcript is prose, not
    keywords, and would rank poorly against `KB-3`'s full-text search
    (see Story 76 `## Edge Cases`). Raises
    `apps.ai.exceptions.AIServiceError` on failure — unchanged contract;
    `TicketViewSet.suggest_reply` translates it for HTTP.
    """
    transcript = build_conversation_transcript(ticket)
    language_name = resolve_language_name()
    instructions = (
        "You are a support agent's reply-drafting assistant. Draft a "
        "professional, concise reply to the customer's most recent "
        "message in the conversation below, addressing their issue "
        "directly. Use the knowledge base context only if it is "
        f"actually relevant. Respond in {language_name}."
    )
    system = build_grounded_system_prompt(instructions, kb_query=ticket.subject)
    return generate_completion(transcript, system=system, max_tokens=MAX_TOKENS)
