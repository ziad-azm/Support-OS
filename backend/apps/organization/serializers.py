from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Branch, Department, OrganizationSettings


class DepartmentSerializer(BaseModelSerializer):
    """CRUD over `Department` — ORG-1's management screen. Shaped exactly
    like `CategorySerializer` (apps/tickets/serializers.py:7-11): the model
    field's own `unique=True` is what DRF derives the uniqueness validator
    from, so no hand-declared `UniqueValidator` is needed here (contrast
    `CustomerSerializer.email`, which overrides the generated field and
    therefore must declare one — apps/customers/serializers.py:36-43).
    """

    class Meta(BaseModelSerializer.Meta):
        model = Department
        fields = ("id", "name", "description", "created_at", "updated_at")


class BranchSerializer(BaseModelSerializer):
    """CRUD over `Branch` — ORG-2's management screen. Shaped exactly like
    `DepartmentSerializer` above: the model field's own `unique=True` is
    what DRF derives the uniqueness validator from, so no hand-declared
    `UniqueValidator` is needed (contrast `CustomerSerializer.email`, which
    overrides the generated field and therefore must declare one —
    apps/customers/serializers.py:36-43).
    """

    class Meta(BaseModelSerializer.Meta):
        model = Branch
        fields = ("id", "name", "description", "created_at", "updated_at")


class OrganizationSettingsSerializer(BaseModelSerializer):
    """Read/write over the one `OrganizationSettings` row.

    Branding (`name`, `logo_url`) and the two org-wide SLA defaults, and
    nothing else — the `departments` and `branches` JSON string lists this
    serializer used to validate became the `Department` (ORG-1) and
    `Branch` (ORG-2) models, each with its own viewset, so both
    `validate_departments`/`validate_branches` and the `_validate_string_list`
    helper they shared are gone.

    `validate` below still mirrors `OrganizationSettings.clean()`'s own SLA
    target comparison for the API path — DRF does not call model `clean()`,
    the same split `RoleAdminSerializer.validate_permissions`/`Role.clean()`
    already establishes (CONVENTIONS.md § 22).
    """

    class Meta(BaseModelSerializer.Meta):
        model = OrganizationSettings
        fields = (
            "id",
            "name",
            "logo_url",
            "default_response_target_minutes",
            "default_resolution_target_minutes",
            "created_at",
            "updated_at",
        )

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
