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
