from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions
from apps.core.views import BaseModelViewSet

from .models import Department, OrganizationSettings
from .serializers import DepartmentSerializer, OrganizationSettingsSerializer


class DepartmentViewSet(BaseModelViewSet):
    """Department CRUD — ORG-1. The first `ModelViewSet` in this app
    (`SettingsView` is a singleton `APIView`), so the first place
    `apps.organization` needs a router at all — see `urls.py`.

    Two permissions, not one: `departments.view` reaches every staff role
    because the ticket form's picker and the ticket list's filter both need
    the list; `departments.manage` is admin-only. See migration
    `0006_grant_department_permissions`.
    """

    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer

    permission_map = {
        "list": Permissions.DEPARTMENTS_VIEW,
        "retrieve": Permissions.DEPARTMENTS_VIEW,
        "create": Permissions.DEPARTMENTS_MANAGE,
        "update": Permissions.DEPARTMENTS_MANAGE,
        "partial_update": Permissions.DEPARTMENTS_MANAGE,
        "destroy": Permissions.DEPARTMENTS_MANAGE,
    }

    # Each name must match a `ColumnDef.id` on `DepartmentListPage` (§23).
    ordering_fields = ("name", "created_at")
    search_fields = ("name", "description")


class SettingsView(APIView):
    """The one organization-wide settings record. `GET`/`PATCH` only, no
    id in the path — the same "there is exactly one relevant object" shape
    `MeView` (apps/accounts/views.py:44-52) already established, keyed by
    lowercased HTTP method rather than a DRF `action` the same way
    `PermissionCatalogView` (apps/core/views.py) is for a plain `APIView`.
    Any other verb 405s via Django's own `http_method_not_allowed` — only
    `get`/`patch` are defined, no `http_method_names` override needed.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"get": Permissions.SETTINGS_MANAGE, "patch": Permissions.SETTINGS_MANAGE}

    def get(self, request):
        return Response(OrganizationSettingsSerializer(OrganizationSettings.load()).data)

    def patch(self, request):
        settings_obj = OrganizationSettings.load()
        serializer = OrganizationSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
