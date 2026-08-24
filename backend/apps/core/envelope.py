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
"""

from typing import Any


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
    if debug is not None:
        error["debug"] = debug
    return Envelope(success=False, data=None, error=error, meta=None)
