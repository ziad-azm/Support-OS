"""Sentry event hygiene. PROD-1 (Story 88).

Imported from settings — keep it dependency-free beyond this package's own
`logging` module (see that module's docstring for why nothing Django-app-level
may be imported at settings time).
"""

from .logging import REDACTED, SENSITIVE_KEY_RE, get_request_id, scrub


def before_send(event, hint):
    """Last gate before an event leaves the process.

    `send_default_pii=False` and `max_request_body_size="never"` already stop
    the common leaks; this closes the two they do not: a header dict the Django
    integration still attaches, and anything a call site put in `extra`. Tag
    every event with the request id so a Sentry issue and a log line are one
    query apart. CONVENTIONS.md § 10, § 34.
    """
    request_id = get_request_id()
    if request_id:
        event.setdefault("tags", {})["request_id"] = request_id

    request = event.get("request")
    if isinstance(request, dict):
        request.pop("data", None)
        request.pop("cookies", None)
        # Same `?token=` reason AccessLogMiddleware logs `path`, not full path.
        request.pop("query_string", None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {
                key: (REDACTED if SENSITIVE_KEY_RE.search(str(key)) else value)
                for key, value in headers.items()
            }

    extra = event.get("extra")
    if isinstance(extra, dict):
        event["extra"] = scrub(extra)

    return event
