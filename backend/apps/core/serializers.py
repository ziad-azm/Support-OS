from django.utils.translation import gettext_lazy as _
from rest_framework import serializers


class BaseModelSerializer(serializers.ModelSerializer):
    """Single inheritance point for every domain ModelSerializer.

    `TimeStampedModel` fields are server-managed, so they are read-only
    everywhere; declaring that once here keeps it out of every Meta block.

    Subclasses that define their own Meta must inherit this one for
    `read_only_fields` to apply:

        class CustomerSerializer(BaseModelSerializer):
            class Meta(BaseModelSerializer.Meta):
                model = Customer
                fields = ("id", "name", "created_at", "updated_at")
    """

    class Meta:
        read_only_fields = ("id", "created_at", "updated_at")

    # Field names that must be settable on create but never changed
    # afterward — e.g. the FK that scopes/owns the record (`Ticket.customer`,
    # `InternalNote.ticket`, `Message.ticket`). `read_only_fields` can't
    # express "writable on create, immutable on update" (it would also block
    # the field on create, breaking every "pick a customer/ticket" create
    # flow), so this is the shared way that exact shape is enforced whenever
    # a subclass needs it — opt-in, not applied unless a subclass sets it.
    immutable_fields: tuple[str, ...] = ()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is not None:
            for field in self.immutable_fields:
                if field in attrs and attrs[field] != getattr(self.instance, field):
                    raise serializers.ValidationError(
                        {field: [_("This field cannot be changed after creation.")]}
                    )
        return attrs
