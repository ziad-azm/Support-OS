"""Envelope shape and renderer behaviour. No database needed."""

from django.apps import apps as django_apps
from django.conf import settings
from django.test import SimpleTestCase

from apps.core.envelope import Envelope, error_envelope, success_envelope
from apps.core.renderers import EnvelopeJSONRenderer

ENVELOPE_KEYS = {"success", "data", "error", "meta"}

EXPECTED_LABELS = [
    "core",
    "accounts",
    "organization",
    "customers",
    "tickets",
    "communications",
    "agents",
    "sla",
    "notifications",
    "knowledge_base",
    "portal",
    "reports",
    "ai",
    "integrations",
]


class _StubResponse:
    def __init__(self, status_code):
        self.status_code = status_code


class DomainAppTests(SimpleTestCase):
    def test_all_domain_apps_are_installed(self):
        for label in EXPECTED_LABELS:
            with self.subTest(app=label):
                self.assertIn(f"apps.{label}", settings.INSTALLED_APPS)
                # Resolves only when apps.py carries the full `apps.` prefix.
                self.assertEqual(django_apps.get_app_config(label).label, label)

    def test_local_apps_list_matches_expected_set(self):
        self.assertEqual(settings.LOCAL_APPS, [f"apps.{label}" for label in EXPECTED_LABELS])


class EnvelopeShapeTests(SimpleTestCase):
    def test_success_envelope_shape(self):
        env = success_envelope({"a": 1})
        self.assertEqual(set(env), ENVELOPE_KEYS)
        self.assertIs(env["success"], True)
        self.assertIsNone(env["error"])
        self.assertEqual(env["data"], {"a": 1})

    def test_error_envelope_fields_always_dict(self):
        env = error_envelope("some_code", "Some message.")
        self.assertEqual(set(env), ENVELOPE_KEYS)
        self.assertIs(env["success"], False)
        self.assertIsNone(env["data"])
        self.assertEqual(env["error"]["fields"], {})
        self.assertNotIn("debug", env["error"])


class RendererTests(SimpleTestCase):
    def setUp(self):
        self.renderer = EnvelopeJSONRenderer()

    def _render(self, data, status_code=200):
        context = {"response": _StubResponse(status_code)}
        return self.renderer.render(data, renderer_context=context)

    def test_renderer_wraps_plain_payload(self):
        body = self._render({"id": 3})
        self.assertIn(b'"success":true', body.replace(b" ", b""))
        self.assertIn(b'"data"', body)

    def test_renderer_does_not_double_wrap_payload_with_success_key(self):
        # A payload of its own that happens to contain "success" must still be
        # nested under data — this is why Envelope is a type, not a key sniff.
        body = self._render({"success": "yes", "id": 3})
        compact = body.replace(b" ", b"")
        self.assertIn(b'"success":true', compact)
        self.assertIn(b'"data":{"success":"yes","id":3}', compact)

    def test_renderer_passes_existing_envelope_through(self):
        env = success_envelope([1, 2], meta={"pagination": {"count": 2}})
        compact = self._render(env).replace(b" ", b"")
        self.assertIn(b'"data":[1,2]', compact)
        self.assertIn(b'"pagination"', compact)
        self.assertNotIn(b'"data":{"success"', compact)

    def test_renderer_returns_empty_body_for_204_and_304(self):
        for code in (204, 304):
            with self.subTest(status=code):
                self.assertEqual(self._render(None, status_code=code), b"")

    def test_renderer_handles_missing_renderer_context(self):
        body = self.renderer.render({"id": 1})
        self.assertIn(b'"success"', body)

    def test_envelope_is_a_dict_subclass(self):
        self.assertIsInstance(success_envelope(), Envelope)
        self.assertIsInstance(success_envelope(), dict)
        self.assertNotIsInstance({"success": True}, Envelope)
