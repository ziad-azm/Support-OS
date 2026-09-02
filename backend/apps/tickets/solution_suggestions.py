"""AI-matched knowledge-base solutions — AI-4 (Story 78), built on AI-0's
`apps.ai.client.generate_completion` and
`apps.ai.prompts.ground_with_knowledge_base` (Story 74). Reuses
`apps.tickets.summarization.build_conversation_transcript` (Story 75) for
the same ticket-plus-messages context AI-1/AI-2 already build.
"""

from apps.ai.client import generate_completion
from apps.ai.prompts import ground_with_knowledge_base

from .models import Ticket
from .summarization import build_conversation_transcript

QUERY_MAX_TOKENS = 32

_QUERY_EXTRACTION_SYSTEM = (
    "Read the support ticket conversation below and respond with ONLY a "
    "short knowledge-base search phrase (3-8 words) capturing the "
    "customer's core issue. No punctuation, no explanation — the phrase "
    "and nothing else."
)


def find_ticket_solutions(ticket: Ticket) -> dict:
    """Extracts a short search phrase from the ticket's conversation, then
    matches it against the knowledge base via AI-0's own grounding helper
    (`KB-3`'s `search_knowledge_base`, wrapped by
    `apps.ai.prompts.ground_with_knowledge_base`). Returns `{"query":
    <str>, "results": <list[dict]>}` — `results` is `search_knowledge_base`'s
    own per-item shape, unmodified. Raises
    `apps.ai.exceptions.AIServiceError` on failure — unchanged contract;
    `TicketViewSet.suggest_solutions` translates it for HTTP.
    """
    transcript = build_conversation_transcript(ticket)
    query = generate_completion(
        transcript, system=_QUERY_EXTRACTION_SYSTEM, max_tokens=QUERY_MAX_TOKENS
    ).strip()
    results = ground_with_knowledge_base(query)
    return {"query": query, "results": results}
