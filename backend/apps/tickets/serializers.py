from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Category, Ticket


class CategorySerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = Category
        fields = ("id", "name", "created_at", "updated_at")


class TicketSerializer(BaseModelSerializer):
    # Read-only convenience for the list/detail screens — without it, every
    # row would show a bare numeric customer id. Source traverses the FK;
    # the viewset's `select_related("customer")` (task 3) is what keeps this
    # from costing an extra query per row on `list`.
    customer_name = serializers.CharField(source="customer.name", read_only=True)
    # `category` itself needs no explicit declaration — DRF derives
    # `required=False`/`allow_null=True` from the model field's own
    # `null=True`/`blank=True` (verified, see Story 18 `## Prerequisites`).
    # `category_name` does need one: `allow_null=True` is what makes
    # `source="category.name"` return `None` instead of erroring when a
    # ticket has no category — also verified against DRF's own source.
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    # Same verified-safe dotted-source pattern as `category_name` above and
    # `NoteSerializer.author_name` (Story 21): `allow_null=True` is what
    # makes this return `None` instead of erroring when `assigned_agent` is
    # `None`. `get_full_name` is a method, not a field — DRF's
    # `get_attribute` calls it (verified in Story 21's own use), and it
    # falls back to the user's email when both name fields are blank.
    assigned_agent_name = serializers.CharField(
        source="assigned_agent.get_full_name", read_only=True, allow_null=True
    )

    class Meta(BaseModelSerializer.Meta):
        model = Ticket
        fields = (
            "id",
            "subject",
            "description",
            "customer",
            "customer_name",
            "category",
            "category_name",
            "assigned_agent",
            "assigned_agent_name",
            "status",
            "priority",
            "created_at",
            "updated_at",
        )
        # assigned_agent is written ONLY through `TicketViewSet.assign`.
        # Read-only here so a full-payload PATCH from the edit form can
        # never unassign a ticket as a side effect. See Story 22
        # `## Prerequisites`.
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("assigned_agent",)
