from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException


class AIServiceError(Exception):
    """Raised for any AI-service failure — unconfigured credentials, a
    provider error, or a network failure. The one exception type a later
    AI-* story's view needs to catch; `apps/ai/client.py` never lets an
    `anthropic.*` exception escape past this module. See Story 74
    `## Story Goal` — "single AI integration point."

    Uncaught, this reaches `apps.core.exceptions.envelope_exception_handler`
    like any other exception DRF does not recognise, and becomes a logged,
    generic `500 internal_error` envelope (`apps/core/exceptions.py:98-112`)
    — a safe default until a calling view chooses to catch it and return a
    friendlier error.
    """


class AIServiceUnavailable(APIException):
    """DRF-recognized translation of `AIServiceError` for a view that
    wants a clean `503` instead of falling through to
    `envelope_exception_handler`'s generic `500 internal_error`
    (`apps/core/exceptions.py:98-112`). A view catches `AIServiceError`
    and raises this instead; `apps.ai.client`/`apps.ai.prompts` never
    raise it themselves — they have no HTTP context. First real caller:
    Story 75 (`AI-1`, `TicketViewSet.summarize`), reusable by every later
    `AI-*` view.
    """

    status_code = 503
    default_code = "ai_service_unavailable"
    default_detail = _("The AI service is temporarily unavailable. Please try again shortly.")
