from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator, validate_email
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.core.serializers import BaseModelSerializer

from .models import (
    PHONE_VALIDATOR,
    Branch,
    BusinessCalendar,
    Department,
    Holiday,
    LandingContent,
    LandingHighlight,
    LandingSocialLink,
    OrganizationSettings,
    WorkingWindow,
)


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

    `calendar_name` mirrors `TicketSerializer.category_name`'s verified
    dotted-source + `allow_null=True` pattern — SLA-5 (Story 111).
    """

    calendar_name = serializers.CharField(source="calendar.name", read_only=True, allow_null=True)

    class Meta(BaseModelSerializer.Meta):
        model = Branch
        fields = (
            "id",
            "name",
            "description",
            "calendar",
            "calendar_name",
            "created_at",
            "updated_at",
        )


class CalendarSerializer(BaseModelSerializer):
    """CRUD over `BusinessCalendar` — SLA-5's management screen. Shaped
    exactly like `BranchSerializer` above.
    """

    class Meta(BaseModelSerializer.Meta):
        model = BusinessCalendar
        fields = ("id", "name", "description", "created_at", "updated_at")


class WorkingWindowSerializer(BaseModelSerializer):
    """CRUD over one `WorkingWindow`, scoped by `calendar` — the exact
    `ContactDetailSerializer` shape (apps/customers/serializers.py).
    `(calendar, weekday)`'s `UniqueConstraint` auto-derives a
    `UniqueTogetherValidator`, the same verified-safe DRF behaviour
    `ContactDetailSerializer`'s own docstring records.
    """

    class Meta(BaseModelSerializer.Meta):
        model = WorkingWindow
        fields = ("id", "calendar", "weekday", "start_time", "end_time", "created_at", "updated_at")

    def validate(self, attrs):
        """DRF never calls model `clean()` — the same gap
        `ContactDetailSerializer.validate` fills for its own model.
        `start_time`/`end_time` fall back to the existing instance's
        values on a PATCH that sends only one of the pair.
        """
        start_time = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end_time = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start_time is not None and end_time is not None and end_time <= start_time:
            raise serializers.ValidationError({"end_time": _("End time must be after start time.")})
        return attrs


class HolidaySerializer(BaseModelSerializer):
    """CRUD over one `Holiday`, scoped by `calendar` — the exact
    `ContactDetailSerializer` shape. `(calendar, date)`'s
    `UniqueConstraint` auto-derives its own `UniqueTogetherValidator`.
    """

    class Meta(BaseModelSerializer.Meta):
        model = Holiday
        fields = ("id", "calendar", "date", "label", "created_at", "updated_at")


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
            "retention_closed_tickets_days",
            "retention_messages_days",
            "retention_attachments_days",
            "retention_audit_log_days",
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


_PHONE_PLATFORMS = (LandingSocialLink.Platform.PHONE, LandingSocialLink.Platform.WHATSAPP)

# Everything a human types into a phone field and no dialer wants back.
_PHONE_NOISE = str.maketrans("", "", " -().")


def _normalize_phone(value: str) -> str:
    return value.translate(_PHONE_NOISE)


def _run_validator(validator, value) -> None:
    """Run a Django validator and re-raise as a DRF field error on `value`.
    The exact `except … from exc` shape `ContactDetailSerializer.validate`
    already uses (apps/customers/serializers.py:127-131).
    """
    try:
        validator(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({"value": list(exc.messages)}) from exc


class LandingSocialLinkSerializer(BaseModelSerializer):
    """CRUD over one social/contact link — LAND-3's admin list.

    `validate` is where per-platform format enforcement lives, copied from
    `customers.ContactDetailSerializer.validate` (apps/customers/
    serializers.py:116-132) including its PATCH-safe `getattr(self.instance,
    …)` fallback: a partial update that sends only `value` still validates
    it against the stored `platform`.
    """

    class Meta(BaseModelSerializer.Meta):
        model = LandingSocialLink
        fields = ("id", "platform", "value", "is_enabled", "order", "created_at", "updated_at")

    def validate(self, attrs):
        platform = attrs.get("platform", getattr(self.instance, "platform", None))
        value = attrs.get("value", getattr(self.instance, "value", None))
        if not value:
            return attrs

        if platform in _PHONE_PLATFORMS:
            # Normalize BEFORE validating, so an admin may paste
            # "+966 55 123 4567" and the stored value is "+966551234567" —
            # which is what `tel:` and `wa.me/` both need, and neither
            # frontend nor a second parse has to strip anything.
            value = _normalize_phone(value)
            attrs["value"] = value
            _run_validator(PHONE_VALIDATOR, value)
        elif platform == LandingSocialLink.Platform.EMAIL:
            _run_validator(validate_email, value)
        else:
            # Every remaining platform is a profile URL.
            _run_validator(URLValidator(schemes=["http", "https"]), value)
        return attrs


class PublicLandingSocialLinkSerializer(serializers.ModelSerializer):
    """The public half of a social link. Not `BaseModelSerializer` — the
    timestamps that base exists for are not part of a public payload, the
    same call `BrandingSerializer` and `PublicLandingHighlightSerializer`
    both make.

    NO `is_enabled`: a disabled row never reaches this serializer at all
    (`get_social_links` filters the queryset), so publishing the flag would
    describe a state the payload can never be in.
    """

    class Meta:
        model = LandingSocialLink
        fields = ("id", "platform", "value", "order")


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

    `highlights` and `social_links` are nested read-only lists because the
    landing page needs one request, not two or three. They are written
    through `LandingHighlightViewSet` and `LandingSocialLinkViewSet`,
    never here.
    """

    highlights = serializers.SerializerMethodField()
    social_links = serializers.SerializerMethodField()

    class Meta:
        model = LandingContent
        # The last TWO entries (`highlights`, `social_links`) are read-only
        # nested lists written through their own viewsets, and
        # `LandingContentAdminSerializer` below slices both off with
        # `[:-2]`. Keep them last, and keep that slice in step — Story 95
        # widened it from `[:-1]`. Deriving one serializer's `Meta.fields`
        # from another is an established shape here — `PortalTicketSerializer`
        # does the same with `TicketSerializer` (CONVENTIONS.md §33).
        fields = (
            "hero_headline_en",
            "hero_headline_ar",
            "hero_value_proposition_en",
            "hero_value_proposition_ar",
            "hero_image_url",
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
            "social_links",
        )

    def get_highlights(self, obj) -> list:
        # `LandingHighlight` has no FK to `LandingContent` — there is exactly
        # one of the latter, so a FK would add a join and a nullable column
        # to express "always 1". `Meta.ordering` supplies the sort.
        return PublicLandingHighlightSerializer(LandingHighlight.objects.all(), many=True).data

    def get_social_links(self, obj) -> list:
        # ENABLED ONLY, and filtered in the QUERYSET rather than hidden on
        # the frontend: a channel an admin switched off must not appear in
        # the page source at all. `Meta.ordering` supplies the sort.
        return PublicLandingSocialLinkSerializer(
            LandingSocialLink.objects.filter(is_enabled=True), many=True
        ).data


class LandingContentAdminSerializer(BaseModelSerializer):
    """Read/write over the one `LandingContent` row, under
    `settings.manage`. Carries the timestamps `PublicLandingContentSerializer`
    omits and neither nested list — the editor loads and writes those
    through `/api/landing-highlights/` and `/api/landing-social-links/`.
    """

    class Meta(BaseModelSerializer.Meta):
        model = LandingContent
        # `[:-2]` strips the trailing `"highlights"` and `"social_links"`
        # entries, both read-only and both living on their own endpoints.
        # Everything else is written here.
        fields = (
            ("id",) + PublicLandingContentSerializer.Meta.fields[:-2] + ("created_at", "updated_at")
        )
