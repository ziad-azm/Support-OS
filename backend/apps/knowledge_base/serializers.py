from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import FAQ, Article, Category


class FAQSerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = FAQ
        fields = ("id", "question", "answer", "order", "created_at", "updated_at")


class CategorySerializer(BaseModelSerializer):
    class Meta(BaseModelSerializer.Meta):
        model = Category
        fields = ("id", "name", "color", "created_at", "updated_at")


class ArticleSerializer(BaseModelSerializer):
    # Same verified-safe dotted-source pattern as `TicketSerializer.category_name`
    # (Story 18) — `allow_null=True` is what makes this return `None` instead
    # of erroring when `category` is unset.
    category_name = serializers.CharField(source="category.name", read_only=True, allow_null=True)
    category_color = serializers.CharField(source="category.color", read_only=True, allow_null=True)

    class Meta(BaseModelSerializer.Meta):
        model = Article
        fields = (
            "id",
            "title_en",
            "title_ar",
            "body_en",
            "body_ar",
            "category",
            "category_name",
            "category_color",
            "status",
            "created_at",
            "updated_at",
        )
