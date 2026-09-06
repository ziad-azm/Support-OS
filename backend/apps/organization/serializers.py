from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import Branch, Department, LandingContent, LandingHighlight, OrganizationSettings


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


class BrandingSerializer(serializers.ModelSerializer):
    """The public face of `OrganizationSettings` — ORG-3.

    THREE FIELDS, DELIBERATELY. This is served to anonymous callers
    (`BrandingView`), so it is a separate class rather than a subclass of
    `OrganizationSettingsSerializer` below: that one carries
    `default_response_target_minutes`/`default_resolution_target_minutes`,
    and inheriting from it would publish the organisation's SLA policy to
    the internet the next time someone added a field to it. A narrow
    hand-listed tuple is the whole safety mechanism here.

    Not `BaseModelSerializer`: the timestamps that base exists for are not
    part of a branding payload either.

    Read-only by construction — `BrandingView` defines no write verb, and
    branding is written through `PATCH /api/settings/` under
    `settings.manage`. Narrow-public-mirror of a wider internal serializer,
    the same shape `accounts.DepartmentBriefSerializer`/
    `BranchBriefSerializer` use for `/auth/me/`.
    """

    class Meta:
        model = OrganizationSettings
        fields = ("name", "logo_url", "primary_color")


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
            "primary_color",
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


class LandingHighlightSerializer(BaseModelSerializer):
    """CRUD over one highlight card — LAND-2's admin list. Shaped like
    `DepartmentSerializer` above; `icon` and `order` are the two additions,
    and `icon`'s validation is DRF's own generated `ChoiceField` from the
    model's `choices` — no hand-written validator.
    """

    class Meta(BaseModelSerializer.Meta):
        model = LandingHighlight
        fields = (
            "id",
            "title_en",
            "title_ar",
            "description_en",
            "description_ar",
            "icon",
            "order",
            "created_at",
            "updated_at",
        )


class PublicLandingHighlightSerializer(serializers.ModelSerializer):
    """The public half of a highlight — no timestamps. Not
    `BaseModelSerializer` for the same reason `BrandingSerializer` above is
    not: the timestamps that base exists for are not part of a public
    payload either. `id` stays because the frontend needs a React key.
    """

    class Meta:
        model = LandingHighlight
        fields = ("id", "title_en", "title_ar", "description_en", "description_ar", "icon", "order")


class PublicLandingContentSerializer(serializers.ModelSerializer):
    """The public face of `LandingContent` — LAND-2, served to anonymous
    callers by `LandingContentView`.

    A SEPARATE, NARROWER CLASS, exactly like `BrandingSerializer` above and
    for the same reason: a hand-listed `fields` tuple is the whole safety
    mechanism. It deliberately does NOT subclass
    `LandingContentAdminSerializer` below — inheriting would publish
    whatever that one grows next.

    Right now the two field sets happen to be identical minus the
    timestamps, because every landing field IS public by design. That is a
    coincidence of today's schema, not a reason to collapse them: the
    moment someone adds an internal note or a scheduled-publish date to
    `LandingContent`, this class is the thing that keeps it off the
    internet.

    `highlights` is a nested read-only list because the landing page needs
    one request, not two. It is written through `LandingHighlightViewSet`,
    never here.
    """

    highlights = serializers.SerializerMethodField()

    class Meta:
        model = LandingContent
        # `highlights` MUST stay last: `LandingContentAdminSerializer` below
        # derives its own field list from this tuple by slicing that entry
        # off. Deriving one serializer's `Meta.fields` from another is an
        # established shape here — `PortalTicketSerializer` does the same
        # with `TicketSerializer` (CONVENTIONS.md §33).
        fields = (
            "hero_headline_en",
            "hero_headline_ar",
            "hero_value_proposition_en",
            "hero_value_proposition_ar",
            "hero_primary_cta_label_en",
            "hero_primary_cta_label_ar",
            "hero_primary_cta_target",
            "hero_secondary_cta_label_en",
            "hero_secondary_cta_label_ar",
            "hero_secondary_cta_target",
            "features_title_en",
            "features_title_ar",
            "cta_title_en",
            "cta_title_ar",
            "cta_subtitle_en",
            "cta_subtitle_ar",
            "cta_label_en",
            "cta_label_ar",
            "cta_target",
            "footer_text_en",
            "footer_text_ar",
            "highlights",
        )

    def get_highlights(self, obj) -> list:
        # `LandingHighlight` has no FK to `LandingContent` — there is exactly
        # one of the latter, so a FK would add a join and a nullable column
        # to express "always 1". `Meta.ordering` supplies the sort.
        return PublicLandingHighlightSerializer(LandingHighlight.objects.all(), many=True).data


class LandingContentAdminSerializer(BaseModelSerializer):
    """Read/write over the one `LandingContent` row, under
    `settings.manage`. Carries the timestamps `PublicLandingContentSerializer`
    omits and no nested highlights — the editor loads those from
    `/api/landing-highlights/`, which is also where it writes them.
    """

    class Meta(BaseModelSerializer.Meta):
        model = LandingContent
        # `[:-1]` strips the trailing `"highlights"` entry, which is
        # read-only and lives on its own endpoint for this serializer's
        # callers. Everything else is written here.
        fields = (
            ("id",) + PublicLandingContentSerializer.Meta.fields[:-1] + ("created_at", "updated_at")
        )
