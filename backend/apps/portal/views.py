import logging

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.core.permissions import Permissions
from apps.core.views import CustomerScopedModelViewSet
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket

from .serializers import PortalTicketSerializer

logger = logging.getLogger(__name__)


class PortalTicketViewSet(CustomerScopedModelViewSet):
    """A customer's own tickets — create (PORTAL-1), list and retrieve
    (PORTAL-2). `customer_field` is left at `CustomerScopedModelViewSet`'s
    default (`"customer"`) — `Ticket.customer` is already the right name,
    no override needed.

    Only `create`, `list`, `retrieve` are routed to a URL (see
    `apps/portal/urls.py`); `update`/`partial_update`/`destroy` exist on
    this class (inherited from `ModelViewSet`) but are unreachable — no
    router registers them, and no story has asked for a customer to edit
    or delete a submitted ticket.
    """

    # Same select_related tuple as TicketViewSet.queryset
    # (apps/tickets/views.py:50) — `category_name`/`assigned_agent_name`
    # are derived, joined fields; without this, `list` is an N+1 query,
    # one extra SELECT per row per joined field.
    queryset = Ticket.objects.select_related("customer", "category", "assigned_agent").all()
    serializer_class = PortalTicketSerializer
    permission_map = {
        "create": Permissions.PORTAL_ACCESS,
        "list": Permissions.PORTAL_ACCESS,
        "retrieve": Permissions.PORTAL_ACCESS,
    }

    # Each name here must match a ColumnDef.id on the frontend, exactly
    # like TicketViewSet's own contract (CONVENTIONS.md §23).
    ordering_fields = ("subject", "status", "priority", "created_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset

        # Same validation TicketViewSet.get_queryset already uses for the
        # identical param (apps/tickets/views.py:118-122) — "live status
        # tracking" is the one filter this story's intake names.
        status = self.request.query_params.get("status")
        if status:
            if status not in Ticket.Status.values:
                raise ValidationError({"status": [_("Must be a valid status.")]})
            queryset = queryset.filter(status=status)

        return queryset

    def perform_create(self, serializer):
        # The one line CustomerScopedModelViewSet's scoping cannot do for
        # you on create: force the customer, never trust the client for it.
        ticket = serializer.save(customer=self.request.user.customer_profile)
        try:
            auto_assign_ticket.delay(ticket.id)
        except Exception:
            # Same resilience contract as TicketViewSet.perform_create
            # (apps/tickets/views.py:83-93) — the Ticket row is already
            # committed; auto-assignment queuing failing must not fail
            # the customer's submission.
            logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)
