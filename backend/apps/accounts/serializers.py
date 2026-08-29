from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.permissions import permissions_for
from apps.core.serializers import BaseModelSerializer

from .models import Role

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("slug", "name")


class RoleAdminSerializer(BaseModelSerializer):
    """CRUD over `Role` for SEC-1's admin screen. `permissions` and
    `is_system` stay read-only — editing the permission bundle is SEC-2
    (CONVENTIONS.md §22); `RoleAdmin`'s raw JSON textarea remains the only
    write path for `permissions` until then.
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
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + (
            "permissions",
            "is_system",
        )

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
        return User.objects.create_user(password=password, **validated_data)

    def update(self, instance, validated_data):
        # Silently ignored, not a 400: the edit form never renders this
        # field, so a stray "password" key only ever arrives from a
        # hand-crafted request, and rejecting it would tell such a caller
        # more than a normal validation error should.
        validated_data.pop("password", None)
        return super().update(instance, validated_data)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
