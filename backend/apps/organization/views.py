from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions
from apps.core.views import BaseModelViewSet

from .models import Branch, Department, OrganizationSettings
from .serializers import (
    BranchSerializer,
    BrandingSerializer,
    DepartmentSerializer,
    OrganizationSettingsSerializer,
)


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


class BranchViewSet(BaseModelViewSet):
    """Branch CRUD — ORG-2. `DepartmentViewSet` above, for the other org
    unit.

    Two permissions, not one: `branches.view` reaches every staff role
    because the ticket form's picker, the customer form's picker, and three
    list filters all need the list; `branches.manage` is admin-only. See
    migration `0010_grant_branch_permissions`.

    NOT a `ScopedQuerysetMixin` consumer — a branch is the thing other
    models are scoped BY, not a thing that is itself scoped.
    """

    queryset = Branch.objects.all()
    serializer_class = BranchSerializer

    permission_map = {
        "list": Permissions.BRANCHES_VIEW,
        "retrieve": Permissions.BRANCHES_VIEW,
        "create": Permissions.BRANCHES_MANAGE,
        "update": Permissions.BRANCHES_MANAGE,
        "partial_update": Permissions.BRANCHES_MANAGE,
        "destroy": Permissions.BRANCHES_MANAGE,
    }

    # Each name must match a `ColumnDef.id` on `BranchListPage` (§23).
    ordering_fields = ("name", "created_at")
    search_fields = ("name", "description")


class BrandingView(APIView):
    """Public branding — ORG-3. The only endpoint in this app reachable
    without a session.

    `authentication_classes = []` AND `permission_classes = [AllowAny]`,
    the same explicit-open pair `HealthView` (apps/core/views.py:65-87)
    uses. Both are needed: `AllowAny` alone would still run
    authentication, so a stale or malformed `Authorization` header on a
    visitor's first request would 401 the login page's own branding.

    WHY THIS EXISTS AT ALL, rather than relaxing `SettingsView` below:
    two different callers need branding and neither can have
    `settings.manage`. An anonymous visitor on `/` or `/login` has no
    session; a signed-in agent has one but is not an admin. Widening
    `SettingsView` would have published the SLA defaults to both.

    GET only, so any other verb 405s through Django's own
    `http_method_not_allowed` — no `http_method_names` override needed,
    the same reasoning `SettingsView` records for itself. No
    `permission_map`: `HasPermission` is not in the permission classes, so
    there is nothing to key.

    Returns the serializer's plain dict; the renderer builds the envelope
    (apps/core/views.py:65-70's rule).
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(BrandingSerializer(OrganizationSettings.load()).data)


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
