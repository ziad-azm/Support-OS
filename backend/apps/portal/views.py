import logging

from apps.core.permissions import Permissions
from apps.core.views import CustomerScopedModelViewSet
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Ticket

from .serializers import PortalTicketCreateSerializer

logger = logging.getLogger(__name__)


class PortalTicketViewSet(CustomerScopedModelViewSet):
    """A customer's own ticket-creation endpoint — PORTAL-1.

    `customer_field` is left at `CustomerScopedModelViewSet`'s default
    (`"customer"`) — `Ticket.customer` is already the right name, no
    override needed. Only `create` is routed to a URL (see
    `apps/portal/urls.py`); `list`/`retrieve`/`update`/`destroy` exist on
    this class (inherited from `ModelViewSet`) but are unreachable — no
    router registers them. PORTAL-2 is what will route `list`/`retrieve`
    for this same customer boundary.
    """

    queryset = Ticket.objects.all()
    serializer_class = PortalTicketCreateSerializer
    permission_map = {"create": Permissions.PORTAL_ACCESS}

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
