import logging

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.core.permissions import Permissions
from apps.core.views import CustomerScopedModelViewSet
from apps.sla.tasks import auto_assign_ticket
from apps.tickets.models import Feedback, Ticket

from .serializers import PortalFeedbackSerializer, PortalTicketSerializer

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
    # one extra SELECT per row per joined field. `"feedback"` added for
    # `has_feedback` (PORTAL-5) — the reverse side of a OneToOneField IS
    # select_related-able in Django (unlike a reverse ForeignKey, which
    # needs prefetch_related).
    queryset = Ticket.objects.select_related(
        "customer", "category", "assigned_agent", "feedback"
    ).all()
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
        # `customer_profile` raises `RelatedObjectDoesNotExist` (an
        # `AttributeError` subclass) for a caller with no linked `Customer`
        # row — a real case, not hypothetical: `super_admin` legitimately
        # holds `portal.access` alongside every other permission, so a
        # staff account can reach this action without ever having a
        # customer profile. `hasattr` is the verified-safe check this
        # codebase already uses for the same reverse accessor elsewhere
        # (`PortalTicketSerializer.get_has_feedback`).
        if not hasattr(self.request.user, "customer_profile"):
            raise PermissionDenied(
                _("Only customer accounts can submit tickets through the portal.")
            )
        ticket = serializer.save(customer=self.request.user.customer_profile)
        try:
            auto_assign_ticket.delay(ticket.id)
        except Exception:
            # Same resilience contract as TicketViewSet.perform_create
            # (apps/tickets/views.py:83-93) — the Ticket row is already
            # committed; auto-assignment queuing failing must not fail
            # the customer's submission.
            logger.exception("Failed to queue auto-assignment for ticket %s", ticket.id)


class PortalFeedbackViewSet(CustomerScopedModelViewSet):
    """A customer's own CSAT submission — PORTAL-5. Create only; no
    `list`/`retrieve` route exists or is needed — a customer learns
    whether they already rated a ticket via
    `PortalTicketSerializer.has_feedback`, not by fetching `Feedback` rows
    directly. `customer_field` left at the default (`"customer"`) —
    `Feedback.customer` is a direct FK, matching what
    `CustomerScopedModelViewSet`/`HasPermission.has_object_permission`
    both expect (see Story 47 `## Prerequisites`).
    """

    queryset = Feedback.objects.all()
    serializer_class = PortalFeedbackSerializer
    permission_map = {"create": Permissions.PORTAL_ACCESS}

    def perform_create(self, serializer):
        # Same guard as `PortalTicketViewSet.perform_create` — see its
        # comment. `validate_ticket` on the serializer already checks this
        # first in the normal request path, but this stays defensive in
        # case `perform_create` is ever reached without it (e.g. a direct
        # `serializer.save()` call in a future test or script).
        if not hasattr(self.request.user, "customer_profile"):
            raise PermissionDenied(
                _("Only customer accounts can submit feedback through the portal.")
            )
        serializer.save(customer=self.request.user.customer_profile)
