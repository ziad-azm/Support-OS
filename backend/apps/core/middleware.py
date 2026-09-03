"""Request correlation and access logging. PROD-1 (Story 88).

See CONVENTIONS.md § 34 for the mechanism and the rules it establishes.
"""

import logging
import time

from .logging import ID_RE, new_request_id, request_id_var, user_id_var

logger = logging.getLogger(__name__)

HEADER = "X-Request-ID"
# A load-balancer liveness probe hits this on a timer forever. One line per
# probe buries every line that matters. apps/core/views.py::HealthView.
SKIP_PATHS = frozenset({"/api/health/"})


class RequestIDMiddleware:
    """Resolve one id per request, publish it to the ContextVar, echo it back.

    Sits at MIDDLEWARE[1] — immediately after CorsMiddleware, which
    config/tests/test_settings.py:96-99 pins at index 0. Everything below this
    point, including SecurityMiddleware's SSL redirect, is correlated.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request_id = self._incoming(request) or new_request_id()
        request.request_id = request_id
        token = request_id_var.set(request_id)
        user_token = user_id_var.set(None)
        try:
            response = self.get_response(request)
            response[HEADER] = request_id
            return response
        finally:
            # Always reset: a ContextVar leaking across requests would
            # mislabel the NEXT request's logs, which is worse than no id
            # because the log then looks correct.
            request_id_var.reset(token)
            user_id_var.reset(user_token)

    @staticmethod
    def _incoming(request) -> str | None:
        """The client may propose an id; the server decides whether to trust it.

        ID_RE bounds it to 8-64 chars of [A-Za-z0-9._-] — no newline, so a
        caller cannot forge a second log line, and no unbounded string, so a
        caller cannot inflate every record. A rejected id is replaced
        silently: it is a hint, not input, so there is nothing to 400 over.
        """
        candidate = request.headers.get(HEADER, "")
        return candidate if ID_RE.fullmatch(candidate) else None


class AccessLogMiddleware:
    """One INFO line per request, with its outcome.

    Sits at MIDDLEWARE[2], inside RequestIDMiddleware, so every line it writes
    is already correlated.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path in SKIP_PATHS:
            return self.get_response(request)

        started = time.monotonic()
        response = self.get_response(request)
        duration_ms = round((time.monotonic() - started) * 1000, 1)

        # DRF assigns the authenticated user back onto the underlying
        # HttpRequest (rest_framework/request.py:235-246), so this — the
        # response phase — is the first point in the stack where a
        # JWT-authenticated user is known. Reading it on the way IN would
        # yield None for every authenticated API call.
        user = getattr(request, "user", None)
        user_id = user.pk if getattr(user, "is_authenticated", False) else None
        user_id_var.set(user_id)

        status = response.status_code
        level = logging.WARNING if status >= 500 else logging.INFO
        logger.log(
            level,
            "%s %s %s",
            request.method,
            request.path,
            status,
            extra={
                # request.path, NOT request.get_full_path(): a query string can
                # carry a credential — EMAIL_INBOUND_WEBHOOK_TOKEN travels as
                # `?token=` (apps/communications, COMM-1). CONVENTIONS.md § 10.
                "http_method": request.method,
                "http_path": request.path,
                "http_status": status,
                "duration_ms": duration_ms,
                # `req_user_id`, not `user_id`: ContextFilter already writes
                # `user_id` onto the record, and a colliding `extra` key raises
                # KeyError from inside the logging machinery.
                "req_user_id": user_id,
            },
        )
        return response
