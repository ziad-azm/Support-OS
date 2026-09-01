from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.permissions import ALL_PERMISSIONS, permissions_for
from apps.core.serializers import BaseModelSerializer

from .models import AuditLog, Role

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("slug", "name")


class RoleAdminSerializer(BaseModelSerializer):
    """CRUD over `Role` for SEC-1/SEC-2's admin screen. `permissions` is
    writable here — validated against `ALL_PERMISSIONS` the same way
    `Role.clean()` validates it for the Django-admin path (DRF does not call
    model `clean()`, so this serializer must repeat the check; see
    CONVENTIONS.md §22). `is_system` stays read-only — it protects `slug`
    and `destroy` only (see `validate_slug` below and `RoleViewSet.destroy`),
    never `permissions`: editing a system role's grants is this story's
    whole point.
    """

    class Meta(BaseModelSerializer.Meta):
        model = Role
        fields = (
            "id",
            "slug",
            "name",
            "description",
            "permissions",
            "is_system",
            "created_at",
            "updated_at",
        )
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("is_system",)

    def validate_slug(self, value):
        """A system role's slug is code-referenced (the seed migrations key
        on it) and admin-protected (`RoleAdmin.get_readonly_fields`); this
        mirrors that guard for the API path, since DRF does not call model
        `clean()` (the same split CONVENTIONS.md §22 records for `Role.clean()`
        itself, which only guards `permissions`, not `slug`).
        """
        if self.instance is not None and self.instance.is_system and value != self.instance.slug:
            raise serializers.ValidationError(_("A system role's slug cannot be changed."))
        return value

    def validate_permissions(self, value):
        """Mirrors `Role.clean()` (apps/accounts/models.py:69-86) for the API
        path — DRF does not call model `clean()`, so a bare `partial_update`
        would otherwise let `permissions` drift from `ALL_PERMISSIONS` with
        no check at all. Deliberately does NOT special-case `is_system`:
        editing a seeded role's permissions is this story's entire purpose.
        """
        if not isinstance(value, list):
            raise serializers.ValidationError(_("Permissions must be a list."))
        unknown = sorted(set(value) - ALL_PERMISSIONS)
        if unknown:
            raise serializers.ValidationError(
                _("Unknown permissions: %(names)s") % {"names": ", ".join(unknown)}
            )
        return value


class UserSerializer(serializers.ModelSerializer):
    """Deliberately NOT `BaseModelSerializer` — that base exists for
    `TimeStampedModel`'s `created_at`/`updated_at`, which `User` does not
    have. See Story 08 `## Context` item 5.
    """

    role = RoleSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "is_staff", "role", "permissions")
        read_only_fields = ("id", "is_staff", "role", "permissions")

    def get_permissions(self, user) -> list[str]:
        """The SAME resolution the API enforces with, including the superuser
        bypass — `permissions_for` is the single source. Returning only
        role-derived permissions here would hide controls from a superuser
        that the API would happily allow. See CONVENTIONS.md §22.
        """
        return sorted(permissions_for(user))


class UserAdminSerializer(serializers.ModelSerializer):
    """CRUD over `User` for SEC-1's admin screen. Deliberately NOT
    `BaseModelSerializer` — `User` has no `created_at`/`updated_at`, the
    same reason `UserSerializer` above is not (Story 08 `## Context` item 5).

    `is_staff`/`is_superuser` are read-only and shown only for display (e.g.
    explaining why an account with `role: null` still has full access, per
    `/auth/me/`'s own superuser note in `permissions_for`) — granting either
    is a Django-admin-only action, never exposed through this API.
    """

    # Same dotted-source pattern as `TicketSerializer.category_name`
    # (apps/tickets/serializers.py:26) — `allow_null=True` because `role`
    # itself is nullable. `role` needs no explicit declaration: DRF derives
    # `required=False, allow_null=True` from the model FK's own
    # `null=True, blank=True`, the same verified derivation
    # `TicketSerializer.category` relies on.
    role_name = serializers.CharField(source="role.name", read_only=True, allow_null=True)
    # Write-only; required only on create (see `validate` below). Never
    # returned and never accepted on update — password change is a
    # self-service flow this story does not build. See `## Story Goal`.
    password = serializers.CharField(
        write_only=True, required=False, style={"input_type": "password"}
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "role",
            "role_name",
            "date_joined",
            "last_login",
            "password",
        )
        read_only_fields = ("id", "is_staff", "is_superuser", "date_joined", "last_login")

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        if self.instance is None and not attrs.get("password"):
            raise serializers.ValidationError({"password": [_("This field is required.")]})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        # `is_staff` is read-only on this serializer (never settable by the
        # caller) but must still default to `True` for a user created
        # through this "staff user administration" API — `create_user`
        # itself defaults `is_staff=False`, which would otherwise silently
        # produce an account unable to reach Django admin despite holding
        # whatever role/permissions were granted, unlike every other
        # account in this system (all seeded through a path that sets
        # `is_staff=True`). Not a way to grant raw Django-admin access
        # through this API — every account created here already needs
        # `is_staff=True` just to be a normal staff user in this app.
        return User.objects.create_user(password=password, is_staff=True, **validated_data)

    def update(self, instance, validated_data):
        # Silently ignored, not a 400: the edit form never renders this
        # field, so a stray "password" key only ever arrives from a
        # hand-crafted request, and rejecting it would tell such a caller
        # more than a normal validation error should.
        validated_data.pop("password", None)
        return super().update(instance, validated_data)


class AuditLogSerializer(BaseModelSerializer):
    """Read-only — `AuditLogViewSet` has no write action for this to ever
    validate. `actor_name` uses the same verified-safe dotted-`source`
    pattern as `TicketSerializer.assigned_agent_name`
    (apps/tickets/serializers.py:33-35): `get_full_name` is a method, not a
    field, and DRF's `get_attribute` calls it; `allow_null=True` returns
    `None` instead of erroring when `actor` is `None` (a deleted actor).
    `target_label` is the snapshot field, not a dotted source on
    `target_user`/`target_role` — see `AuditLog`'s own docstring for why the
    snapshot exists.
    """

    actor_name = serializers.CharField(
        source="actor.get_full_name", read_only=True, allow_null=True
    )
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta(BaseModelSerializer.Meta):
        model = AuditLog
        fields = (
            "id",
            "actor",
            "actor_name",
            "action",
            "action_display",
            "target_user",
            "target_role",
            "target_label",
            "from_value",
            "to_value",
            "created_at",
        )


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
