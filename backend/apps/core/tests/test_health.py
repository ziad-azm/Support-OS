"""GET /api/health/ — the intake's literal outcome for the API task.

Most of these run without a database: `ensure_connection` is patched, so the
view makes no query. `HealthDatabaseIntegrationTests` is the one class that
needs a live local PostgreSQL.
"""

from unittest import mock

from django.db.utils import OperationalError
from django.test import SimpleTestCase, TestCase
from django.urls import reverse

ENVELOPE_KEYS = {"success", "data", "error", "meta"}


class HealthEnvelopeTests(SimpleTestCase):
    def test_health_url_reverses_by_name(self):
        # Pinned so FND-3 can hardcode this path in the Axios layer.
        self.assertEqual(reverse("core:health"), "/api/health/")

    @mock.patch("apps.core.views.connection.ensure_connection", return_value=None)
    def test_health_returns_envelope(self, _ensure):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), ENVELOPE_KEYS)
        self.assertIs(body["success"], True)
        self.assertIsNone(body["error"])
        self.assertIsNone(body["meta"])
        self.assertEqual(body["data"], {"status": "ok", "database": "ok"})

    @mock.patch(
        "apps.core.views.connection.ensure_connection",
        side_effect=OperationalError("down"),
    )
    def test_health_reports_degraded_when_database_unreachable(self, _ensure):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 503)
        body = response.json()
        self.assertEqual(set(body), ENVELOPE_KEYS)
        self.assertEqual(body["data"], {"status": "degraded", "database": "error"})
        self.assertIsNone(body["error"])

    @mock.patch("apps.core.views.connection.ensure_connection", return_value=None)
    def test_wrong_method_returns_error_envelope(self, _ensure):
        response = self.client.post("/api/health/", data={}, content_type="application/json")
        self.assertEqual(response.status_code, 405)
        body = response.json()
        self.assertIs(body["success"], False)
        self.assertEqual(body["error"]["code"], "method_not_allowed")

    @mock.patch("apps.core.views.connection.ensure_connection", return_value=None)
    def test_html_accept_header_returns_json_envelope(self, _ensure):
        # Only a JSON renderer is registered, so a browser gets 406 — and the
        # error must still serialise, even though negotiation itself failed.
        response = self.client.get("/api/health/", headers={"accept": "text/html"})
        self.assertEqual(response.status_code, 406)
        body = response.json()
        self.assertIs(body["success"], False)
        self.assertEqual(body["error"]["code"], "not_acceptable")

    @mock.patch("apps.core.views.connection.ensure_connection", return_value=None)
    def test_malformed_json_body_is_enveloped(self, _ensure):
        response = self.client.post(
            "/api/health/", data="{", content_type="application/json"
        )
        body = response.json()
        self.assertIs(body["success"], False)
        # Either the parser or the method check fires first; both are uniform.
        self.assertIn(body["error"]["code"], {"parse_error", "method_not_allowed"})

    def test_cors_preflight_is_allowed_and_has_no_envelope(self):
        # Fails if CorsMiddleware is not first in MIDDLEWARE.
        response = self.client.options(
            "/api/health/",
            headers={
                "origin": "http://localhost:5173",
                "access-control-request-method": "GET",
            },
        )
        self.assertEqual(
            response["Access-Control-Allow-Origin"], "http://localhost:5173"
        )
        self.assertEqual(response.content, b"")


class HealthDatabaseIntegrationTests(TestCase):
    """The one test that needs a real local PostgreSQL connection."""

    def test_health_reports_ok_against_the_real_database(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["data"], {"status": "ok", "database": "ok"}
        )


class ApiCatchAllTests(SimpleTestCase):
    """An unmatched /api/ path must still answer in envelope form."""

    def test_unknown_api_path_returns_error_envelope(self):
        response = self.client.get("/api/nope/")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response["Content-Type"], "application/json")
        body = response.json()
        self.assertEqual(set(body), ENVELOPE_KEYS)
        self.assertIs(body["success"], False)
        self.assertEqual(body["error"]["code"], "not_found")

    def test_unknown_api_path_is_404_for_every_method(self):
        for method in ("get", "post", "put", "patch", "delete"):
            with self.subTest(method=method):
                response = getattr(self.client, method)("/api/deep/nested/path/")
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.json()["error"]["code"], "not_found")

    def test_non_api_paths_are_untouched(self):
        # The catch-all is scoped to /api/; Django's own 404 still applies here.
        response = self.client.get("/definitely-not-a-route/")
        self.assertEqual(response.status_code, 404)
        self.assertNotEqual(response["Content-Type"], "application/json")
