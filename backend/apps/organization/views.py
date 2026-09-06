from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions
from apps.core.views import BaseModelViewSet

from .models import Branch, Department, LandingContent, LandingHighlight, OrganizationSettings
from .serializers import (
    BranchSerializer,
    BrandingSerializer,
    DepartmentSerializer,
    LandingContentAdminSerializer,
    LandingHighlightSerializer,
    OrganizationSettingsSerializer,
    PublicLandingContentSerializer,
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


class LandingContentView(APIView):
    """Public landing content — LAND-2. The SECOND endpoint in this app
    reachable without a session, and a deliberate SIBLING of `BrandingView`
    above rather than an extension of it.

    Why not just add the fields to `BrandingSerializer`: that payload is
    fetched once per session by `<BrandingSync>` on EVERY route — login,
    portal, every staff screen — because it drives the brand colour and the
    document title. Landing marketing copy is needed on exactly one route.
    Merging them would ship ~20 unused strings to every signed-in agent's
    first page load and break that serializer's "THREE FIELDS,
    DELIBERATELY" contract.

    Same explicit-open pair as `BrandingView`: `authentication_classes = []`
    AND `permission_classes = [AllowAny]`. Both are needed — `AllowAny`
    alone still runs authentication, so a stale `Authorization` header
    would 401 the product's front door.

    NO `throttle_classes`: it inherits the `anon` 300/hour baseline from
    `DEFAULT_THROTTLE_CLASSES` (config/settings/base.py). Declaring its own
    would REPLACE that baseline rather than stack with it (CONVENTIONS.md
    § 36).

    GET only, so any other verb 405s through Django's own
    `http_method_not_allowed` — the same reasoning `BrandingView` records.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(PublicLandingContentSerializer(LandingContent.load()).data)


class LandingContentAdminView(APIView):
    """The admin read/write side of the one `LandingContent` row —
    `SettingsView` above, for landing copy. Same singleton `APIView` shape,
    same lowercased-method `permission_map`, same `settings.manage`: org
    marketing copy is admin-only by intent (LAND-2's own constraint), so
    this reuses the existing permission rather than minting a new one.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"get": Permissions.SETTINGS_MANAGE, "patch": Permissions.SETTINGS_MANAGE}

    def get(self, request):
        return Response(LandingContentAdminSerializer(LandingContent.load()).data)

    def patch(self, request):
        content = LandingContent.load()
        serializer = LandingContentAdminSerializer(content, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LandingHighlightViewSet(BaseModelViewSet):
    """Highlight-card CRUD — LAND-2. `DepartmentViewSet` above, for the
    ordered list behind the public landing page.

    ONE permission, not two, unlike `DEPARTMENTS_VIEW`/`DEPARTMENTS_MANAGE`:
    nothing in the staff app renders a highlight picker or filter, so there
    is no read-only consumer to widen for. The one caller that needs to
    READ highlights without `settings.manage` is the anonymous landing page,
    and it reads them through `LandingContentView` above.

    NOT a `ScopedQuerysetMixin` consumer — there is one landing page, not
    one per branch.
    """

    queryset = LandingHighlight.objects.all()
    serializer_class = LandingHighlightSerializer

    permission_map = {
        "list": Permissions.SETTINGS_MANAGE,
        "retrieve": Permissions.SETTINGS_MANAGE,
        "create": Permissions.SETTINGS_MANAGE,
        "update": Permissions.SETTINGS_MANAGE,
        "partial_update": Permissions.SETTINGS_MANAGE,
        "destroy": Permissions.SETTINGS_MANAGE,
    }

    # Each name must match a `ColumnDef.id` on `LandingHighlightListPage` (§23).
    ordering_fields = ("order", "title_en", "created_at")
    search_fields = ("title_en", "title_ar")
