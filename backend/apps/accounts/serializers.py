from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.core.permissions import permissions_for

from .models import Role

User = get_user_model()


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("slug", "name")


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


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()
