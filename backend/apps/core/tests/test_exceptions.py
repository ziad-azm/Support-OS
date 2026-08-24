"""The global exception handler: one error shape for every failure. No DB."""

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from django.test import SimpleTestCase, override_settings
from rest_framework import exceptions as drf_exceptions
from rest_framework.test import APIRequestFactory

from apps.core.exceptions import (
    INTERNAL_MESSAGE,
    NON_FIELD_KEY,
    VALIDATION_MESSAGE,
    envelope_exception_handler,
)

ENVELOPE_KEYS = {"success", "data", "error", "meta"}


class ExceptionHandlerTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def handle(self, exc):
        request = self.factory.get("/api/anything/")
        return envelope_exception_handler(exc, {"request": request, "view": None})

    def assertEnvelope(self, response, status, code):
        self.assertEqual(response.status_code, status)
        self.assertEqual(set(response.data), ENVELOPE_KEYS)
        self.assertIs(response.data["success"], False)
        self.assertIsNone(response.data["data"])
        self.assertEqual(response.data["error"]["code"], code)
        return response.data["error"]

    def test_http404_maps_to_not_found(self):
        self.assertEnvelope(self.handle(Http404()), 404, "not_found")

    def test_drf_not_found_maps_to_not_found(self):
        self.assertEnvelope(self.handle(drf_exceptions.NotFound()), 404, "not_found")

    def test_django_permission_denied_maps_to_403(self):
        self.assertEnvelope(self.handle(DjangoPermissionDenied()), 403, "permission_denied")

    def test_not_authenticated_maps_to_401(self):
        exc = drf_exceptions.NotAuthenticated()
        self.assertEnvelope(self.handle(exc), 401, "not_authenticated")

    def test_method_not_allowed_maps_to_405(self):
        exc = drf_exceptions.MethodNotAllowed("POST")
        self.assertEnvelope(self.handle(exc), 405, "method_not_allowed")

    def test_parse_error_maps_to_400(self):
        self.assertEnvelope(self.handle(drf_exceptions.ParseError()), 400, "parse_error")

    def test_drf_validation_error_dict_becomes_fields(self):
        exc = drf_exceptions.ValidationError({"email": ["Enter a valid email address."]})
        error = self.assertEnvelope(self.handle(exc), 400, "validation_error")
        self.assertEqual(error["message"], VALIDATION_MESSAGE)
        self.assertEqual(error["fields"], {"email": ["Enter a valid email address."]})

    def test_validation_error_string_goes_to_non_field_errors(self):
        exc = drf_exceptions.ValidationError("Too late.")
        error = self.assertEnvelope(self.handle(exc), 400, "validation_error")
        self.assertEqual(error["fields"], {NON_FIELD_KEY: ["Too late."]})

    def test_nested_validation_error_is_flattened_to_strings(self):
        exc = drf_exceptions.ValidationError({"address": {"city": ["This field is required."]}})
        error = self.assertEnvelope(self.handle(exc), 400, "validation_error")
        self.assertEqual(error["fields"], {"address": ["city: This field is required."]})

    def test_django_validation_error_with_field_dict(self):
        exc = DjangoValidationError({"name": ["This field cannot be blank."]})
        error = self.assertEnvelope(self.handle(exc), 400, "validation_error")
        self.assertEqual(error["fields"], {"name": ["This field cannot be blank."]})

    def test_django_validation_error_without_fields(self):
        exc = DjangoValidationError("Bad input.")
        error = self.assertEnvelope(self.handle(exc), 400, "validation_error")
        self.assertEqual(error["fields"], {NON_FIELD_KEY: ["Bad input."]})

    def test_throttled_keeps_retry_after_header(self):
        response = self.handle(drf_exceptions.Throttled(wait=30))
        self.assertEnvelope(response, 429, "throttled")
        # response.data was reassigned; the header must survive it.
        self.assertIn("Retry-After", response)

    def test_unhandled_exception_returns_500_envelope(self):
        with self.assertLogs("apps.core.exceptions", level="ERROR"):
            response = self.handle(KeyError("boom"))
        error = self.assertEnvelope(response, 500, "internal_error")
        self.assertEqual(error["message"], INTERNAL_MESSAGE)

    @override_settings(DEBUG=False)
    def test_no_traceback_when_debug_false(self):
        with self.assertLogs("apps.core.exceptions", level="ERROR"):
            response = self.handle(KeyError("boom"))
        self.assertNotIn("debug", response.data["error"])

    @override_settings(DEBUG=True)
    def test_traceback_present_when_debug_true(self):
        with self.assertLogs("apps.core.exceptions", level="ERROR"):
            response = self.handle(KeyError("boom"))
        debug = response.data["error"]["debug"]
        self.assertIn("KeyError", debug["exception"])
        self.assertTrue(debug["traceback"])
