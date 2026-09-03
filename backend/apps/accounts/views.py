import logging

from django.contrib.auth import get_user_model
from django.utils.dateparse import parse_date
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from apps.agents.models import Task
from apps.core.permissions import Permissions
from apps.core.scoping import ScopedQuerysetMixin, ScopeFilter
from apps.core.throttling import FailOpenScopedRateThrottle
from apps.core.views import BaseModelViewSet

from .models import AuditLog, Role
from .serializers import (
    AuditLogSerializer,
    ChangePasswordSerializer,
    InviteConfirmSerializer,
    LogoutSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RoleAdminSerializer,
    UserAdminSerializer,
    UserSerializer,
)
from .tasks import send_invite_email

User = get_user_model()
logger = logging.getLogger(__name__)


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


class InviteConfirmView(APIView):
    """Completes SEC-5's invite flow: exchanges the token mailed by
    `send_invite_email` (apps/accounts/tasks.py) for a real password,
    activating the account `UserAdminSerializer.create` left pending. No
    Authorization header — the token IS the credential, the same reasoning
    `LogoutView` above already documents for a differently-shaped case.

    PROD-3: throttled on `auth_credentials` — the token IS the credential
    here, so an unlimited endpoint is a signed-token brute-force target.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"

    def post(self, request):
        serializer = InviteConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(None, status=status.HTTP_200_OK)


class PasswordResetRequestView(APIView):
    """SEC-7's "forgot password" first step. Never reveals whether
    `email` belongs to a real, active account — returns the identical
    `200` either way; `PasswordResetRequestSerializer.save()` is a silent
    no-op for a non-existent, inactive, or already-unusable-password
    account. Rate limited (`throttle_scope`, `DEFAULT_THROTTLE_RATES` in
    `config/settings/base.py`) — the one thing that actually needs a
    limit here, since an unlimited version could be abused to spam a
    given inbox or as a brute-force enumeration timing oracle at volume.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    # PROD-3 swapped `ScopedRateThrottle` for the fail-open subclass: the
    # stock class raises out of `allow_request` when its cache is
    # unreachable, which would 500 this endpoint on a Redis outage. Scope
    # and rate are unchanged from SEC-7. See CONVENTIONS.md § 36.
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "password_reset_request"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(None, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """SEC-7's reset-confirm step: exchanges the token mailed by
    `send_password_reset_email` (apps/accounts/tasks.py) for a new
    password on an already-active account — the opposite precondition
    from `InviteConfirmView` above, which only ever accepts a pending,
    `is_active=False` one. No Authorization header — the token IS the
    credential, the same reasoning `LogoutView` above documents.

    PROD-3: now throttled on `auth_credentials`. SEC-7 limited the *request*
    half of this flow and deliberately left the *confirm* half open; the
    PROD-3 audit found that asymmetry, and a signed token that can be
    guessed without limit is the same brute-force target the request half
    was protected against. See CONVENTIONS.md § 36.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(None, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    """SEC-8's change-password step. `IsAuthenticated` only — no
    `authentication_classes` override, unlike every other view in this
    file so far: this is the first credential action that requires the
    caller already be signed in rather than anonymous, the same posture
    `MeView` below already has. Passes `context={"request": request}`
    explicitly when instantiating the serializer — the first plain
    `APIView` in this codebase that needs to (`## Prerequisites`); a
    `ModelViewSet`'s own `get_serializer()` would do this automatically,
    but nothing here is a `ModelViewSet`.

    PROD-3: throttled on `auth_credentials` — the serializer checks
    `current_password`, so an unlimited endpoint brute-forces it from a
    hijacked session. Keyed per user here rather than per IP, since the
    caller is authenticated (`FailOpenScopedRateThrottle.get_cache_key`).
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [FailOpenScopedRateThrottle]
    throttle_scope = "auth_credentials"

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(None, status=status.HTTP_200_OK)


class MeView(APIView):
    """The authenticated user's own profile. The frontend's one source of
    `AuthUser` — fetched once at boot and once right after login.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserViewSet(ScopedQuerysetMixin, BaseModelViewSet):
    """Staff user administration — SEC-1, extended by SEC-5 (invite-only
    creation) and SEC-6 (this story, hard delete).

    `destroy` is real: `agents.Task.owner`, `notifications.Notification.recipient`,
    and `integrations.ApiKey.user` (INT-1) are the three `on_delete=CASCADE`
    relationships to `accounts.User` (re-verified — see `## Prerequisites`).
    `Notification` rows are safe to let cascade — they have no meaning
    without their recipient (their own model docstring). `integrations.ApiKey`
    rows (INT-1) are safe to let cascade too — a key has no meaning without
    the identity it authenticates as, the same reasoning `Notification`
    records for itself. `Task` rows are not: `Task.owner` is required and,
    per `apps/agents/models.py`'s own docstring, a task is never reassigned —
    so `destroy()` below blocks the delete instead, the same PROTECT-style
    guard `RoleViewSet.destroy` already uses for a system role. It also
    refuses to let a caller delete their own account — a new guard, not
    forced by any CASCADE risk; see `## Story Goal` finding 2.
    """

    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]
    # Now a real class attribute (SEC-1 had none): `ScopedQuerysetMixin`
    # reaches the base implementation through `super().get_queryset()`,
    # and `ModelViewSet.get_queryset` asserts without one.
    queryset = User.objects.select_related("role", "department", "branch")
    serializer_class = UserAdminSerializer

    permission_map = {
        "list": Permissions.USERS_VIEW,
        "retrieve": Permissions.USERS_VIEW,
        "create": Permissions.USERS_MANAGE,
        "update": Permissions.USERS_MANAGE,
        "partial_update": Permissions.USERS_MANAGE,
        "destroy": Permissions.USERS_MANAGE,
    }

    # Each name here must match a `ColumnDef.id` on the frontend, exactly
    # like every prior feature's `ordering_fields` contract (§23).
    ordering_fields = ("email", "first_name", "last_name", "is_active", "date_joined")
    search_fields = ("email", "first_name", "last_name")

    # ORG-1's reusable scoping declaration, now with ORG-2's second entry —
    # added without one line of new parsing code, which was the point. The
    # two compose with AND. See `apps/core/scoping.py`.
    scope_filters = (
        ScopeFilter(param="department", field="department"),
        ScopeFilter(param="branch", field="branch"),
    )

    def get_queryset(self):
        # Staff identities only. A portal customer's User row is
        # provisioned through `Customer.user` (Story 42, Django-admin-only)
        # and has no place in a staff-facing "manage users" screen.
        # `customer_profile` (the OneToOne's reverse accessor —
        # apps/customers/models.py:38-45) is the authoritative signal, not
        # `role.slug == "customer"`: the linked Customer row is what
        # actually grants portal access, independent of whatever role is
        # assigned. See `## Story Goal`.
        return super().get_queryset().filter(customer_profile__isnull=True)

    def perform_create(self, serializer):
        super().perform_create(serializer)
        user = serializer.instance
        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.Action.USER_CREATED,
            target_user=user,
            target_label=user.get_full_name(),
        )
        # Best-effort, same commit-first idiom `apps.notifications.services.notify`
        # uses around its own `send_notification_email.delay(...)` call — a down
        # Redis/worker must never fail or roll back the already-created account.
        try:
            send_invite_email.delay(user.id)
        except Exception:
            logger.exception("Failed to queue invite email for user %s", user.id)

    def perform_update(self, serializer):
        user = serializer.instance
        old_role_id = user.role_id
        old_role_name = user.role.name if old_role_id else ""
        old_is_active = user.is_active
        super().perform_update(serializer)

        if user.role_id != old_role_id:
            AuditLog.objects.create(
                actor=self.request.user,
                action=AuditLog.Action.USER_ROLE_CHANGED,
                target_user=user,
                target_label=user.get_full_name(),
                from_value=old_role_name,
                to_value=user.role.name if user.role_id else "",
            )
        if user.is_active != old_is_active:
            AuditLog.objects.create(
                actor=self.request.user,
                action=AuditLog.Action.USER_STATUS_CHANGED,
                target_user=user,
                target_label=user.get_full_name(),
                from_value=_("Active") if old_is_active else _("Inactive"),
                to_value=_("Active") if user.is_active else _("Inactive"),
            )

    def destroy(self, request, *args, **kwargs):
        """Hard-deletes a User — SEC-6. See the class docstring for the
        CASCADE/PROTECT-style reasoning. Both guards below raise before
        `super().destroy()` ever runs, so neither a self-delete attempt
        nor a still-has-tasks user is ever partially deleted.
        """
        user = self.get_object()
        if user.id == request.user.id:
            raise ValidationError({"non_field_errors": [_("You cannot delete your own account.")]})
        if Task.objects.filter(owner=user).exists():
            raise ValidationError(
                {
                    "non_field_errors": [
                        _(
                            "This user still owns tasks. Complete or remove "
                            "them before deleting this account."
                        )
                    ]
                }
            )
        user_label = user.get_full_name()
        response = super().destroy(request, *args, **kwargs)
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.USER_DELETED,
            target_user=None,
            target_label=user_label,
        )
        return response


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

    def perform_create(self, serializer):
        super().perform_create(serializer)
        role = serializer.instance
        AuditLog.objects.create(
            actor=self.request.user,
            action=AuditLog.Action.ROLE_CREATED,
            target_role=role,
            target_label=role.name,
        )

    def perform_update(self, serializer):
        role = serializer.instance
        old_name = role.name
        old_permissions = list(role.permissions)
        super().perform_update(serializer)

        if role.name != old_name:
            AuditLog.objects.create(
                actor=self.request.user,
                action=AuditLog.Action.ROLE_RENAMED,
                target_role=role,
                target_label=role.name,
                from_value=old_name,
                to_value=role.name,
            )
        if set(role.permissions) != set(old_permissions):
            AuditLog.objects.create(
                actor=self.request.user,
                action=AuditLog.Action.ROLE_PERMISSIONS_CHANGED,
                target_role=role,
                target_label=role.name,
                from_value=", ".join(sorted(old_permissions)),
                to_value=", ".join(sorted(role.permissions)),
            )

    def destroy(self, request, *args, **kwargs):
        """Mirrors `RoleAdmin.has_delete_permission` (apps/accounts/admin.py:42-45)
        for the API path — a system role must not be deletable from here
        either. Logs the deletion only after it actually succeeds: a role
        still referenced by a user raises `ProtectedError` inside
        `super().destroy()` (caught globally and turned into a clean 400 by
        `apps/core/exceptions.py`), and logging beforehand — as this method
        used to — left a permanent, false `ROLE_DELETED` audit row for a
        role that was never actually deleted (no transaction wraps the
        request; `ATOMIC_REQUESTS` isn't set). `target_role=None` here
        matches the same shape any other `AuditLog` row ends up in once its
        target is later deleted (`on_delete=SET_NULL`) — `target_label` is
        what keeps the entry meaningful either way.
        """
        role = self.get_object()
        if role.is_system:
            raise ValidationError({"non_field_errors": [_("System roles cannot be deleted.")]})
        role_name = role.name
        response = super().destroy(request, *args, **kwargs)
        AuditLog.objects.create(
            actor=request.user,
            action=AuditLog.Action.ROLE_DELETED,
            target_role=None,
            target_label=role_name,
        )
        return response


class AuditLogViewSet(BaseModelViewSet):
    """The read-only viewer over `AuditLog` — SEC-3's "filtered viewer".
    `http_method_names` drops every unsafe verb entirely, the same
    `UserViewSet` precedent (Story 48) for actively disabling an action
    rather than leaving it unmapped: an omitted `permission_map` entry is
    merely authenticated-only (`HasPermission`'s grant-on-omission rule),
    which would be the wrong default for a table the intake calls
    "immutable". POST/PUT/PATCH/DELETE now 405 at Django's own dispatch
    level, before `HasPermission` is ever consulted.
    """

    http_method_names = ["get", "head", "options"]
    queryset = AuditLog.objects.select_related("actor", "target_user", "target_role").all()
    serializer_class = AuditLogSerializer

    permission_map = {
        "list": Permissions.AUDIT_LOG_VIEW,
        "retrieve": Permissions.AUDIT_LOG_VIEW,
    }

    ordering_fields = ("created_at", "action")
    search_fields = ("target_label",)

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != "list":
            return queryset

        params = self.request.query_params

        actor_id = params.get("actor")
        if actor_id:
            try:
                actor_id = int(actor_id)
            except ValueError:
                raise ValidationError({"actor": [_("Must be a valid user id.")]}) from None
            queryset = queryset.filter(actor_id=actor_id)

        action_filter = params.get("action")
        if action_filter:
            if action_filter not in AuditLog.Action.values:
                raise ValidationError({"action": [_("Must be a valid action.")]})
            queryset = queryset.filter(action=action_filter)

        target_type = params.get("target_type")
        if target_type:
            if target_type == "user":
                queryset = queryset.filter(target_user__isnull=False)
            elif target_type == "role":
                queryset = queryset.filter(target_role__isnull=False)
            else:
                raise ValidationError({"target_type": [_('Must be "user" or "role".')]})

        date_from = params.get("date_from")
        if date_from:
            parsed = parse_date(date_from)
            if parsed is None:
                raise ValidationError({"date_from": [_("Must be a valid date (YYYY-MM-DD).")]})
            queryset = queryset.filter(created_at__date__gte=parsed)

        date_to = params.get("date_to")
        if date_to:
            parsed = parse_date(date_to)
            if parsed is None:
                raise ValidationError({"date_to": [_("Must be a valid date (YYYY-MM-DD).")]})
            queryset = queryset.filter(created_at__date__lte=parsed)

        return queryset
