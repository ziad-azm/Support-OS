"""Global DRF exception handler: one error shape for the whole API."""

import logging
import traceback

from django.conf import settings
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions as drf_exceptions
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from .envelope import error_envelope

logger = logging.getLogger(__name__)

VALIDATION_MESSAGE = "The submitted data is invalid."
INTERNAL_MESSAGE = "An unexpected error occurred."
NON_FIELD_KEY = "non_field_errors"


def envelope_exception_handler(exc, context):
    """Map any exception raised inside a DRF view to the standard envelope."""
    exc = _to_drf_exception(exc)
    response = drf_exception_handler(exc, context)

    if response is None:
        # DRF does not recognise this exception. Returning a Response rather
        # than None is what stops it escaping as an HTML 500.
        return _internal_error_response(exc, context)

    if isinstance(exc, drf_exceptions.ValidationError):
        code, message, fields = (
            "validation_error",
            VALIDATION_MESSAGE,
            _normalise_fields(exc.detail),
        )
    else:
        code = getattr(exc, "default_code", "error")
        message = _first_message(exc.detail)
        fields = {}

    response.data = error_envelope(code=code, message=message, fields=fields)
    return response


def _to_drf_exception(exc):
    """Translate Django's own exceptions into their DRF equivalents."""
    if isinstance(exc, Http404):
        return drf_exceptions.NotFound()
    if isinstance(exc, DjangoPermissionDenied):
        return drf_exceptions.PermissionDenied()
    if isinstance(exc, DjangoValidationError):
        detail = getattr(exc, "message_dict", None) or exc.messages
        return drf_exceptions.ValidationError(detail=detail)
    return exc


def _normalise_fields(detail) -> dict[str, list[str]]:
    """Flatten a DRF ValidationError detail into {field: [message, ...]}."""
    if isinstance(detail, dict):
        return {str(key): _as_message_list(value) for key, value in detail.items()}
    return {NON_FIELD_KEY: _as_message_list(detail)}


def _as_message_list(value) -> list[str]:
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    if isinstance(value, dict):
        # Nested serializer: flatten one level so the client gets flat strings.
        return [f"{key}: {msg}" for key, msgs in value.items() for msg in _as_message_list(msgs)]
    return [str(value)]


def _first_message(detail) -> str:
    if isinstance(detail, dict):
        return _first_message(next(iter(detail.values()), INTERNAL_MESSAGE))
    if isinstance(detail, (list, tuple)):
        return _first_message(detail[0]) if detail else INTERNAL_MESSAGE
    return str(detail)


def _internal_error_response(exc, context):
    request = context.get("request")
    logger.exception(
        "Unhandled exception at %s", getattr(request, "path", "<unknown>"), exc_info=exc
    )
    debug = None
    if settings.DEBUG:
        debug = {
            "exception": repr(exc),
            "traceback": traceback.format_exception(type(exc), exc, exc.__traceback__),
        }
    return Response(
        error_envelope("internal_error", INTERNAL_MESSAGE, debug=debug),
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
