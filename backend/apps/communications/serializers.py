from apps.core.serializers import BaseModelSerializer

from .models import Message


class MessageSerializer(BaseModelSerializer):
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
