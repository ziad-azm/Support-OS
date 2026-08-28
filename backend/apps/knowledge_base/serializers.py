from apps.core.serializers import BaseModelSerializer

from .models import FAQ


class FAQSerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = FAQ
        fields = ("id", "question", "answer", "order", "created_at", "updated_at")
