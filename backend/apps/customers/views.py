from django.utils.translation import gettext_lazy as _
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.core.permissions import Permissions, permissions_for
from apps.core.views import BaseModelViewSet

from .models import ContactDetail, Customer
from .serializers import ContactDetailSerializer, CustomerSerializer
from .timeline import build_timeline


class CustomerViewSet(BaseModelViewSet):
    """Customer CRUD. The first consumer of `BaseModelViewSet`.

    Every action is mapped: an unmapped action would fall through to
    authenticated-only, which for a write endpoint is not what we want. See
    CONVENTIONS.md §22.
    """

    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
        # Keyed by the @action's own method name — DRF sets
        # `self.action = "timeline"` for it (verified, see Story 20
        # `## Prerequisites`). Without this entry the action would fall
        # through to authenticated-only, NOT be denied.
        "timeline": Permissions.CUSTOMERS_VIEW,
    }

    # `ordering_fields` is what makes `?ordering=` real for these columns —
    # OrderingFilter ignores any field not listed. Each name here must match a
    # `ColumnDef.id` on the frontend.
    ordering_fields = ("name", "email", "company", "created_at")
    search_fields = ("name", "email", "company")

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request, pk=None):
        """A customer's full interaction history — CUST-3. The router
        generates `/api/customers/<pk>/timeline/` from this decorator; no
        `urls.py` change is needed (verified, see Story 20
        `## Prerequisites`).

        Permission-checked twice on purpose: `permission_map` gates it on
        `customers.view` like every other read here, and the explicit check
        below adds `tickets.view`, because the payload is ticket and message
        data that `TicketViewSet`/`MessageViewSet` both gate that way. The
        same "permission-checked, not just authenticated" move Story 16's
        `TicketChatConsumer` made. See Story 20 `## Prerequisites`.
        """
        if Permissions.TICKETS_VIEW not in permissions_for(request.user):
            raise PermissionDenied()
        customer = self.get_object()
        return Response(build_timeline(customer))


class ContactDetailViewSet(BaseModelViewSet):
    """CRUD for a customer's contact channels. Reuses `customers.*` —
    CUST-2 is part of the customer record, not a separate permission domain
    (Story 11 `## Product rules`).
    """

    queryset = ContactDetail.objects.all()
    serializer_class = ContactDetailSerializer

    permission_map = {
        "list": Permissions.CUSTOMERS_VIEW,
        "retrieve": Permissions.CUSTOMERS_VIEW,
        "create": Permissions.CUSTOMERS_MANAGE,
        "update": Permissions.CUSTOMERS_MANAGE,
        "partial_update": Permissions.CUSTOMERS_MANAGE,
        "destroy": Permissions.CUSTOMERS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        customer_id = self.request.query_params.get("customer")
        if not customer_id:
            raise ValidationError({"customer": [_("This query parameter is required.")]})
        try:
            customer_id = int(customer_id)
        except ValueError:
            raise ValidationError({"customer": [_("Must be a valid customer id.")]}) from None
        return queryset.filter(customer_id=customer_id)
