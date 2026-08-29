from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import OrganizationSettings


class OrganizationSettingsSerializer(BaseModelSerializer):
    """Read/write over the one `OrganizationSettings` row. `validate_departments`/
    `validate_branches` mirror `OrganizationSettings.clean()`'s own list-of-
    strings check for the API path — DRF does not call model `clean()`, the
    same split `RoleAdminSerializer.validate_permissions`/`Role.clean()`
    already establishes (CONVENTIONS.md § 22).
    """

    class Meta(BaseModelSerializer.Meta):
        model = OrganizationSettings
        fields = (
            "id",
            "name",
            "logo_url",
            "departments",
            "branches",
            "default_response_target_minutes",
            "default_resolution_target_minutes",
            "created_at",
            "updated_at",
        )

    def _validate_string_list(self, value, field_name: str):
        if not isinstance(value, list):
            raise serializers.ValidationError(_("Must be a list of strings."))
        if any(not isinstance(item, str) or not item.strip() for item in value):
            raise serializers.ValidationError(_("Every entry must be a non-empty string."))
        return value

    def validate_departments(self, value):
        return self._validate_string_list(value, "departments")

    def validate_branches(self, value):
        return self._validate_string_list(value, "branches")

    def validate(self, attrs):
        response = attrs.get(
            "default_response_target_minutes",
            getattr(self.instance, "default_response_target_minutes", None),
        )
        resolution = attrs.get(
            "default_resolution_target_minutes",
            getattr(self.instance, "default_resolution_target_minutes", None),
        )
        if response is not None and resolution is not None and resolution < response:
            raise serializers.ValidationError(
                {
                    "default_resolution_target_minutes": [
                        _("Must be at least the default response target.")
                    ]
                }
            )
        return attrs
