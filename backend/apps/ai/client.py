"""The single AI integration point — AI-0 (Story 74). Every AI-1..AI-5
story calls `generate_completion`/`generate_chat_completion` here instead
of importing a provider SDK directly (SupportOs backlog.MD:822, "single AI
integration point; features call it, don't re-integrate.").

Two providers are supported. `settings.AI_PROVIDER` ("anthropic" or
"gemini") picks which one explicitly — not "whichever key is set" — so
having both `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` populated never
leaves it ambiguous which one actually runs. No AI-1..AI-5 story needs to
know or care which provider answered.
"""

import logging

import anthropic
import httpx
from django.conf import settings
from google import genai
from google.genai import errors as genai_errors

from .exceptions import AIServiceError

logger = logging.getLogger(__name__)

_client: anthropic.Anthropic | genai.Client | None = None
_provider: str | None = None


def get_client() -> tuple[anthropic.Anthropic | genai.Client, str]:
    """Lazily construct the module-level client for `settings.AI_PROVIDER`.
    Reads the provider's key explicitly rather than letting either SDK's
    own env-var auto-discovery run — see `base.py`'s AI-0 settings block.
    Refuses to run against an unrecognized `AI_PROVIDER` value or a blank
    key for the selected provider, the same "fail closed until
    configured" shape `WhatsAppAdapter.send`
    (`apps/communications/whatsapp_adapter.py:109-114`) already
    establishes for an unconfigured integration.
    """
    global _client, _provider
    if _client is None:
        provider = settings.AI_PROVIDER
        if provider == "anthropic":
            if not settings.ANTHROPIC_API_KEY:
                raise AIServiceError("AI_PROVIDER is 'anthropic' but ANTHROPIC_API_KEY is blank.")
            _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        elif provider == "gemini":
            if not settings.GEMINI_API_KEY:
                raise AIServiceError("AI_PROVIDER is 'gemini' but GEMINI_API_KEY is blank.")
            _client = genai.Client(api_key=settings.GEMINI_API_KEY)
        else:
            raise AIServiceError(
                f"Unknown AI_PROVIDER '{provider}' (expected 'anthropic' or 'gemini')."
            )
        _provider = provider
    return _client, _provider


def _default_model(provider: str) -> str:
    return settings.AI_MODEL if provider == "anthropic" else settings.GEMINI_MODEL


def _call_anthropic(
    client: anthropic.Anthropic,
    *,
    model: str,
    max_tokens: int,
    system: str | None,
    messages: list[dict],
) -> str:
    try:
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
        )
    except anthropic.APIStatusError as exc:
        logger.error("AI provider returned status %s", exc.status_code)
        raise AIServiceError(f"AI provider error (status {exc.status_code}).") from exc
    except anthropic.APIConnectionError as exc:
        logger.error("AI provider connection failed: %s", exc.__class__.__name__)
        raise AIServiceError("Could not reach the AI provider.") from exc

    return next((block.text for block in response.content if block.type == "text"), "")


def _call_gemini(
    client: genai.Client,
    *,
    model: str,
    max_tokens: int,
    system: str | None,
    messages: list[dict],
) -> str:
    # Gemini's wire shape uses "model" where Anthropic uses "assistant";
    # translating here keeps every caller's history in the one Anthropic
    # shape `apps.ai.chatbot.build_history` already produces.
    contents = [
        {
            "role": "model" if message["role"] == "assistant" else "user",
            "parts": [{"text": message["content"]}],
        }
        for message in messages
    ]
    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=max_tokens,
                # Gemini 3.x's hidden reasoning tokens are drawn from the
                # same max_output_tokens budget as the visible answer —
                # confirmed live: `apps/ai/categorization.py`'s 64-token
                # budget hit MAX_TOKENS with an empty response before this
                # was added. "MINIMAL" is the lowest level Gemini 3.x
                # exposes (thinking can't be fully disabled, same as
                # Claude Opus 5); `thinking_budget` is the pre-3.5 knob
                # and errors outright on this model family.
                thinking_config=genai.types.ThinkingConfig(thinking_level="MINIMAL"),
            ),
        )
    except genai_errors.APIError as exc:
        logger.error("AI provider returned status %s", exc.status)
        raise AIServiceError(f"AI provider error (status {exc.status}).") from exc
    except (httpx.ConnectError, httpx.TimeoutException) as exc:
        logger.error("AI provider connection failed: %s", exc.__class__.__name__)
        raise AIServiceError("Could not reach the AI provider.") from exc

    return response.text or ""


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
    `settings.AI_MODEL` (Anthropic) or `settings.GEMINI_MODEL` (Gemini
    fallback) so a caller normally names no model at all; a story may
    still override per call if a specific task needs a different model.

    Raises `AIServiceError` for every failure mode (unconfigured client,
    provider error, network error, empty response) — never lets a
    provider-specific exception reach the caller.
    """
    client, provider = get_client()
    resolved_model = model or _default_model(provider)
    messages = [{"role": "user", "content": user_prompt}]

    if provider == "anthropic":
        text = _call_anthropic(
            client, model=resolved_model, max_tokens=max_tokens, system=system, messages=messages
        )
    else:
        text = _call_gemini(
            client, model=resolved_model, max_tokens=max_tokens, system=system, messages=messages
        )

    if not text:
        raise AIServiceError("AI provider returned an empty response.")
    return text


def generate_chat_completion(
    messages: list[dict],
    *,
    system: str | None = None,
    max_tokens: int = 1024,
    model: str | None = None,
) -> str:
    """Multi-turn completion — the extension Story 74 `## Story Goal`
    deferred to AI-5. `messages` is the full alternating history in the
    Anthropic wire shape (`{"role": "user"|"assistant", "content": str}`),
    oldest first; the caller owns history construction (see
    `apps.ai.chatbot.build_history`). Translated to the Gemini wire shape
    internally when Gemini is the active provider.

    Identical failure contract to `generate_completion`: every
    provider-specific error becomes an `AIServiceError`, and neither the
    prompt nor the response is ever logged (CONVENTIONS.md §10).
    """
    client, provider = get_client()
    resolved_model = model or _default_model(provider)

    if provider == "anthropic":
        text = _call_anthropic(
            client, model=resolved_model, max_tokens=max_tokens, system=system, messages=messages
        )
    else:
        text = _call_gemini(
            client, model=resolved_model, max_tokens=max_tokens, system=system, messages=messages
        )

    if not text:
        raise AIServiceError("AI provider returned an empty response.")
    return text
