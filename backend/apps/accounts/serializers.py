import logging

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.permissions import ALL_PERMISSIONS, permissions_for
from apps.core.serializers import BaseModelSerializer

from .models import AuditLog, Role
from .tasks import send_password_reset_email
from .tokens import (
    RESET_SALT,
    RESET_TOKEN_MAX_AGE_SECONDS,
    password_fingerprint,
    read_password_token,
)

User = get_user_model()
logger = logging.getLogger(__name__)


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

    No `password` field — SEC-5 replaced the admin-supplied password with
    an emailed invite link (`InviteConfirmSerializer` below). `create()`
    always produces an unusable password and an inactive account; the
    account becomes usable only through a successful invite confirm.
    """

    # Same dotted-source pattern as `TicketSerializer.category_name`
    # (apps/tickets/serializers.py:26) — `allow_null=True` because `role`
    # itself is nullable. `role` needs no explicit declaration: DRF derives
    # `required=False, allow_null=True` from the model FK's own
    # `null=True, blank=True`, the same verified derivation
    # `TicketSerializer.category` relies on.
    role_name = serializers.CharField(source="role.name", read_only=True, allow_null=True)

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
        )
        read_only_fields = ("id", "is_staff", "is_superuser", "date_joined", "last_login")

    def create(self, validated_data):
        # `is_staff` is read-only on this serializer (never settable by the
        # caller) but must still default to `True` for a user created
        # through this "staff user administration" API — `create_user`
        # itself defaults `is_staff=False`, which would otherwise silently
        # produce an account unable to reach Django admin despite holding
        # whatever role/permissions were granted. Unchanged reasoning from
        # SEC-1.
        #
        # `password=None` makes `create_user` call `set_password(None)`,
        # which Django's own `AbstractBaseUser.set_password` turns into
        # `set_unusable_password()` — no `check_password` call can ever
        # succeed against this account until `InviteConfirmSerializer.save`
        # sets a real one.
        #
        # `is_active` is forced to `False` regardless of whatever the
        # caller sent — the field stays writable for `update()`, so an
        # already-active user can still be deactivated normally, but there
        # is no "create an already-active staff account" path left through
        # this API. See `## Story Goal`.
        validated_data["is_active"] = False
        return User.objects.create_user(password=None, is_staff=True, **validated_data)


class InviteConfirmSerializer(serializers.Serializer):
    """SEC-5's invite-confirm step. Exchanges a signed, time-limited token
    (`apps.accounts.tokens.read_password_token`) for a real password,
    activating the account `UserAdminSerializer.create` left pending.

    Deliberately checks `not user.has_usable_password()` in `validate`, not
    just `is_active=False` alone — a still-cryptographically-valid invite
    token sitting in an old inbox must not be replayable to reactivate an
    account an admin deactivated for cause *after* the original invite was
    already used. `has_usable_password()` only ever flips back to `True`
    through this endpoint (the sole caller of `set_password` for a pending
    account), so once an invite is consumed once, the same token can never
    succeed again regardless of any later `is_active` change. See
    `## Edge Cases`.
    """

    token = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        user_id = read_password_token(attrs["token"])
        user = User.objects.filter(pk=user_id, is_active=False).first() if user_id else None
        if user is None or user.has_usable_password():
            raise serializers.ValidationError(
                {"token": [_("This invite link is invalid or has expired.")]}
            )
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.is_active = True
        user.save(update_fields=["password", "is_active"])
        return user


class PasswordResetRequestSerializer(serializers.Serializer):
    """SEC-7's "forgot password" request step. Deliberately reveals
    nothing about whether `email` belongs to a real, active account:
    `save()` is a silent no-op for a non-existent, inactive, or
    already-unusable-password email — `PasswordResetRequestView` returns
    the identical `200` in every case, whatever `save()` did or didn't do.
    """

    email = serializers.EmailField()

    def save(self, **kwargs):
        # Exact-match `email=`, not `iexact` — deliberately matching
        # Django's own `ModelBackend`/`get_by_natural_key` login lookup,
        # which is already case-sensitive on the stored value. Making
        # only this endpoint case-insensitive would let a mis-cased email
        # request (and complete) a reset for an account it still couldn't
        # log into afterward — a worse inconsistency than staying
        # case-sensitive throughout.
        user = User.objects.filter(email=self.validated_data["email"], is_active=True).first()
        if user is None or not user.has_usable_password():
            return
        try:
            send_password_reset_email.delay(user.id)
        except Exception:
            logger.exception("Failed to queue password-reset email for user %s", user.id)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """SEC-7's reset-confirm step — the forgot-password counterpart to
    `InviteConfirmSerializer`, above, with the precondition flipped: this
    only ever accepts an ALREADY-active account (`is_active=True`), never
    a pending one, and checks `password_fingerprint` equality instead of
    `has_usable_password()` for single-use — see `apps.accounts.tokens`'s
    own module docstring for why an active account needs a different
    single-use mechanism than a pending one.
    """

    token = serializers.CharField(write_only=True)
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate(self, attrs):
        payload = read_password_token(
            attrs["token"], salt=RESET_SALT, max_age=RESET_TOKEN_MAX_AGE_SECONDS
        )
        user = None
        if isinstance(payload, list) and len(payload) == 2:
            user_id, fingerprint = payload
            candidate = User.objects.filter(pk=user_id, is_active=True).first()
            if candidate is not None and password_fingerprint(candidate) == fingerprint:
                user = candidate
        if user is None:
            raise serializers.ValidationError(
                {"token": [_("This reset link is invalid or has expired.")]}
            )
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        user = self.validated_data["user"]
        user.set_password(self.validated_data["password"])
        user.save(update_fields=["password"])
        return user


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
