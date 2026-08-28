from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import QuickReply, Task


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
