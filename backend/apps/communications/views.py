from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Message
from .serializers import MessageSerializer


class MessageViewSet(BaseModelViewSet):
    """Message CRUD for one ticket's conversation. Reuses `tickets.*` — a
    message is a child of the ticket domain, not a separate permission
    domain (Story 13 `## Product rules`).
    """

    queryset = Message.objects.select_related("ticket").all()
    serializer_class = MessageSerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        ticket_id = self.request.query_params.get("ticket")
        if not ticket_id:
            raise ValidationError({"ticket": [_("This query parameter is required.")]})
        try:
            ticket_id = int(ticket_id)
        except ValueError:
            raise ValidationError({"ticket": [_("Must be a valid ticket id.")]}) from None
        return queryset.filter(ticket_id=ticket_id)
