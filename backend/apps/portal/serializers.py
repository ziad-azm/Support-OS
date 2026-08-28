from apps.tickets.serializers import TicketSerializer


class PortalTicketCreateSerializer(TicketSerializer):
    """`TicketSerializer`, narrowed for a customer's own submission.

    `customer` is read-only here on top of `TicketSerializer`'s own
    read-only set — `PortalTicketViewSet.perform_create` is what actually
    sets it, from `request.user.customer_profile`, never from client input.
    Scoping `get_queryset()` (CustomerScopedModelViewSet) protects reads;
    it does nothing for a writable field on `create`, which is why this
    also has to be a serializer-level change, not just a viewset one.

    `category` and `priority` are read-only too — not named in the
    intake's one task, and exposing a category picker would need a new
    customer-facing "list categories" endpoint nothing else here needs.
    A portal-submitted ticket lands uncategorized at the default priority;
    staff triage assigns both later, the same way an unassigned
    `assigned_agent` already works.
    """

    class Meta(TicketSerializer.Meta):
        read_only_fields = TicketSerializer.Meta.read_only_fields + (
            "customer",
            "category",
            "priority",
        )
