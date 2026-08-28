from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Task
from .serializers import TaskSerializer


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
