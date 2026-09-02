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
