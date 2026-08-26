from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Ticket


class TicketSerializer(BaseModelSerializer):
    # Read-only convenience for the list/detail screens — without it, every
    # row would show a bare numeric customer id. Source traverses the FK;
    # the viewset's `select_related("customer")` (task 3) is what keeps this
    # from costing an extra query per row on `list`.
    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta(BaseModelSerializer.Meta):
        model = Ticket
        fields = (
            "id",
            "subject",
            "description",
            "customer",
            "customer_name",
            "status",
            "priority",
            "created_at",
            "updated_at",
        )
