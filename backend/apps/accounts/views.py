from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.permissions import Permissions
from apps.core.views import BaseModelViewSet

from .models import Role
from .serializers import LogoutSerializer, RoleAdminSerializer, UserAdminSerializer, UserSerializer

User = get_user_model()


class LogoutView(APIView):
    """Blacklists the given refresh token.

    No Authorization header required: the refresh token in the body IS the
    credential being revoked, and a client whose access token has already
    expired must still be able to invalidate its refresh token. See
    CONVENTIONS.md §21.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            RefreshToken(serializer.validated_data["refresh"]).blacklist()
        except TokenError:
            # Already invalid/expired/blacklisted — the caller's goal (this
            # token must not work again) already holds. Idempotent by design.
            pass
        return Response(None, status=status.HTTP_200_OK)


class MeView(APIView):
    """The authenticated user's own profile. The frontend's one source of
    `AuthUser` — fetched once at boot and once right after login.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserViewSet(BaseModelViewSet):
    """Staff user administration — SEC-1. The identity half of the
    management screens Story 09 deferred; `RoleViewSet` below is the other
    half.

    No `destroy`: `accounts.User` is referenced by `agents.Task.owner` and
    `notifications.Notification.recipient` with `on_delete=CASCADE`
    (verified by grep across every `settings.AUTH_USER_MODEL` migration —
    see `## Story Goal`), so a hard delete would silently wipe a person's
    tasks and notifications. `http_method_names` drops "delete" entirely
    rather than leaving `destroy` unmapped in `permission_map` — the
    grant-on-omission rule (CONVENTIONS.md §22) means an unmapped action is
    authenticated-only, NOT forbidden, which would make this worse.
    Deactivation (`is_active=False` via `update`) is the sanctioned way to
    remove someone's access without touching their history.
    """

    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    serializer_class = UserAdminSerializer

    permission_map = {
        "list": Permissions.USERS_VIEW,
        "retrieve": Permissions.USERS_VIEW,
        "create": Permissions.USERS_MANAGE,
        "update": Permissions.USERS_MANAGE,
        "partial_update": Permissions.USERS_MANAGE,
    }

    # Each name here must match a `ColumnDef.id` on the frontend, exactly
    # like every prior feature's `ordering_fields` contract (§23).
    ordering_fields = ("email", "first_name", "last_name", "is_active", "date_joined")
    search_fields = ("email", "first_name", "last_name")

    def get_queryset(self):
        # Staff identities only. A portal customer's User row is
        # provisioned through `Customer.user` (Story 42, Django-admin-only)
        # and has no place in a staff-facing "manage users" screen.
        # `customer_profile` (the OneToOne's reverse accessor —
        # apps/customers/models.py:38-45) is the authoritative signal, not
        # `role.slug == "customer"`: the linked Customer row is what
        # actually grants portal access, independent of whatever role is
        # assigned. See `## Story Goal`.
        return User.objects.select_related("role").filter(customer_profile__isnull=True)


class RoleViewSet(BaseModelViewSet):
    """Role administration — SEC-1's other half. `list`/`retrieve` are
    gated on `users.view`, not `roles.manage`: `UserFormPage`'s role picker
    reads this endpoint, and it must work for anyone who can already see
    `UserViewSet.list` — the same cross-feature reuse
    `TicketViewSet.assignable_agents` established for `tickets.view`
    (apps/tickets/views.py:137-149). Only creating, renaming, or deleting a
    role needs the more sensitive `roles.manage`. `permissions` stays
    read-only — see `RoleAdminSerializer`.
    """

    queryset = Role.objects.all()
    serializer_class = RoleAdminSerializer

    permission_map = {
        "list": Permissions.USERS_VIEW,
        "retrieve": Permissions.USERS_VIEW,
        "create": Permissions.ROLES_MANAGE,
        "update": Permissions.ROLES_MANAGE,
        "partial_update": Permissions.ROLES_MANAGE,
        "destroy": Permissions.ROLES_MANAGE,
    }

    ordering_fields = ("name", "slug", "created_at")
    search_fields = ("name", "slug")

    def destroy(self, request, *args, **kwargs):
        """Mirrors `RoleAdmin.has_delete_permission` (apps/accounts/admin.py:42-45)
        for the API path — a system role must not be deletable from here
        either.
        """
        role = self.get_object()
        if role.is_system:
            raise ValidationError({"non_field_errors": [_("System roles cannot be deleted.")]})
        return super().destroy(request, *args, **kwargs)
