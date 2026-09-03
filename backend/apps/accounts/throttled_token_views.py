"""Throttled subclasses of simplejwt's token views. PROD-3 (Story 92).

`CONVENTIONS.md` § 21 recorded that "the stock simplejwt views need no
subclassing" — that remains true for the response shape, which
`EnvelopeJSONRenderer` applies from the outside. These subclasses add
`throttle_classes`/`throttle_scope` and NOTHING else: no serializer
override, no `post()` override, no response shaping. `TokenViewBase` is a
plain `generics.GenericAPIView` (verified against the installed
rest_framework_simplejwt, views.py:14-22), so every other behaviour —
including token rotation and blacklisting — is inherited unchanged.

Login was completely unthrottled before this: `POST /api/auth/token/` was
the stock view, so credential stuffing was unlimited. See CONVENTIONS.md
§ 36 for the audit that found it, and for why per-IP throttling does not
stop a distributed attack.
"""

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.throttling import FailOpenScopedRateThrottle


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """`POST /api/auth/token/` — the login endpoint."""

    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"


class ThrottledTokenRefreshView(TokenRefreshView):
    """`POST /api/auth/token/refresh/` — also the rotation/blacklist path."""

    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"
