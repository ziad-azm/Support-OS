"""Guards on the ENV contract established by story 01 (FND-1).

These tests assert that configuration comes from the environment and that the
generated `startproject` defaults (SQLite, `django-insecure-` secret) are gone.
"""

import importlib
import os
from unittest import mock

import environ
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase


class BaseDirTests(SimpleTestCase):
    def test_base_dir_points_at_backend_root(self):
        # base.py resolves BASE_DIR with parents[2]; moving the settings package
        # silently breaks read_env() and STATIC_ROOT, so pin it down here.
        self.assertEqual(settings.BASE_DIR.name, "backend")
        self.assertTrue((settings.BASE_DIR / "manage.py").exists())


class SecretKeyTests(SimpleTestCase):
    def test_secret_key_is_required(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ImproperlyConfigured):
                environ.Env()("DJANGO_SECRET_KEY")

    def test_secret_key_is_not_blank(self):
        self.assertNotEqual(settings.SECRET_KEY.strip(), "")
        self.assertFalse(settings.SECRET_KEY.startswith("django-insecure-"))


class DatabaseSettingsTests(SimpleTestCase):
    def test_database_reads_env_vars(self):
        default = settings.DATABASES["default"]
        self.assertEqual(default["ENGINE"], "django.db.backends.postgresql")
        # Django rewrites NAME to test_<name> for the duration of a test run,
        # so accept either form. A hardcoded name would still fail this.
        expected_name = os.environ["POSTGRES_DB"]
        self.assertIn(default["NAME"], {expected_name, f"test_{expected_name}"})
        self.assertEqual(default["USER"], os.environ["POSTGRES_USER"])
        self.assertEqual(default["HOST"], os.environ.get("POSTGRES_HOST", "localhost"))
        self.assertIsInstance(default["PORT"], int)


class JwtSettingsTests(SimpleTestCase):
    def test_jwt_settings_present(self):
        self.assertIsInstance(settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES, int)
        self.assertIsInstance(settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS, int)
        self.assertEqual(settings.JWT_ACCESS_TOKEN_LIFETIME_MINUTES, 15)
        self.assertEqual(settings.JWT_REFRESH_TOKEN_LIFETIME_DAYS, 7)
        self.assertNotEqual(settings.JWT_SIGNING_KEY.strip(), "")


class SettingsSplitTests(SimpleTestCase):
    def test_dev_settings_debug_true(self):
        dev = importlib.import_module("config.settings.dev")
        self.assertTrue(dev.DEBUG)

    def test_prod_settings_debug_false(self):
        with mock.patch.dict(os.environ, {"DJANGO_ALLOWED_HOSTS": "supportos.example"}):
            prod = importlib.reload(importlib.import_module("config.settings.prod"))
        self.assertFalse(prod.DEBUG)
        self.assertIs(prod.SESSION_COOKIE_SECURE, True)
        self.assertEqual(prod.ALLOWED_HOSTS, ["supportos.example"])


class DrfSettingsTests(SimpleTestCase):
    """The `API` contract lives in settings; pin it so nobody loosens it quietly."""

    def test_exception_handler_is_the_envelope_handler(self):
        self.assertEqual(
            settings.REST_FRAMEWORK["EXCEPTION_HANDLER"],
            "apps.core.exceptions.envelope_exception_handler",
        )

    def test_only_the_envelope_renderer_is_registered(self):
        # A re-added BrowsableAPIRenderer would let a browser bypass the envelope.
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"],
            ["apps.core.renderers.EnvelopeJSONRenderer"],
        )

    def test_pagination_class_and_page_size(self):
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_PAGINATION_CLASS"],
            "apps.core.pagination.DefaultPageNumberPagination",
        )
        self.assertEqual(settings.REST_FRAMEWORK["PAGE_SIZE"], settings.DRF_PAGE_SIZE)
        self.assertIsInstance(settings.DRF_PAGE_SIZE, int)
        self.assertIsInstance(settings.DRF_MAX_PAGE_SIZE, int)

    def test_cors_middleware_is_first(self):
        # Below CommonMiddleware it still boots and still passes every backend
        # test, then fails only in a real browser. Pin the position.
        self.assertEqual(
            settings.MIDDLEWARE[0], "corsheaders.middleware.CorsMiddleware"
        )

    def test_cors_allows_the_vite_dev_origin(self):
        self.assertIn("http://localhost:5173", settings.CORS_ALLOWED_ORIGINS)


class MigrationStateTests(SimpleTestCase):
    def test_no_pending_migrations(self):
        """Every model change has a migration committed alongside it.

        Uses the autodetector rather than `makemigrations --check`: that
        command calls `check_consistent_history`, which queries
        django_migrations and so cannot run in a SimpleTestCase.
        """
        from django.apps import apps as django_apps
        from django.db.migrations.autodetector import MigrationAutodetector
        from django.db.migrations.loader import MigrationLoader
        from django.db.migrations.state import ProjectState

        # connection=None keeps this off the database entirely.
        loader = MigrationLoader(None, ignore_no_migrations=True)
        autodetector = MigrationAutodetector(
            loader.project_state(), ProjectState.from_apps(django_apps)
        )
        changes = autodetector.changes(graph=loader.graph)
        self.assertEqual(
            changes, {}, f"Model changes without a migration: {sorted(changes)}"
        )
