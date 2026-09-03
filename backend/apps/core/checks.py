"""Authz coverage as a Django system check. PROD-3 (Story 92).

The PROD-3 audit found ZERO actions missing a `permission_map` entry across
121 routes. `HasPermission` grants on omission (CONVENTIONS.md § 22), so a
future viewset that forgets an entry is authenticated-only rather than
denied — a silent widening with no error to see. This turns that into a
`manage.py check` finding, which is already a gate and already runs in CI,
so "enforce authz coverage" is permanent without a test file (§ 16).

Registered from `CoreConfig.ready()`: a check must be registered at
app-load time. (Contrast PROD-1's Sentry init, which deliberately does NOT
use `ready()` because it must be armed even earlier — see § 34.)
"""

from django.core.checks import Warning as CheckWarning

from .permissions import HasPermission

# Actions that are correct to leave unmapped, with the reason. An entry here
# is a deliberate decision; anything else is a finding.
#
# Matched on class name. There are no duplicate view class names in this
# project today (verified across all 121 routes); if two apps ever ship the
# same name, both would be exempted — so keep names distinctive.
EXEMPT = frozenset(
    {
        # Owner-scoped personal resources: every row is filtered to
        # request.user in get_queryset, and each @action reaches rows only
        # through that scoped get_object(), so there is no domain
        # permission to hold. Documented on the viewsets themselves.
        "TaskViewSet",
        "NotificationViewSet",
    }
)


def check_permission_map_coverage(app_configs, **kwargs):
    """Report any `HasPermission`-gated action with no `permission_map` entry."""
    # Imported here, not at module scope: importing the URL conf at
    # module-import time would run during app loading, before the URL
    # conf is safely importable.
    from django.urls import get_resolver

    def walk(resolver, prefix=""):
        for pattern in resolver.url_patterns:
            if hasattr(pattern, "url_patterns"):
                yield from walk(pattern, prefix + str(pattern.pattern))
            else:
                yield prefix + str(pattern.pattern), pattern.callback

    problems = []
    seen = set()
    for path, callback in walk(get_resolver()):
        if not path.startswith("api/"):
            continue
        view = getattr(callback, "cls", None)
        if view is None or view.__name__ in EXEMPT:
            continue
        if HasPermission not in getattr(view, "permission_classes", []):
            continue
        permission_map = getattr(view, "permission_map", {}) or {}
        # Only the verbs the view actually serves: a verb dropped via
        # `http_method_names` 405s at Django's own dispatch before
        # HasPermission runs, which is how AuditLogViewSet closes its write
        # actions. Not a gap — and skipping this check is what produced 19
        # false positives in the PROD-3 audit's first pass.
        allowed = {method.lower() for method in getattr(view, "http_method_names", [])}
        for method, action in (getattr(callback, "actions", None) or {}).items():
            if action in permission_map:
                continue
            if allowed and method.lower() not in allowed:
                continue
            key = (view.__name__, action)
            if key in seen:
                continue
            seen.add(key)
            problems.append(
                CheckWarning(
                    f"{view.__name__}.{action} has no `permission_map` entry, so it is "
                    f"authenticated-only rather than permission-gated "
                    f"(HasPermission grants on omission — CONVENTIONS.md § 22).",
                    hint=(
                        "Add an entry to the viewset's `permission_map`, drop the verb via "
                        "`http_method_names`, or add the view to "
                        "`apps.core.checks.EXEMPT` with a comment saying why."
                    ),
                    obj=f"{view.__module__}.{view.__name__}",
                    id="core.W001",
                )
            )
    return problems
