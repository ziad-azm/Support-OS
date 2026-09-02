from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.accounts.models import User
from apps.core.serializers import BaseModelSerializer

from .erp_sync import CUSTOMER_SYNCABLE_FIELDS, ORDER_SYNCABLE_FIELDS
from .models import ApiKey, ErpConnection, ErpOrder, ErpSyncRun


class ApiKeySerializer(serializers.ModelSerializer):
    """Read shape, and the `POST` input shape. Never exposes `hashed_key`
    — `prefix` is the only key material a client ever sees again.
    """

    user_email = serializers.CharField(source="user.email", read_only=True)

    class Meta:
        model = ApiKey
        fields = (
            "id",
            "name",
            "prefix",
            "user",
            "user_email",
            "is_active",
            "expires_at",
            "last_used_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("prefix", "is_active", "last_used_at", "created_at", "updated_at")

    def get_fields(self):
        fields = super().get_fields()
        # Active identities only. A key issued for an inactive user would
        # be rejected at authentication time anyway
        # (ApiKeyAuthentication.authenticate), so accepting one here would
        # only mint a credential that cannot work.
        fields["user"].queryset = User.objects.filter(is_active=True)
        return fields


class ApiKeyIssuedSerializer(ApiKeySerializer):
    """The `POST` response only. `key` is the plaintext, returned exactly
    once and unrecoverable afterward.
    """

    key = serializers.CharField(read_only=True)

    class Meta(ApiKeySerializer.Meta):
        fields = (*ApiKeySerializer.Meta.fields, "key")


class ApiKeyUpdateSerializer(serializers.ModelSerializer):
    """`PATCH` shape. `user` is deliberately absent: re-pointing a live
    credential at a different identity silently changes what every caller
    holding it may do. Issue a new key instead.
    """

    class Meta:
        model = ApiKey
        fields = ("name", "is_active", "expires_at")


class ErpConnectionSerializer(BaseModelSerializer):
    """Read/write over the one `ErpConnection` row.

    `auth_token` is `write_only`: the API never hands a stored credential
    back, the same posture INT-1's `ApiKeySerializer` takes for
    `hashed_key` (§ 29). `has_auth_token` is what the UI renders instead,
    so an operator can see whether one is configured without seeing it.

    An omitted-or-blank `auth_token` on `PATCH` leaves the stored value
    untouched (`update` below) — without that, saving any other field
    from a form that cannot display the current token would silently wipe
    it, and the next sync would start failing with a 401.

    `validate_customer_field_map`/`validate_order_field_map` mirror
    `ErpConnection.clean()` for the API path, because DRF does not call
    model `clean()` — the same split `OrganizationSettingsSerializer`/
    `OrganizationSettings.clean()` already establishes (§ 22).
    """

    auth_token = serializers.CharField(
        max_length=500, required=False, allow_blank=True, write_only=True
    )
    has_auth_token = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = ErpConnection
        fields = (
            "id",
            "enabled",
            "base_url",
            "auth_token",
            "has_auth_token",
            "export_enabled",
            "customer_field_map",
            "order_field_map",
            "customer_external_id_field",
            "order_external_id_field",
            "order_customer_ref_field",
            "last_sync_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (*BaseModelSerializer.Meta.read_only_fields, "last_sync_at")

    def get_has_auth_token(self, obj) -> bool:
        return bool(obj.auth_token)

    def _validate_field_map(self, value, allowed):
        if not isinstance(value, dict):
            raise serializers.ValidationError(_("Must be an object mapping ERP field to field."))
        for source, target in value.items():
            if not isinstance(source, str) or not source.strip():
                raise serializers.ValidationError(
                    _("Every ERP field name must be a non-empty string.")
                )
            if not isinstance(target, str) or not target.strip():
                raise serializers.ValidationError(
                    _("Every mapped field must be a non-empty string.")
                )
            if target not in allowed:
                raise serializers.ValidationError(
                    _("Cannot map to '%(target)s'. Allowed: %(allowed)s.")
                    % {"target": target, "allowed": ", ".join(sorted(allowed))}
                )
        return value

    def validate_customer_field_map(self, value):
        return self._validate_field_map(value, CUSTOMER_SYNCABLE_FIELDS)

    def validate_order_field_map(self, value):
        return self._validate_field_map(value, ORDER_SYNCABLE_FIELDS)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        enabled = attrs.get("enabled", getattr(self.instance, "enabled", False))
        base_url = attrs.get("base_url", getattr(self.instance, "base_url", ""))
        if enabled and not base_url:
            raise serializers.ValidationError(
                {"base_url": [_("A base URL is required to enable the connection.")]}
            )
        return attrs

    def update(self, instance, validated_data):
        # See this class's docstring: a blank token means "leave it".
        if not validated_data.get("auth_token"):
            validated_data.pop("auth_token", None)
        return super().update(instance, validated_data)


class ErpSyncRunSerializer(BaseModelSerializer):
    """Read-only history. `state_display`/`direction_display` come from
    Django's own `get_FOO_display()`, the same translated-label approach
    `AuditLogSerializer.action_display` (SEC-3) uses.
    """

    direction_display = serializers.CharField(source="get_direction_display", read_only=True)
    state_display = serializers.CharField(source="get_state_display", read_only=True)
    triggered_by_name = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = ErpSyncRun
        fields = (
            "id",
            "direction",
            "direction_display",
            "state",
            "state_display",
            "triggered_by_name",
            "created_count",
            "updated_count",
            "skipped_count",
            "failed_count",
            "started_at",
            "finished_at",
            "error_message",
            "created_at",
            "updated_at",
        )

    def get_triggered_by_name(self, obj) -> str | None:
        return obj.triggered_by.get_full_name() if obj.triggered_by else None


class ErpOrderSerializer(BaseModelSerializer):
    """Read-only. `raw` is deliberately excluded: it is the whole ERP
    payload, kept for an operator debugging a mapping through
    `/admin/` or a shell, and re-publishing it through the API would
    hand every reader whatever unmapped fields the ERP happens to
    include.
    """

    customer_name = serializers.CharField(source="customer.name", read_only=True)

    class Meta(BaseModelSerializer.Meta):
        model = ErpOrder
        fields = (
            "id",
            "customer",
            "customer_name",
            "external_id",
            "order_number",
            "status",
            "total_amount",
            "currency",
            "placed_at",
            "synced_at",
            "created_at",
            "updated_at",
        )
