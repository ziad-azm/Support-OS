from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer
from apps.tickets.assignment import assignable_agents

from .models import InternalNote, QuickReply, Task


class TaskSerializer(BaseModelSerializer):
    # Read-only convenience, the same role `NotificationSerializer.ticket_subject`
    # plays (Story 31) — `default=""` covers a null `ticket` (the link is
    # optional; most tasks have none). No extra permission check on this
    # field — see Story 32 `## Prerequisites`.
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
