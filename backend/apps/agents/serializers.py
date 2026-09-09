from django.db.models import QuerySet
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer
from apps.tickets.assignment import assignable_agents
from apps.tickets.models import Ticket

from .models import InternalNote, QuickReply, Task


def linkable_tickets(user) -> QuerySet:
    """Tickets `user` may reference from a personal record — AGENT-3 / F-1.

    The caller-dependent sibling of `apps.tickets.assignment.assignable_agents`:
    same job (an explicit `queryset=` so a hand-crafted request cannot reach a
    row the caller could not otherwise read), but the pool narrows per caller
    rather than being one fixed set.

    A portal caller is identified exactly as `HasPermission.has_object_permission`
    identifies one (`apps/core/permissions.py:132`) — by a linked
    `customers.Customer` via `customer_profile`. Staff have none, so they keep
    the full queryset and their behaviour is unchanged. A staff account that
    also happens to carry a linked `Customer` row IS treated as a portal
    caller here; that mirrors `has_object_permission`, which likewise
    tightens on the presence of `customer_profile` rather than on role.

    Story 32 deliberately left this field unguarded, reasoning that the picker
    is already gated on `tickets.view`. That is true of the picker and untrue
    of the API: verified live, a `portal.access`-only account could POST a
    foreign ticket id and read its subject back out of `ticket_subject`.
    Story 34 had already applied this exact defence to
    `InternalNoteSerializer.mentioned_users` (below); this brings the two
    writable relations in this module under one rule.
    """
    queryset = Ticket.objects.all()
    customer = getattr(user, "customer_profile", None)
    if customer is None:
        return queryset
    return queryset.filter(customer=customer)


class TaskSerializer(BaseModelSerializer):
    # Read-only convenience, the same role `NotificationSerializer.ticket_subject`
    # plays (Story 31) — `default=""` covers a null `ticket` (the link is
    # optional; most tasks have none). The WRITABLE `ticket` relation below is
    # what gates this: `get_fields` binds it to `linkable_tickets(request.user)`,
    # so a portal caller can never name a ticket that is not their own and
    # therefore never reads a subject that is not theirs. Story 32 left this
    # open; F-1 (qa-report-1) closed it.
    ticket_subject = serializers.CharField(source="ticket.subject", read_only=True, default="")

    class Meta(BaseModelSerializer.Meta):
        model = Task
        fields = (
            "id",
            "ticket",
            "ticket_subject",
            "title",
            "description",
            "due_at",
            "completed_at",
            "reminder_sent_at",
            "created_at",
            "updated_at",
        )
        # Additionally read-only, unlike `NotificationSerializer.read_at`
        # (never enforced there because `NotificationViewSet` has no
        # create/update action at all to bypass through). `TaskViewSet`
        # IS full CRUD, so without this a client could PATCH
        # `completed_at` directly, bypassing `complete`/`reopen`'s own
        # `timezone.now()` semantics. See Story 32 `## Prerequisites`.
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + (
            "completed_at",
            "reminder_sent_at",
        )

    def get_fields(self):
        """Binds `ticket`'s queryset to the caller — see `linkable_tickets`.

        `get_fields`, not a `validate_ticket`: DRF resolves a
        `PrimaryKeyRelatedField` against its queryset *before* any
        `validate_<field>` runs, so a rejection here is DRF's own
        "object does not exist" 400 rather than a second, different error
        shape. A caller therefore cannot tell "not yours" from "does not
        exist", which is the point — the two must stay indistinguishable or
        the id space is still enumerable.

        The `request is not None` guard covers every non-HTTP instantiation
        (a shell, `apps/agents/tasks.py`'s reminder job, a future management
        command): those keep the default full queryset rather than raising.
        """
        fields = super().get_fields()
        request = self.context.get("request")
        if request is not None:
            fields["ticket"].queryset = linkable_tickets(request.user)
        return fields


class QuickReplySerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = QuickReply
        fields = ("id", "title", "body", "created_at", "updated_at")


class InternalNoteSerializer(BaseModelSerializer):
    # Mirrors `NoteSerializer.author_name` exactly — `allow_null=True`
    # covers a deleted author (SET_NULL).
    author_name = serializers.CharField(
        source="author.get_full_name", read_only=True, allow_null=True
    )
    # A SerializerMethodField, not a `source=` trick — that shortcut only
    # works for a single FK (see `author_name`, above), not a many-relation.
    mentioned_user_names = serializers.SerializerMethodField()
    # Explicit `queryset=`, not DRF's auto-generated `User.objects.all()`:
    # validates against the same candidate pool `TicketViewSet.assign`
    # already validates assignment against, so a hand-crafted request
    # cannot mention (and notify) an agent who holds no `tickets.manage`.
    # See Story 34 `## Prerequisites`.
    mentioned_users = serializers.PrimaryKeyRelatedField(
        many=True, required=False, queryset=assignable_agents()
    )

    # `ticket` must stay writable on create (chosen from the ticket detail
    # page's add-note form) but must never change afterward — a PATCH that
    # moves `ticket` silently relocates a private, ticket-scoped note onto
    # an unrelated ticket. See `BaseModelSerializer`.
    immutable_fields = ("ticket",)

    class Meta(BaseModelSerializer.Meta):
        model = InternalNote
        fields = (
            "id",
            "ticket",
            "author",
            "author_name",
            "body",
            "mentioned_users",
            "mentioned_user_names",
            "created_at",
            "updated_at",
        )
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("author",)

    def get_mentioned_user_names(self, obj) -> list[str]:
        return [user.get_full_name() for user in obj.mentioned_users.all()]
