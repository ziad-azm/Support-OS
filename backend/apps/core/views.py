from django.db import connection
from django.db.utils import OperationalError
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .permissions import HasPermission


class BaseModelViewSet(viewsets.ModelViewSet):
    """Single inheritance point for every domain ModelViewSet.

    Carries the project's authorization defaults so no viewset repeats them:
    a caller must be authenticated, and must hold the permission this
    viewset's `permission_map` demands for the action being performed.

    Declare `permission_map` as action -> permission string (see
    `apps.core.permissions.HasPermission`). An action with no entry is
    authenticated-only, NOT forbidden — a missing entry is usually an
    unfinished map, and a silent 403 is the harder bug to find. Return plain
    payloads from actions; the renderer adds the envelope.

    `DEFAULT_PERMISSION_CLASSES` stays `AllowAny` project-wide (see
    CONVENTIONS.md §13) — this base is what makes a domain endpoint closed by
    default, not the global setting.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map: dict[str, str] = {}


class CustomerScopedModelViewSet(BaseModelViewSet):
    """Base for every portal-facing viewset — the mechanism the intake's
    "scoping rule... reused by all portal stories" refers to.

    Filters the queryset to the caller's own `customers.Customer` row (via
    `customer_profile`, the reverse side of `Customer.user`). A caller with
    no linked Customer (every staff account today) sees an empty queryset,
    not another customer's data and not a 500.

    Declares NO `permission_map` of its own — per HasPermission's own
    grant-on-omission rule (CONVENTIONS.md §22), a subclass that ships
    without declaring one is authenticated-only, not closed. Every PORTAL-N
    viewset must declare its own `permission_map` (typically
    `{"list": Permissions.PORTAL_ACCESS, ...}`), the same as any other
    `BaseModelViewSet` subclass.

    `customer_field` names the FK from this viewset's model to `Customer` —
    override it when the model's field is not literally named `customer`
    (`tickets.Ticket.customer` is; see `backend/apps/tickets/models.py:56`).
    """

    customer_field = "customer"

    def get_queryset(self):
        queryset = super().get_queryset()
        customer = getattr(self.request.user, "customer_profile", None)
        if customer is None:
            return queryset.none()
        return queryset.filter(**{self.customer_field: customer})


class HealthView(APIView):
    """Liveness probe. Reports database reachability, not just process health.

    Returns a plain dict: never build an envelope in a view, or the renderer
    will pass the hand-made one through and the shape drifts.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            connection.ensure_connection()
            database = "ok"
        except OperationalError:
            database = "error"

        payload = {
            "status": "ok" if database == "ok" else "degraded",
            "database": database,
        }
        code = status.HTTP_200_OK if database == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(payload, status=code)


class ApiNotFoundView(APIView):
    """Catch-all for unmatched paths under /api/.

    Django's URL resolver raises Http404 before any DRF view runs, so an
    unmatched path would return Django's HTML 404 page and break the envelope
    contract for exactly the case a client hits most often: a typo'd endpoint.
    Routing the miss through a DRF view puts it back in envelope form.

    Registered last in `config/api_urls.py`. Any method is a 404 here, not a
    405 — the path does not exist, so no method on it is allowed.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def _not_found(self, request, *args, **kwargs):
        raise NotFound()

    get = post = put = patch = delete = head = options = _not_found
