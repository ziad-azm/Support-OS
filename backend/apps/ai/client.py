"""The single AI integration point — AI-0 (Story 74). Every AI-1..AI-5
story calls `generate_completion` here instead of importing `anthropic`
directly (SupportOs backlog.MD:822, "single AI integration point; features
call it, don't re-integrate.").
"""

import logging

import anthropic
from django.conf import settings

from .exceptions import AIServiceError

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | None = None


def get_client() -> anthropic.Anthropic:
    """Lazily construct the module-level Anthropic client. Reads
    `settings.ANTHROPIC_API_KEY` explicitly rather than letting the SDK's
    own env-var/`ant auth login` auto-discovery run — see `base.py`'s
    AI-0 settings block. Refuses to run against a blank key, the same
    "fail closed until configured" shape `WhatsAppAdapter.send`
    (`apps/communications/whatsapp_adapter.py:109-114`) already
    establishes for an unconfigured integration.
    """
    global _client
    if _client is None:
        if not settings.ANTHROPIC_API_KEY:
            raise AIServiceError("AI features are not configured (ANTHROPIC_API_KEY is blank).")
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def generate_completion(
    user_prompt: str,
    *,
    system: str | None = None,
    max_tokens: int = 4096,
    model: str | None = None,
) -> str:
    """Single-turn completion — the one function every AI-1..AI-5 story
    calls. `max_tokens=4096` covers a summary, a suggested reply, or a
    categorization label without truncation; a future story with a
    longer-form need (e.g. AI-5's chatbot) passes its own `max_tokens`
    rather than this default changing for everyone. `model` defaults to
    `settings.AI_MODEL` so a caller normally names no model at all; a
    story may still override per call if a specific task needs a
    different model tier.

    Raises `AIServiceError` for every failure mode (unconfigured client,
    provider error, network error, empty response) — never lets an
    `anthropic.*` exception reach the caller.
    """
    client = get_client()
    try:
        response = client.messages.create(
            model=model or settings.AI_MODEL,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
        )
    except anthropic.APIStatusError as exc:
        logger.error("AI provider returned status %s", exc.status_code)
        raise AIServiceError(f"AI provider error (status {exc.status_code}).") from exc
    except anthropic.APIConnectionError as exc:
        logger.error("AI provider connection failed: %s", exc.__class__.__name__)
        raise AIServiceError("Could not reach the AI provider.") from exc

    text = next((block.text for block in response.content if block.type == "text"), "")
    if not text:
        raise AIServiceError("AI provider returned an empty response.")
    return text
