"""Named throttle classes. PROD-3 (Story 92). See CONVENTIONS.md § 36.

Two things every class here exists to fix.

**Fail open, never closed.** DRF's `SimpleRateThrottle.allow_request` calls
`self.cache.get(...)` (rest_framework/throttling.py:123) and
`throttle_success` calls `self.cache.set(...)` (:140), neither guarded. With
the cache backed by Redis (PROD-2), a Redis outage would therefore raise
inside the throttle and become a **500 on every throttled endpoint** —
strictly worse than not throttling at all. A security control that turns a
cache blip into a total outage is one an operator switches off, and then
there is no control. `_FailOpenMixin` wraps the whole call chain so a cache
failure logs at WARNING (§ 10) and allows the request.

This is deliberately the OPPOSITE posture from a permission check, and the
same posture `apps/core/cache.py` takes for the count/report caches (§ 35):
availability wins over a rate limit, because the rate limit is a mitigation
and the API being up is the product.

**A per-action scope.** `ScopedRateThrottle` reads `throttle_scope` off the
VIEW, which cannot vary per `@action` on a viewset — a class attribute would
throttle `list` and `retrieve` too. `AiRateThrottle` carries its scope
itself, so it can be passed to a single `@action(throttle_classes=[...])`
without affecting any other action on the same viewset.
"""

import logging

from rest_framework.throttling import (
    AnonRateThrottle,
    ScopedRateThrottle,
    SimpleRateThrottle,
    UserRateThrottle,
)

logger = logging.getLogger(__name__)


class _FailOpenMixin:
    """Allow the request when the throttle's backing cache is unreachable.

    Wraps the whole `allow_request` chain, which is what touches the cache
    on both the read (`allow_request`) and the write (`throttle_success`)
    side. Never catches anything else: a misconfigured scope raises
    `ImproperlyConfigured` and must still surface loudly.
    """

    def allow_request(self, request, view):
        try:
            return super().allow_request(request, view)
        except Exception:
            # Redis unreachable, timing out, or misconfigured. WARNING, not
            # ERROR: the request still succeeds, so this is "worth
            # noticing" per CONVENTIONS.md § 10. PROD-1's access log
            # carries the request_id alongside it.
            logger.warning(
                "Throttle check failed open for %s",
                getattr(request, "path", "<unknown>"),
                exc_info=True,
            )
            return True


class FailOpenAnonRateThrottle(_FailOpenMixin, AnonRateThrottle):
    """The `anon` baseline. Applies only to unauthenticated callers —
    `AnonRateThrottle.get_cache_key` returns None for a logged-in one."""


class FailOpenUserRateThrottle(_FailOpenMixin, UserRateThrottle):
    """The `user` baseline."""


class FailOpenScopedRateThrottle(_FailOpenMixin, ScopedRateThrottle):
    """`ScopedRateThrottle` plus fail-open. This is the class every view
    with its own `throttle_scope` should use — plain `ScopedRateThrottle`
    would 500 the endpoint on a cache outage.

    Keyed on `request.user.pk` when authenticated and `get_ident(request)`
    otherwise (rest_framework/throttling.py:235-247), which is why the
    credential scopes are effectively per-IP (no identity yet) and the
    authenticated ones are per-user.
    """


class AiRateThrottle(_FailOpenMixin, SimpleRateThrottle):
    """Every request through this costs a paid provider call
    (`apps/ai/client.py`). Per user, not per IP, so one caller cannot spend
    another's budget — and an integration calling through a single API key
    (`ApiKeyAuthentication` resolves to a real `User`) concentrates the
    budget on that user, which makes the cost attributable.

    Carries `scope` as a class attribute so it can be attached to one
    `@action` rather than a whole viewset.
    """

    scope = "ai"

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}
