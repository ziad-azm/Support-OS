"""The single response shape for the whole API (`API` shared spec).

Every response body is:

    {
      "success": bool,
      "data":    <payload> | null,
      "error":   null | {"code": str, "message": str, "fields": {str: [str]}},
      "meta":    null | {"pagination": {...}}
    }

All four keys are always present, so a client can discriminate on `success`
without probing for optional keys.

`error` additionally carries `request_id` (PROD-1) whenever the failure
happened inside a request, and `debug` (traceback) only under DEBUG=True. Both
are conditional; neither is a top-level key, because the four above are pinned
by apps/core/tests/test_exceptions.py:30. See CONVENTIONS.md § 34.
"""

from typing import Any

from .logging import get_request_id


class Envelope(dict):
    """Marker type for a body that is already in envelope form.

    A subclass of `dict` rather than a sniff for a "success" key: an endpoint
    whose own payload happens to contain "success" must never be mistaken for
    an already-wrapped body.
    """


def success_envelope(data: Any = None, meta: dict | None = None) -> Envelope:
    return Envelope(success=True, data=data, error=None, meta=meta)


def error_envelope(
    code: str,
    message: str,
    fields: dict[str, list[str]] | None = None,
    debug: dict | None = None,
) -> Envelope:
    error: dict[str, Any] = {"code": code, "message": message, "fields": fields or {}}
    # PROD-1: the one string that ties a user's screenshot to a log line and a
    # Sentry issue. Inside `error`, not at the top level and not in `meta` —
    # apps/core/tests/test_exceptions.py:30 pins the four top-level keys, and
    # test_health.py:30 pins `meta` to None on a success. Conditional for the
    # same reason `debug` is: outside a request there is no id to report.
    request_id = get_request_id()
    if request_id:
        error["request_id"] = request_id
    if debug is not None:
        error["debug"] = debug
    return Envelope(success=False, data=None, error=error, meta=None)
