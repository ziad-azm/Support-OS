from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.core"

    def ready(self):
        """Register PROD-3's authz-coverage system check.

        `ready()` is the correct hook for a system check — it must be
        registered once at app-load time. Deliberately unlike PROD-1's
        Sentry init, which is in `settings/base.py` precisely because it
        must be armed *before* the app registry finishes building
        (CONVENTIONS.md § 34). Imported inside the method so a check module
        never runs at import time.
        """
        from django.core.checks import register

        from .checks import check_permission_map_coverage

        register(check_permission_map_coverage)
