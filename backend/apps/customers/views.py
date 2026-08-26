from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import ContactDetail, Customer
from .serializers import ContactDetailSerializer, CustomerSerializer


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
    }

    # `ordering_fields` is what makes `?ordering=` real for these columns —
    # OrderingFilter ignores any field not listed. Each name here must match a
    # `ColumnDef.id` on the frontend.
    ordering_fields = ("name", "email", "company", "created_at")
    search_fields = ("name", "email", "company")


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
