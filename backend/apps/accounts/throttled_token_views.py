"""Throttled subclasses of simplejwt's token views. PROD-3 (Story 92) added
throttling; SEC-9 (Story 107) adds `MfaAwareTokenObtainPairSerializer`, the
first customisation of the response shape.

`CONVENTIONS.md` § 21 recorded that "the stock simplejwt views need no
subclassing" for the response shape, which `EnvelopeJSONRenderer` applies
from the outside — that remains true; this serializer changes what data
gets put INTO the envelope, not how the envelope itself is built.

Login was completely unthrottled before PROD-3: `POST /api/auth/token/` was
the stock view, so credential stuffing was unlimited. See CONVENTIONS.md
§ 36 for the audit that found it, and for why per-IP throttling does not
stop a distributed attack.
"""

from django.contrib.auth.models import update_last_login
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenObtainSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.accounts.tokens import MFA_CHALLENGE_SALT, make_password_token
from apps.core.throttling import FailOpenScopedRateThrottle


class MfaAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    """SEC-9's 2FA branch on AUTH-1's existing token-obtain serializer — the
    intake's own "extend AUTH-1's existing token views — do not build a
    second auth flow" constraint, applied literally.

    Calls `TokenObtainSerializer.validate` directly (the grandparent, not
    `super()`) to authenticate exactly once and populate `self.user`,
    without also minting a token pair — `TokenObtainPairSerializer.validate`
    (what `super().validate()` would call) does both in one method, and a
    2FA-enabled account must not receive a real token pair at all until the
    second factor is verified.
    """

    def validate(self, attrs):
        TokenObtainSerializer.validate(self, attrs)
        if self.user.mfa_enabled:
            return {
                "mfa_required": True,
                "mfa_token": make_password_token(self.user.id, salt=MFA_CHALLENGE_SALT),
            }
        # No 2FA — the same tail `TokenObtainPairSerializer.validate` runs,
        # copied rather than reached via `super()`, which would re-run
        # `TokenObtainSerializer.validate` (and re-check the password) a
        # second time.
        refresh = self.get_token(self.user)
        data = {"refresh": str(refresh), "access": str(refresh.access_token)}
        if api_settings.UPDATE_LAST_LOGIN:
            update_last_login(None, self.user)
        return data


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """`POST /api/auth/token/` — the login endpoint."""

    serializer_class = MfaAwareTokenObtainPairSerializer
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"


class ThrottledTokenRefreshView(TokenRefreshView):
    """`POST /api/auth/token/refresh/` — also the rotation/blacklist path."""

    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"
