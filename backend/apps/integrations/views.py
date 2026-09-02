import logging

from drf_spectacular.utils import extend_schema, extend_schema_view
from drf_spectacular.views import SpectacularAPIView
from rest_framework import status
from rest_framework.response import Response

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .keys import generate_api_key
from .models import ApiKey
from .serializers import ApiKeyIssuedSerializer, ApiKeySerializer, ApiKeyUpdateSerializer

logger = logging.getLogger(__name__)


class SchemaView(SpectacularAPIView):
    """`SpectacularAPIView`, with one fix for an error response.

    `SpectacularAPIView`'s own renderers
    (`drf_spectacular.renderers.OpenApiYamlRenderer`/`OpenApiJsonRenderer`)
    build a fresh `yaml.SafeDumper` subclass per call, and PyYAML's
    `SafeRepresenter` matches `dict` by exact type, not by subclass. This
    project's global exception handler
    (`apps.core.exceptions.envelope_exception_handler`) returns an
    `apps.core.envelope.Envelope` — a `dict` *subclass*, deliberately (see
    `Envelope`'s own docstring: a view's own payload that happens to
    contain a `"success"` key must never be mistaken for an
    already-wrapped body). Verified live: with `API_DOCS_PUBLIC=False`,
    an unauthenticated request to `/api/schema/` 500s with
    `yaml.representer.RepresenterError: cannot represent an object`
    instead of the `401` every other protected endpoint returns.

    Coercing `response.data` to a plain `dict` here is narrow and local —
    it does not touch PyYAML's global representer registry or
    `apps.core.envelope`, both of which stay exactly as they are for
    every JSON-only view in the project (the only place this collision
    can happen, since `EnvelopeJSONRenderer`'s `json.dumps` already
    handles a `dict` subclass without issue). INT-1 (Story 80).
    """

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        if isinstance(response.data, dict):
            response.data = dict(response.data)
        return response


@extend_schema_view(
    create=extend_schema(
        summary="Issue an API key",
        description=(
            "Returns the plaintext key in `data.key`. This is the only time it "
            "is ever returned — store it immediately."
        ),
        responses={status.HTTP_201_CREATED: ApiKeyIssuedSerializer},
    ),
    destroy=extend_schema(
        summary="Revoke an API key",
        description=(
            "Sets `is_active` to false. The row is kept so `last_used_at` and "
            "the issue date remain auditable; a revoked key authenticates "
            'nothing. Reactivate with `PATCH {"is_active": true}`.'
        ),
    ),
)
class ApiKeyViewSet(BaseModelViewSet):
    """API-key administration — INT-1. Gated entirely on
    `api_keys.manage`, which `accounts/0008_grant_api_keys_permission.py`
    grants to `admin` alone: a key inherits its user's whole permission
    set, so issuing one is as sensitive as editing a role.

    No `PUT`: `prefix`/`hashed_key` are immutable and `user` is
    deliberately not patchable, so a full replace has nothing coherent to
    mean. Narrows Django's own `View.http_method_names`, the same way
    `apps/customers/views.py:159` does.
    """

    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    queryset = ApiKey.objects.select_related("user").all()
    serializer_class = ApiKeySerializer

    permission_map = {
        "list": Permissions.API_KEYS_MANAGE,
        "retrieve": Permissions.API_KEYS_MANAGE,
        "create": Permissions.API_KEYS_MANAGE,
        "partial_update": Permissions.API_KEYS_MANAGE,
        "destroy": Permissions.API_KEYS_MANAGE,
    }

    ordering_fields = ("name", "created_at", "last_used_at", "expires_at", "is_active")
    search_fields = ("name", "prefix", "user__email")

    def get_serializer_class(self):
        if self.action == "partial_update":
            return ApiKeyUpdateSerializer
        return ApiKeySerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_key, prefix, hashed_key = generate_api_key()
        api_key = serializer.save(
            prefix=prefix,
            hashed_key=hashed_key,
            created_by=request.user,
        )
        logger.info("API key %s issued for user %s by %s", prefix, api_key.user_id, request.user.id)
        # Re-serialise through the issued shape and attach the plaintext.
        # Never logged, never stored — see apps/integrations/keys.py.
        payload = ApiKeyIssuedSerializer(api_key).data
        payload["key"] = raw_key
        return Response(payload, status=status.HTTP_201_CREATED)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])
        logger.info("API key %s revoked by %s", instance.prefix, self.request.user.id)
