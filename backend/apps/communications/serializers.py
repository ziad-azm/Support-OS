from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import EmailProviderConfig, Message, SmsProviderConfig, WhatsAppProviderConfig


class MessageSerializer(BaseModelSerializer):
    # `ticket` must stay writable on create (the reply's target ticket,
    # chosen from the ticket detail page's reply form) but must never
    # change afterward — a PATCH that moves `ticket` silently relocates a
    # reply into a different ticket's conversation. See `BaseModelSerializer`.
    immutable_fields = ("ticket",)

    class Meta(BaseModelSerializer.Meta):
        model = Message
        fields = (
            "id",
            "ticket",
            "direction",
            "channel",
            "body",
            "metadata",
            "created_at",
            "updated_at",
        )
        # `metadata` is adapter-only data no UI ever sets — read-only via the
        # API. Verified this tuple-concatenation shape works (`## Prerequisites`).
        read_only_fields = BaseModelSerializer.Meta.read_only_fields + ("metadata",)


class EmailProviderConfigSerializer(BaseModelSerializer):
    """Read/write over the one `EmailProviderConfig` row. `host_password`
    is `write_only`, the same posture `ErpConnectionSerializer.auth_token`
    (Story 81) takes; `has_host_password` is what the UI renders instead.
    A blank/omitted `host_password` on `PATCH` leaves the stored value
    untouched (`update` below) — without that, saving any other field
    from a form that cannot display the current password would silently
    wipe it, and the next ticket-reply email would start failing.
    """

    host_password = serializers.CharField(
        max_length=255, required=False, allow_blank=True, write_only=True
    )
    has_host_password = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = EmailProviderConfig
        fields = (
            "id",
            "host",
            "port",
            "host_user",
            "host_password",
            "has_host_password",
            "use_tls",
            "default_from_email",
            "created_at",
            "updated_at",
        )

    def get_has_host_password(self, obj) -> bool:
        return bool(obj.host_password)

    def update(self, instance, validated_data):
        if not validated_data.get("host_password"):
            validated_data.pop("host_password", None)
        return super().update(instance, validated_data)


class WhatsAppProviderConfigSerializer(BaseModelSerializer):
    """Read/write over the one `WhatsAppProviderConfig` row. Same
    write-only-credential contract as `EmailProviderConfigSerializer`
    above, applied to `access_token`.
    """

    access_token = serializers.CharField(
        max_length=500, required=False, allow_blank=True, write_only=True
    )
    has_access_token = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = WhatsAppProviderConfig
        fields = (
            "id",
            "api_base_url",
            "phone_number_id",
            "access_token",
            "has_access_token",
            "created_at",
            "updated_at",
        )

    def get_has_access_token(self, obj) -> bool:
        return bool(obj.access_token)

    def update(self, instance, validated_data):
        if not validated_data.get("access_token"):
            validated_data.pop("access_token", None)
        return super().update(instance, validated_data)


class SmsProviderConfigSerializer(BaseModelSerializer):
    """Read/write over the one `SmsProviderConfig` row. Same
    write-only-credential contract, applied to `auth_token` — the same
    field `SMSInboundWebhookView` now also reads (Story 82
    `## Prerequisites`), so a value saved here takes effect for both
    outbound sending and inbound signature verification at once.
    """

    auth_token = serializers.CharField(
        max_length=500, required=False, allow_blank=True, write_only=True
    )
    has_auth_token = serializers.SerializerMethodField()

    class Meta(BaseModelSerializer.Meta):
        model = SmsProviderConfig
        fields = (
            "id",
            "api_base_url",
            "account_sid",
            "auth_token",
            "has_auth_token",
            "from_number",
            "created_at",
            "updated_at",
        )

    def get_has_auth_token(self, obj) -> bool:
        return bool(obj.auth_token)

    def update(self, instance, validated_data):
        if not validated_data.get("auth_token"):
            validated_data.pop("auth_token", None)
        return super().update(instance, validated_data)
