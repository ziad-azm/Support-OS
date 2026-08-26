from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Category, Ticket
from .serializers import CategorySerializer, TicketSerializer


class CategoryViewSet(BaseModelViewSet):
    """Category CRUD — TKT-2's own management endpoints. Reuses `tickets.*`
    — a category is part of the ticket domain, not a separate permission
    domain (mirrors `MessageViewSet`'s reuse of the same constants, Story 13
    `## Product rules`). See Story 18 `## Prerequisites`.
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    ordering_fields = ("name", "created_at")
    search_fields = ("name",)


class TicketViewSet(BaseModelViewSet):
    """Ticket CRUD. The second consumer of `BaseModelViewSet`, after Customer."""

    queryset = Ticket.objects.select_related("customer", "category").all()
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
    # like `CustomerViewSet`. `customer`/`customer_name`/`category_name` are
    # deliberately absent — see Story 12 `## Story Goal` for why
    # `customer_name` is not sortable, the same choice this story makes for
    # `category_name`.
    ordering_fields = ("subject", "status", "priority", "created_at")
    search_fields = ("subject", "description", "customer__name")

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset

        # Optional, unlike MessageViewSet/ContactDetailViewSet's required
        # `ticket`/`customer` params (Story 11/13) — a ticket list must
        # still work with no filter applied. Present-but-malformed input is
        # still a 400, not a silent no-op. See Story 18 `## Product rules`.
        category_id = self.request.query_params.get("category")
        if category_id:
            try:
                category_id = int(category_id)
            except ValueError:
                raise ValidationError({"category": [_("Must be a valid category id.")]}) from None
            queryset = queryset.filter(category_id=category_id)

        priority = self.request.query_params.get("priority")
        if priority:
            if priority not in Ticket.Priority.values:
                raise ValidationError({"priority": [_("Must be a valid priority.")]})
            queryset = queryset.filter(priority=priority)

        return queryset
