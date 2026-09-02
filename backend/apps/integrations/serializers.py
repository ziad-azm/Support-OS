from rest_framework import serializers

from apps.accounts.models import User

from .models import ApiKey


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
