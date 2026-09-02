import logging

from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from drf_spectacular.views import SpectacularAPIView
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions
from apps.core.views import BaseModelViewSet

from .keys import generate_api_key
from .models import (
    WEBHOOK_EVENTS,
    ApiKey,
    ErpConnection,
    ErpOrder,
    ErpSyncRun,
    WebhookDelivery,
    WebhookSubscription,
)
from .serializers import (
    ApiKeyIssuedSerializer,
    ApiKeySerializer,
    ApiKeyUpdateSerializer,
    ErpConnectionSerializer,
    ErpOrderSerializer,
    ErpSyncRunSerializer,
    WebhookDeliverySerializer,
    WebhookSubscriptionSerializer,
)
from .tasks import run_erp_sync

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


class ErpConnectionView(APIView):
    """The one ERP connection record. `GET`/`PATCH` only, no id in the
    path — the same singleton shape `apps.organization.views.SettingsView`
    established, with `permission_map` keyed by lowercased HTTP method
    because a plain `APIView` has no DRF `action`
    (`apps/core/permissions.py`'s own note). Any other verb 405s through
    Django's `http_method_not_allowed`; only two methods are defined, so
    no `http_method_names` override is needed.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {
        "get": Permissions.INTEGRATIONS_MANAGE,
        "patch": Permissions.INTEGRATIONS_MANAGE,
    }

    @extend_schema(responses={200: ErpConnectionSerializer})
    def get(self, request):
        return Response(ErpConnectionSerializer(ErpConnection.load()).data)

    @extend_schema(request=ErpConnectionSerializer, responses={200: ErpConnectionSerializer})
    def patch(self, request):
        connection = ErpConnection.load()
        serializer = ErpConnectionSerializer(connection, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


@extend_schema(
    summary="Trigger an ERP sync now",
    request=None,
    # `response=None`: the view returns `Response(None, status=202)`, not an
    # `ErpSyncRun` — the run row is created by the worker, not this request.
    # Documenting a body here would be exactly the lie this view's own
    # docstring says it refuses to tell.
    responses={202: OpenApiResponse(response=None, description="Sync enqueued.")},
    description=(
        "Enqueues `run_erp_sync` and returns 202 immediately — the run happens "
        "on a Celery worker (INT-2). `direction` may be `import` (default) or "
        "`export`. Poll `GET /api/erp/sync-runs/` for the outcome."
    ),
)
class ErpSyncTriggerView(APIView):
    """Fires the sync on demand. Returns `202 Accepted` with no run row:
    the `ErpSyncRun` is created by the worker, not here, so a response
    body promising one would be a lie whenever the worker is down. The
    UI refetches the history list instead.

    Deliberately does NOT run the sync inline. A synchronous ERP crawl in
    a request thread is precisely what "async via SLA-0" (the intake)
    rules out.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"post": Permissions.INTEGRATIONS_MANAGE}

    def post(self, request):
        direction = request.data.get("direction", ErpSyncRun.Direction.IMPORT)
        if direction not in ErpSyncRun.Direction.values:
            raise ValidationError({"direction": [_("Must be 'import' or 'export'.")]})
        connection = ErpConnection.load()
        if not connection.is_configured():
            raise ValidationError(
                {"non_field_errors": [_("Enable the connection and set a base URL first.")]}
            )
        # Best-effort dispatch, matching the commit-first idiom
        # `UserViewSet.perform_create` uses around `send_invite_email.delay`
        # (Story 48): a down Redis/worker must surface as a clean error,
        # never a 500 traceback.
        try:
            run_erp_sync.delay(direction, request.user.id)
        except Exception:
            logger.exception("Failed to queue ERP sync")
            raise ValidationError(
                {"non_field_errors": [_("Could not queue the sync. Is the worker running?")]}
            ) from None
        return Response(None, status=status.HTTP_202_ACCEPTED)


class ErpSyncRunViewSet(BaseModelViewSet):
    """Read-only history. `http_method_names` drops every unsafe verb, the
    same `AuditLogViewSet` (SEC-3) precedent for a table that is a record
    rather than a resource: an omitted `permission_map` entry is merely
    authenticated-only under `HasPermission`'s grant-on-omission rule,
    which would be the wrong default here.
    """

    http_method_names = ["get", "head", "options"]
    queryset = ErpSyncRun.objects.select_related("triggered_by").all()
    serializer_class = ErpSyncRunSerializer

    permission_map = {
        "list": Permissions.INTEGRATIONS_MANAGE,
        "retrieve": Permissions.INTEGRATIONS_MANAGE,
    }

    ordering_fields = ("started_at", "direction", "state")


