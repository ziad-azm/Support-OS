from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.permissions import HasPermission, Permissions
from apps.core.views import BaseModelViewSet

from .models import (
    Branch,
    BusinessCalendar,
    Department,
    Holiday,
    LandingContent,
    LandingHighlight,
    LandingSocialLink,
    OrganizationSettings,
    WorkingWindow,
)
from .serializers import (
    BranchSerializer,
    BrandingSerializer,
    CalendarSerializer,
    DepartmentSerializer,
    HolidaySerializer,
    LandingContentAdminSerializer,
    LandingHighlightSerializer,
    LandingSocialLinkSerializer,
    OrganizationSettingsSerializer,
    PublicLandingContentSerializer,
    WorkingWindowSerializer,
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

    queryset = Branch.objects.select_related("calendar").all()
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


class CalendarViewSet(BaseModelViewSet):
    """`BusinessCalendar` CRUD — SLA-5's management screen (Story 111).
    `BranchViewSet` above, for the calendar primitive. Two permissions:
    `calendars.view` reaches `admin`/`manager` (the `BranchFormPage`
    picker needs it); `calendars.manage` is admin-only. See migration
    `0017_grant_calendar_permissions`.
    """

    queryset = BusinessCalendar.objects.all()
    serializer_class = CalendarSerializer

    permission_map = {
        "list": Permissions.CALENDARS_VIEW,
        "retrieve": Permissions.CALENDARS_VIEW,
        "create": Permissions.CALENDARS_MANAGE,
        "update": Permissions.CALENDARS_MANAGE,
        "partial_update": Permissions.CALENDARS_MANAGE,
        "destroy": Permissions.CALENDARS_MANAGE,
    }

    ordering_fields = ("name", "created_at")
    search_fields = ("name", "description")


class WorkingWindowViewSet(BaseModelViewSet):
    """`WorkingWindow` CRUD for one calendar — SLA-5 (Story 111).
    `ContactDetailViewSet` (apps/customers/views.py) — reuses
    `calendars.*`, not a separate permission domain, the same reasoning
    that story records for `ContactDetail` reusing `customers.*`
    (Story 11).
    """

    queryset = WorkingWindow.objects.all()
    serializer_class = WorkingWindowSerializer

    permission_map = {
        "list": Permissions.CALENDARS_VIEW,
        "retrieve": Permissions.CALENDARS_VIEW,
        "create": Permissions.CALENDARS_MANAGE,
        "update": Permissions.CALENDARS_MANAGE,
        "partial_update": Permissions.CALENDARS_MANAGE,
        "destroy": Permissions.CALENDARS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        calendar_id = self.request.query_params.get("calendar")
        if not calendar_id:
            raise ValidationError({"calendar": [_("This query parameter is required.")]})
        try:
            calendar_id = int(calendar_id)
        except ValueError:
            raise ValidationError({"calendar": [_("Must be a valid calendar id.")]}) from None
        return queryset.filter(calendar_id=calendar_id)


class HolidayViewSet(BaseModelViewSet):
    """`Holiday` CRUD for one calendar — SLA-5 (Story 111).
    `WorkingWindowViewSet` above, identical shape.
    """

    queryset = Holiday.objects.all()
    serializer_class = HolidaySerializer

    permission_map = {
        "list": Permissions.CALENDARS_VIEW,
        "retrieve": Permissions.CALENDARS_VIEW,
        "create": Permissions.CALENDARS_MANAGE,
        "update": Permissions.CALENDARS_MANAGE,
        "partial_update": Permissions.CALENDARS_MANAGE,
        "destroy": Permissions.CALENDARS_MANAGE,
    }

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset
        calendar_id = self.request.query_params.get("calendar")
        if not calendar_id:
            raise ValidationError({"calendar": [_("This query parameter is required.")]})
        try:
            calendar_id = int(calendar_id)
        except ValueError:
            raise ValidationError({"calendar": [_("Must be a valid calendar id.")]}) from None
        return queryset.filter(calendar_id=calendar_id)


@extend_schema(
    request=None,
    responses=BrandingSerializer,
    summary="Public branding (name, logo, primary colour)",
)
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


@extend_schema_view(
    get=extend_schema(
        request=None,
        responses=OrganizationSettingsSerializer,
        summary="Read organization settings",
    ),
    patch=extend_schema(
        request=OrganizationSettingsSerializer,
        responses=OrganizationSettingsSerializer,
        summary="Update organization settings",
    ),
)
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


@extend_schema(
    request=None,
    responses=PublicLandingContentSerializer,
    summary="Public landing-page content",
)
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


@extend_schema_view(
    get=extend_schema(
        request=None,
        responses=LandingContentAdminSerializer,
        summary="Read landing-page content for editing",
    ),
    patch=extend_schema(
        request=LandingContentAdminSerializer,
        responses=LandingContentAdminSerializer,
        summary="Update landing-page content",
    ),
)
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


class LandingSocialLinkViewSet(BaseModelViewSet):
    """Social/contact link CRUD — LAND-3. `LandingHighlightViewSet` above,
    for the other ordered list behind the public landing page.

    ONE permission, for the same reason that viewset gives: nothing in the
    staff app reads these except this screen, and the one caller that needs
    them without `settings.manage` is the anonymous landing page, which
    reads them through `LandingContentView`.

    `list` is NOT filtered to `is_enabled=True` — the admin screen must show
    disabled rows, since toggling them is the whole point. Only the PUBLIC
    serializer filters.
    """

    queryset = LandingSocialLink.objects.all()
    serializer_class = LandingSocialLinkSerializer

    permission_map = {
        "list": Permissions.SETTINGS_MANAGE,
        "retrieve": Permissions.SETTINGS_MANAGE,
        "create": Permissions.SETTINGS_MANAGE,
        "update": Permissions.SETTINGS_MANAGE,
        "partial_update": Permissions.SETTINGS_MANAGE,
        "destroy": Permissions.SETTINGS_MANAGE,
    }

    # Each name must match a `ColumnDef.id` on `LandingSocialLinkListPage` (§23).
    ordering_fields = ("order", "platform", "created_at")
    search_fields = ("value",)
