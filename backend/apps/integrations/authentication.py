"""API-key authentication for the public API — INT-1 (Story 80).

Registered in `DEFAULT_AUTHENTICATION_CLASSES` after `JWTAuthentication`
(config/settings/base.py). It returns a plain `accounts.User`, so from
the view's point of view an API-key request is indistinguishable from a
JWT one and every existing `permission_map`, `HasPermission` check, and
`CustomerScopedModelViewSet` queryset filter applies unchanged. That is
the whole of the intake's "reusing AUTHZ" — see CONVENTIONS.md § 29.
"""

import logging
from datetime import timedelta

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.extensions import OpenApiAuthenticationExtension
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import AuthenticationFailed

from .keys import secrets_match, split_raw_key
from .models import ApiKey

logger = logging.getLogger(__name__)

KEYWORD = "Api-Key"
# `last_used_at` is an operational convenience, not an audit trail, and a
# write on every request would turn every GET into a write transaction.
# Five minutes is precise enough to answer "is this key still in use?".
LAST_USED_WRITE_INTERVAL = timedelta(minutes=5)


class ApiKeyAuthentication(BaseAuthentication):
    keyword = KEYWORD

    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header or header[0].lower() != self.keyword.lower().encode():
            # Not ours (no header at all, or a `Bearer` JWT). Returning
            # None lets DRF try the next authenticator.
            return None
        if len(header) != 2:
            raise AuthenticationFailed(_("Invalid Api-Key header. Expected `Api-Key <key>`."))
        try:
            raw_key = header[1].decode()
        except UnicodeError:
            raise AuthenticationFailed(_("Invalid API key.")) from None

        api_key = self._resolve(raw_key)
        if api_key is None:
            # One message for "no such prefix" and for "wrong secret":
            # distinguishing them tells an attacker which half to keep.
            raise AuthenticationFailed(_("Invalid API key."))
        if not api_key.is_usable():
            raise AuthenticationFailed(_("This API key has been revoked or has expired."))
        if not api_key.user.is_active:
            raise AuthenticationFailed(_("The account this API key belongs to is inactive."))

        self._touch(api_key)
        return api_key.user, api_key

    def authenticate_header(self, request):
        return self.keyword

    @staticmethod
    def _resolve(raw_key: str) -> ApiKey | None:
        parts = split_raw_key(raw_key)
        if parts is None:
            return None
        prefix, secret = parts
        # `user__role` too: `permissions_for(request.user)` reads
        # `user.role.permissions` on the very next step of the request
        # cycle (apps/core/permissions.py:49-64).
        api_key = ApiKey.objects.select_related("user", "user__role").filter(prefix=prefix).first()
        if api_key is None or not secrets_match(api_key.hashed_key, secret):
            return None
        return api_key

    @staticmethod
    def _touch(api_key: ApiKey) -> None:
        now = timezone.now()
        if api_key.last_used_at and now - api_key.last_used_at < LAST_USED_WRITE_INTERVAL:
            return
        # `.update()`, not `.save()`: a single UPDATE of one column that
        # deliberately leaves `updated_at`'s `auto_now` alone — a use is
        # not a modification of the key.
        ApiKey.objects.filter(pk=api_key.pk).update(last_used_at=now)


class ApiKeyScheme(OpenApiAuthenticationExtension):
    """Teaches drf-spectacular what `ApiKeyAuthentication` looks like on
    the wire. Without it the generated schema lists no security scheme for
    an API-key call and Swagger UI offers no way to send one.
    Registration happens on import; `IntegrationsConfig.ready()` imports
    this module so `manage.py spectacular` sees it too.
    """

    target_class = "apps.integrations.authentication.ApiKeyAuthentication"
    name = "ApiKeyAuth"

    def get_security_definition(self, auto_schema):
        return {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": (
                "An API key issued via `POST /api/api-keys/`, sent as "
                "`Api-Key <key>`. The key carries exactly the permissions "
                "of the user it was issued for."
            ),
        }