class ErpOrderViewSet(BaseModelViewSet):
    """Read-only mirror of ERP-owned orders — never writable from this
    API (Story 81 `## Product rules`). Supports `?customer=<id>` so the
    settings page (and, later, a customer-facing panel) can scope the
    list; an invalid value is a 400, not a silently unfiltered page, the
    same `AuditLogViewSet.get_queryset` precedent.
    """

    http_method_names = ["get", "head", "options"]
    queryset = ErpOrder.objects.select_related("customer").all()
    serializer_class = ErpOrderSerializer

    permission_map = {
        "list": Permissions.INTEGRATIONS_MANAGE,
        "retrieve": Permissions.INTEGRATIONS_MANAGE,
    }

    ordering_fields = ("placed_at", "order_number", "status", "synced_at")
    search_fields = ("order_number", "external_id", "customer__name")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        customer_id = self.request.query_params.get("customer")
        if customer_id:
            try:
                customer_id = int(customer_id)
            except ValueError:
                raise ValidationError({"customer": [_("Must be a valid customer id.")]}) from None
            queryset = queryset.filter(customer_id=customer_id)
        return queryset


class WebhookEventCatalogView(APIView):
    """The full webhook-event vocabulary — the same "gated on the same
    permission that gates writing what it describes" shape
    `apps.core.views.PermissionCatalogView` already establishes for
    `Permissions`/`Role.permissions`. What `WebhookSubscriptionFormPage`'s
    event checklist renders its options from.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"get": Permissions.WEBHOOKS_MANAGE}

    def get(self, request):
        return Response(sorted(WEBHOOK_EVENTS))


class WebhookSubscriptionViewSet(BaseModelViewSet):
    """Full CRUD over `WebhookSubscription` — INT-4. Unlike `ApiKeyViewSet`
    (Story 80), no `http_method_names` restriction: every field here is
    legitimately editable via a full replace, so `PUT` stays available at
    the API level even though the frontend only ever calls `PATCH`
    (`updateWebhookSubscription.ts`, the same "PATCH, not PUT" convention
    `updateRole.ts` already documents for itself). A real `destroy` — no
    soft-delete the way `ApiKeyViewSet.perform_destroy` (Story 80) has:
    deleting a subscription an operator no longer wants is exactly what
    they asked for, and `WebhookDelivery.subscription`'s `CASCADE` takes
    its history with it deliberately (see that model's own docstring).
    """

    queryset = WebhookSubscription.objects.select_related("created_by").all()
    serializer_class = WebhookSubscriptionSerializer

    permission_map = {
        "list": Permissions.WEBHOOKS_MANAGE,
        "retrieve": Permissions.WEBHOOKS_MANAGE,
        "create": Permissions.WEBHOOKS_MANAGE,
        "update": Permissions.WEBHOOKS_MANAGE,
        "partial_update": Permissions.WEBHOOKS_MANAGE,
        "destroy": Permissions.WEBHOOKS_MANAGE,
    }

    ordering_fields = ("name", "enabled", "created_at")
    search_fields = ("name", "target_url")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class WebhookDeliveryViewSet(BaseModelViewSet):
    """Read-only delivery history — the same `AuditLogViewSet`(SEC-3)/
    `ErpSyncRunViewSet` (Story 81) precedent: `http_method_names` drops
    every unsafe verb, since an omitted `permission_map` entry is merely
    authenticated-only under `HasPermission`'s grant-on-omission rule
    (§ 22), the wrong default for a record table.
    """

    http_method_names = ["get", "head", "options"]
    queryset = WebhookDelivery.objects.select_related("subscription").all()
    serializer_class = WebhookDeliverySerializer

    permission_map = {
        "list": Permissions.WEBHOOKS_MANAGE,
        "retrieve": Permissions.WEBHOOKS_MANAGE,
    }

    ordering_fields = ("created_at", "state", "event")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        subscription_id = self.request.query_params.get("subscription")
        if subscription_id:
            try:
                subscription_id = int(subscription_id)
            except ValueError:
                raise ValidationError(
                    {"subscription": [_("Must be a valid subscription id.")]}
                ) from None
            queryset = queryset.filter(subscription_id=subscription_id)
        return queryset
