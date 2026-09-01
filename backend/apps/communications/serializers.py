from apps.core.serializers import BaseModelSerializer

from .models import Message


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
