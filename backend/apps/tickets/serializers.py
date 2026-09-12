from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer
from apps.sla.policy import status_from_facts

from .models import Category, SavedView, Ticket


class CategorySerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = Category
        fields = ("id", "name", "created_at", "updated_at")


class SavedViewSerializer(BaseModelSerializer):
    owner_name = serializers.CharField(source="owner.get_full_name", read_only=True)

    # Settable on create (a saved view's whole point), frozen after — the
    # SAME mechanism TicketSerializer.immutable_fields = ("customer",)
    # already established (Story 12/18 `## Prerequisites`;
    # apps/core/serializers.py::BaseModelSerializer). Renaming or
    # re-sharing a view must never silently redefine what it filters by —
    # the intake names save/rename/delete, not "edit filters."
    immutable_fields = ("filters",)

    class Meta(BaseModelSerializer.Meta):
        model = SavedView
        fields = (
            "id",
            "name",
            "owner",
            "owner_name",
            "is_shared",
            "is_default",
            "filters",
            "created_at",
            "updated_at",
        )
        # `is_default` is written ONLY through `set_default` (mirrors
        # `status`/`escalated`, Story 23); `owner` is set ONLY through
        # `perform_create` (mirrors `Task.owner`, apps/agents/views.py:56-57).
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("owner", "is_default")
        # `owner` is read-only, and `unique_saved_view_owner_name` is a
        # 2-field UniqueConstraint, which DRF auto-derives a validator for
        # (rest_framework/serializers.py:1452-1473, verified against the
        # installed source this session — see Story 108 `## Context`, item
        # 10). That auto-validator would additionally mark `owner`
        # `required=True` (no model default, not nullable), and a field
        # cannot be BOTH `read_only` and `required` — DRF asserts on it at
        # serializer-instantiation time, a real crash, not a hypothetical.
        # Disabling the auto-validator and checking the duplicate-name case
        # explicitly in `validate()` below avoids it entirely, using the
        # SAME shape `BaseModelSerializer.validate()` already uses for
        # `immutable_fields`.
        validators = []

    def validate(self, attrs):
        attrs = super().validate(attrs)
        name = attrs.get("name", self.instance.name if self.instance else None)
        owner = self.instance.owner if self.instance else self.context["request"].user
        if name is not None:
            conflict = SavedView.objects.filter(owner=owner, name=name)
            if self.instance is not None:
                conflict = conflict.exclude(pk=self.instance.pk)
            if conflict.exists():
                raise serializers.ValidationError(
                    {"name": [_("You already have a saved view with this name.")]}
                )
        return attrs


class TicketSerializer(BaseModelSerializer):
    # Read-only convenience for the list/detail screens — without it, every
    # row would show a bare numeric customer id. Source traverses the FK;
    # the viewset's `select_related("customer")` (task 3) is what keeps this
    # from costing an extra query per row on `list`.
    # F-9: one overall SLA status for the queue, so an agent can see WHICH
    # tickets are breaching without opening each one. `met`/`breached`/
    # `pending` — `dimension_status`'s own vocabulary, deliberately not a
    # second one that could drift from `GET /tickets/<id>/sla/`.
    sla_status = serializers.SerializerMethodField()
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
    # Same verified dotted-source + `allow_null=True` pattern as
    # `department_name` above. `branch` itself needs no declaration.
    branch_name = serializers.CharField(source="branch.name", read_only=True, allow_null=True)
    # Same verified-safe dotted-source pattern as `category_name` above and
    # `NoteSerializer.author_name` (Story 21): `allow_null=True` is what
    # makes this return `None` instead of erroring when `assigned_agent` is
    # `None`. `get_full_name` is a method, not a field — DRF's
    # `get_attribute` calls it (verified in Story 21's own use), and it
    # falls back to the user's email when both name fields are blank.
    assigned_agent_name = serializers.CharField(
        source="assigned_agent.get_full_name", read_only=True, allow_null=True
    )
    # Same verified-safe dotted-source + `allow_null=True` pattern as
    # `category_name`/`department_name`/`branch_name` above. `merged_into`
    # itself needs no declaration — DRF derives `required=False,
    # allow_null=True` from the model field's own `null=True, blank=True`.
    merged_into_subject = serializers.CharField(
        source="merged_into.subject", read_only=True, allow_null=True
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
            "sla_status",
            "category",
            "category_name",
            "department",
            "department_name",
            "branch",
            "branch_name",
            "assigned_agent",
            "assigned_agent_name",
            "status",
            "priority",
            "escalated",
            "escalated_at",
            "merged_into",
            "merged_into_subject",
            "created_at",
            "updated_at",
        )
        # status/escalated/escalated_at are written ONLY through
        # TicketViewSet.set_status/escalate. Read-only here for the same
        # reason assigned_agent is (Story 22): a full-payload PATCH from the
        # edit form must never change them as a side effect. See Story 23
        # `## Prerequisites`. `merged_into` is written ONLY through
        # `TicketViewSet.merge` (Story 109) — the same rule.
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + (
            "assigned_agent",
            "status",
            "escalated",
            "escalated_at",
            "merged_into",
        )

    def get_sla_status(self, obj) -> str | None:
        """`met` / `breached` / `pending`, or `None` when no SLA policy
        applies to this ticket (tracking is opt-in — most tickets in a fresh
        install have none).

        Reads the `first_response_at`/`resolved_at` annotations
        (`annotate_sla_facts`) and the per-request resolver
        (`TicketViewSet.get_serializer_context`). Returns `None` when either
        is absent — i.e. on the create/update/retrieve paths, whose queryset
        is not annotated. That fallback is deliberate: calling
        `compute_sla_status` there instead would reintroduce, through the
        back door, exactly the per-ticket N+1 this field exists to avoid.
        The full per-ticket detail remains `GET /tickets/<id>/sla/`.
        """
        resolve = self.context.get("sla_resolve")
        if resolve is None or not hasattr(obj, "first_response_at"):
            return None
        return status_from_facts(
            obj.created_at,
            obj.priority,
            obj.category_id,
            obj.first_response_at,
            obj.resolved_at,
            resolve,
            timezone.now(),
        )
