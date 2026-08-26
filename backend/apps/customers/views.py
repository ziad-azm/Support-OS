from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Customer
from .serializers import CustomerSerializer


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
