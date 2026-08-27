from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Notification


class NotificationSerializer(BaseModelSerializer):
    # Read-only convenience for the dropdown, same role TicketSerializer's
    # customer_name plays. default="" covers a null `ticket` (this
    # notification's kind may not be ticket-anchored in a future story).
    ticket_subject = serializers.CharField(source="ticket.subject", read_only=True, default="")

    class Meta(BaseModelSerializer.Meta):
        model = Notification
        fields = (
            "id",
            "kind",
            "ticket",
            "ticket_subject",
            "title",
            "body",
            "read_at",
            "created_at",
            "updated_at",
        )
