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
        self.assertEqual(default["NAME"], os.environ["POSTGRES_DB"])
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
