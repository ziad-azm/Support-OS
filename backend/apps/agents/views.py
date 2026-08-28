from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet
from apps.notifications.models import Notification
from apps.notifications.services import notify

from .models import InternalNote, QuickReply, Task
from .serializers import InternalNoteSerializer, QuickReplySerializer, TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    """The caller's own personal task/reminder list — AGENT-3. Deliberately
    not `apps.core.views.BaseModelViewSet`: a `Task` has no domain
    permission to gate (no role bundles a "tasks" grant), and every
    action here is scoped to `request.user`'s own rows via `get_queryset`
    — the same reasoning `NotificationViewSet` (Story 31) already
    established for an owner-scoped personal resource. Unlike
    `NotificationViewSet`, this IS full CRUD (create/update/destroy, not
    just list/retrieve), because a task is authored and edited by its
    owner, not system-generated. See Story 32 `## Prerequisites`.
    """

    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    # What makes `?ordering=` real for these columns (CONVENTIONS.md
    # §23) — each name here must match a `TaskListPage` `ColumnDef.id`.
    ordering_fields = ("due_at", "created_at", "title")

    def get_queryset(self):
        queryset = Task.objects.filter(owner=self.request.user).select_related("ticket")
        completed = self.request.query_params.get("completed")
        if completed:
            if completed not in ("true", "false"):
                raise ValidationError({"completed": [_('Must be "true" or "false" if present.')]})
            queryset = queryset.filter(completed_at__isnull=(completed == "false"))
        return queryset

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.completed_at is None:
            task.completed_at = timezone.now()
            task.save(update_fields=["completed_at", "updated_at"])
        return Response(self.get_serializer(task).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        task = self.get_object()
        if task.completed_at is not None:
            task.completed_at = None
            task.save(update_fields=["completed_at", "updated_at"])
        return Response(self.get_serializer(task).data)


class QuickReplyViewSet(BaseModelViewSet):
    """Reply-template CRUD — AGENT-4. Reuses `tickets.*`, the same call
    `CategoryViewSet` (`apps/tickets/views.py`) already made: a quick
    reply is part of the ticket-reply permission domain, not a separate
    one. See Story 33 `## Prerequisites`.
    """

    queryset = QuickReply.objects.all()
    serializer_class = QuickReplySerializer

    permission_map = {
        "list": Permissions.TICKETS_VIEW,
        "retrieve": Permissions.TICKETS_VIEW,
        "create": Permissions.TICKETS_MANAGE,
        "update": Permissions.TICKETS_MANAGE,
        "partial_update": Permissions.TICKETS_MANAGE,
        "destroy": Permissions.TICKETS_MANAGE,
    }

    ordering_fields = ("title", "created_at")
    search_fields = ("title", "body")


class InternalNoteViewSet(BaseModelViewSet):
    """Private, ticket-scoped collaboration notes — AGENT-5. Reuses
    `tickets.*`, the same cross-app permission reuse `QuickReplyViewSet`
    (Story 33) already established. See Story 34 `## Prerequisites`.
    """

    queryset = InternalNote.objects.select_related("author", "ticket").prefetch_related(
        "mentioned_users"
    )
    serializer_class = InternalNoteSerializer

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

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)
        note = serializer.instance
        # `Notification.body` is `CharField(max_length=500)` — `note.body`
        # is an unconstrained `TextField`, the first source text passed
        # into `notify(...)` that is not already guaranteed to fit. See
        # Story 34 `## Prerequisites`.
        notification_body = note.body[:500]
        for user in note.mentioned_users.exclude(pk=self.request.user.pk):
            notify(
                user,
                Notification.Kind.MENTIONED,
                ticket=note.ticket,
                title=f"You were mentioned on ticket #{note.ticket_id}",
                body=notification_body,
            )
