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
    # Same verified dotted-source + `allow_null=True` pattern as
    # `category_name` above. `department` itself needs no declaration —
    # DRF derives `required=False, allow_null=True` from the model field.
    department_name = serializers.CharField(
        source="department.name", read_only=True, allow_null=True
    )
    # Same verified-safe dotted-source pattern as `category_name` above and
    # `NoteSerializer.author_name` (Story 21): `allow_null=True` is what
    # makes this return `None` instead of erroring when `assigned_agent` is
    # `None`. `get_full_name` is a method, not a field — DRF's
    # `get_attribute` calls it (verified in Story 21's own use), and it
    # falls back to the user's email when both name fields are blank.
    assigned_agent_name = serializers.CharField(
        source="assigned_agent.get_full_name", read_only=True, allow_null=True
    )

    # `customer` must stay writable on create (staff picks a customer when
    # filing a new ticket) but must never change afterward — a PATCH that
    # reassigns `customer` silently moves the ticket's whole message/note
    # history into another customer's portal visibility (`customer_field`
    # scoping in `CustomerScopedModelViewSet`), with no dedicated
    # "reassign" endpoint or audit trail for it. See `BaseModelSerializer`.
    immutable_fields = ("customer",)

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
            "department",
            "department_name",
            "assigned_agent",
            "assigned_agent_name",
            "status",
            "priority",
            "escalated",
            "escalated_at",
            "created_at",
            "updated_at",
        )
        # status/escalated/escalated_at are written ONLY through
        # TicketViewSet.set_status/escalate. Read-only here for the same
        # reason assigned_agent is (Story 22): a full-payload PATCH from the
        # edit form must never change them as a side effect. See Story 23
        # `## Prerequisites`.
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + (
            "assigned_agent",
            "status",
            "escalated",
            "escalated_at",
        )
