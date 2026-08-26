from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Ticket
from .serializers import TicketSerializer


class TicketViewSet(BaseModelViewSet):
    """Ticket CRUD. The second consumer of `BaseModelViewSet`, after Customer."""

    queryset = Ticket.objects.select_related("customer").all()
    serializer_class = TicketSerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    # Each name here must match a `ColumnDef.id` on the frontend, exactly
    # like `CustomerViewSet`. `customer`/`customer_name` are deliberately
    # absent — see Story 12 `## Story Goal` for why that column is not
    # sortable, the same choice Story 10 made for `Customer.phone`.
    ordering_fields = ("subject", "status", "priority", "created_at")
    search_fields = ("subject", "description", "customer__name")
