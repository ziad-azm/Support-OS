from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.utils.translation import gettext_lazy as _

from apps.core.models import TimeStampedModel

# Exactly `#RRGGBB`. Anchored, case-insensitive. Three-digit shorthand,
# `rgb()`, and colour names are all rejected on purpose: this string is
# written straight into a CSS custom property and cached in localStorage,
# so one canonical form means the stored value, the cached value, and the
# painted value are the same seven characters. Mirrored on the frontend as
# `HEX_COLOR_RE` (src/shared/branding/config.ts).
HEX_COLOR_VALIDATOR = RegexValidator(
    regex=r"^#(?:[0-9a-fA-F]{6})$",
    message=_("Enter a colour as #RRGGBB."),
)


class Department(TimeStampedModel):
    """A functional unit — ORG-1. Agents (`accounts.User.department`) and
    tickets (`tickets.Ticket.department`) point at one; both FKs are
    nullable `SET_NULL`, so deleting a department leaves both intact and
    merely unassigned.

    Replaces `OrganizationSettings.departments`, the `JSONField` string
    list SEC-4 shipped as a deliberate placeholder — that field's own
    docstring named the condition for promoting it: "Nothing else in this
    codebase references an individual department or branch yet." This
    story is the story that makes something reference one.

    Shaped exactly like `tickets.Category` (apps/tickets/models.py:8-23):
    a unique name, alphabetical default ordering, `__str__` returning the
    name. `description` is the one addition — a department is an org-chart
    unit an admin may need to annotate ("Tier 2 escalations, EMEA hours"),
    which `Role.description` (apps/accounts/models.py:55) already
    establishes the shape for.

    `OrganizationSettings.branches` is deliberately NOT promoted here —
    ORG-2 does that, reusing this model and this story's migrations as its
    template.
    """

    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.CharField(_("description"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("department")
        verbose_name_plural = _("departments")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class Branch(TimeStampedModel):
    """A physical or regional location — ORG-2. Users
    (`accounts.User.branch`), customers (`customers.Customer.branch`), and
    tickets (`tickets.Ticket.branch`) point at one; all three FKs are
    nullable `SET_NULL`, so deleting a branch leaves every row intact and
    merely unassigned.

    Replaces `OrganizationSettings.branches`, the second and last
    `JSONField` string list SEC-4 shipped as a placeholder. ORG-1 promoted
    the `departments` half and left this one alone deliberately;
    CONVENTIONS.md §33 recorded the constraint that held until now ("no
    code may add a second consumer of that column").

    Shaped exactly like `Department` above, which is itself shaped like
    `tickets.Category` (apps/tickets/models.py:8-23). Three copies of the
    same four lines is the right answer here: a shared abstract base for
    "a named org unit" would couple `Department` and `Branch` migrations
    together for no behavioural gain, and they are free to diverge (a
    branch may later grow an address or a timezone; a department will not).
    """

    name = models.CharField(_("name"), max_length=100, unique=True)
    description = models.CharField(_("description"), max_length=255, blank=True)

    class Meta:
        verbose_name = _("branch")
        verbose_name_plural = _("branches")
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class OrganizationSettings(TimeStampedModel):
    """The one organization-wide settings record — SEC-4's "central
    configurable settings" backing branding, department/branch lists, and
    SLA defaults. A singleton: `load()` is the only supported way to get an
    instance, `save()` forces `pk=1`, and `delete()` is a no-op — the same
    "there is exactly one relevant row" shape `MeView`
    (apps/accounts/views.py:44-52) already established for a per-user
    singleton, generalized here to a per-deployment one. This is the first
    singleton model in this codebase; no third-party package (e.g.
    `django-solo`) is installed, so this is a small, self-contained
    implementation of the well-known "pk=1" pattern rather than a new
    dependency.

    `departments` and `branches` were both `JSONField(default=list)` string
    lists until ORG-1 (Story 87) and ORG-2 (Story 89) promoted them to the
    `Department` and `Branch` models above. This model now holds only
    scalars — branding (`name`, `logo_url`, `primary_color`) and the two
    org-wide SLA defaults. There is no JSON column left, which is why
    `clean()` no longer validates a list shape.

    `logo_url` is a plain URL, not an uploaded file — combining a file
    upload with this model's JSON list fields in one request would need an
    unprecedented parsing path in this codebase (see Story 53
    `## Prerequisites`).

    `primary_color` is read publicly through `BrandingView`, unlike every
    other field here: the login page and the public landing page have no
    session, and even a signed-in agent lacks `settings.manage`. That is
    why the public serializer is a separate, narrower class — see
    `serializers.py`.
    """

    name = models.CharField(_("organization name"), max_length=150, blank=True)
    logo_url = models.URLField(_("logo URL"), max_length=500, blank=True)
    # The brand's accent colour — ORG-3. Overrides the `--primary` design
    # token at runtime (src/shared/branding/), which `@theme inline` maps to
    # `--color-primary`, so every `bg-primary`/`text-primary` utility in the
    # app follows it with no class changes.
    #
    # Blank means "use the DSN default" (`#2563EB`, MASTER.md line 25), NOT
    # "no colour" — the frontend removes its inline override rather than
    # writing an empty value. See Story 90 `## Product rules`.
    #
    # No companion `primary_foreground_color`: the readable text colour is
    # DERIVED from this one by WCAG relative luminance
    # (src/shared/branding/contrast.ts). Storing it would let an admin
    # configure an illegible pair.
    primary_color = models.CharField(
        _("brand colour"),
        max_length=7,
        blank=True,
        validators=[HEX_COLOR_VALIDATOR],
    )
    # Mirrors `SLAPolicy.response_target_minutes`/`resolution_target_minutes`
    # (apps/sla/models.py) exactly, but nullable: unlike a configured
    # `SLAPolicy` row (which always has both), the org-wide default is
    # opt-in — an admin who never fills these in gets exactly today's
    # behaviour (`resolve_policy` falling through to `None`).
    default_response_target_minutes = models.PositiveIntegerField(
        _("default response target (minutes)"), null=True, blank=True
    )
    default_resolution_target_minutes = models.PositiveIntegerField(
        _("default resolution target (minutes)"), null=True, blank=True
    )
    # SEC-10. Each is independently nullable/opt-in — the same "blank means
    # no policy configured for this data class, do nothing" shape
    # `default_response_target_minutes` above already establishes. Consumed
    # only by `apps.compliance.tasks.run_data_retention` (never read by
    # this app itself) — see CONVENTIONS.md §33 for why these are four more
    # scalars here rather than a new model.
    retention_closed_tickets_days = models.PositiveIntegerField(
        _("closed ticket retention (days)"), null=True, blank=True
    )
    retention_messages_days = models.PositiveIntegerField(
        _("message retention (days)"), null=True, blank=True
    )
    retention_attachments_days = models.PositiveIntegerField(
        _("attachment retention (days)"), null=True, blank=True
    )
    retention_audit_log_days = models.PositiveIntegerField(
        _("audit log retention (days)"), null=True, blank=True
    )

    class Meta:
        verbose_name = _("organization settings")
        verbose_name_plural = _("organization settings")

    def __str__(self) -> str:
        return str(_("Organization settings"))

    def clean(self) -> None:
        """Guards the Django-admin form path — DRF does not call model
        `clean()`, so `OrganizationSettingsSerializer` repeats this logic
        for the API path, the same split `Role.clean()`/
        `RoleAdminSerializer.validate_permissions` already establishes
        (CONVENTIONS.md § 22).
        """
        super().clean()
        if (
            self.default_response_target_minutes is not None
            and self.default_resolution_target_minutes is not None
            and self.default_resolution_target_minutes < self.default_response_target_minutes
        ):
            raise ValidationError(
                {
                    "default_resolution_target_minutes": _(
                        "Must be at least the default response target."
                    )
                }
            )

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        # There is nothing sensible for "delete the organization's
        # settings" to mean — the row is recreated with defaults on the
        # next `load()` anyway. A silent no-op, not an exception.
        pass

    @classmethod
    def load(cls) -> "OrganizationSettings":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj


class LandingContent(TimeStampedModel):
    """The one editable-landing-copy record — LAND-2. A singleton on the
    exact `OrganizationSettings` mechanism above: `load()` is the only
    supported way in, `save()` forces `pk=1`, `delete()` is a no-op.

    A SECOND singleton rather than fourteen more columns on
    `OrganizationSettings`, deliberately. That model's own docstring says
    it "now holds only scalars — branding and the two org-wide SLA
    defaults", and `OrganizationSettingsSerializer` publishes all of them
    to `settings.manage` holders. Landing copy is public marketing text
    with a different audience, a different write cadence, and its own
    public read path; mixing it in would double that serializer's field
    list and put marketing strings behind the SLA-defaults form.

    EVERY STRING FIELD IS `blank=True`, AND BLANK IS MEANINGFUL: it means
    "render the string shipped in `frontend/src/features/landing/locales/`",
    never "render empty". The fallback itself lives on the frontend
    (`src/shared/landing/resolve.ts`) because the defaults are i18n
    resources — copying them into Python would create a second source of
    truth for the same sentence.

    Both locales are stored per string, mirroring
    `knowledge_base.Article.title_en/title_ar/body_en/body_ar`. An admin
    who fills in only English gets an English override and the shipped
    Arabic; the Arabic half never silently freezes.
    """

    class CtaTarget(models.TextChoices):
        """Where a landing CTA may point. A FIXED SET, not a URL field:
        every value here is a route that exists in `app/router.tsx`'s
        public tree, so an admin cannot aim the product's front door at a
        404, an authenticated route, or an off-site link. Same reasoning
        `LandingHighlight.Icon` below applies to icons.
        """

        LOGIN = "login", _("Log in")
        CONTACT = "contact", _("Contact form")
        CHAT = "chat", _("Live chat")

    hero_headline_en = models.CharField(_("hero headline (English)"), max_length=200, blank=True)
    hero_headline_ar = models.CharField(_("hero headline (Arabic)"), max_length=200, blank=True)
    hero_value_proposition_en = models.TextField(_("value proposition (English)"), blank=True)
    hero_value_proposition_ar = models.TextField(_("value proposition (Arabic)"), blank=True)

    # An absolute http(s) URL, NOT an upload — Story 96's own scope decision,
    # recorded in that plan's `## The hero image decision`. Short version:
    # an uploaded file could not be served to an anonymous visitor without
    # reversing the "No MEDIA_URL ... never through Django's own unguarded
    # static/media serving" stance `config/settings/base.py:170-174` records
    # for CUST-4, and the landing page has no session by definition.
    #
    # Not bilingual, unlike every string field around it: an image is not
    # translated copy. Blank means "render the text-only hero", which is what
    # every deployment gets until an admin sets one.
    #
    # `URLField` for the same reason `OrganizationSettings.logo_url` is one
    # (models.py:109-112). 500 matches that field's own max_length.
    hero_image_url = models.URLField(_("hero image URL"), max_length=500, blank=True)

    hero_primary_cta_label_en = models.CharField(
        _("primary CTA label (English)"), max_length=60, blank=True
    )
    hero_primary_cta_label_ar = models.CharField(
        _("primary CTA label (Arabic)"), max_length=60, blank=True
    )
    hero_primary_cta_target = models.CharField(
        _("primary CTA target"), max_length=20, choices=CtaTarget.choices, blank=True
    )
    hero_secondary_cta_label_en = models.CharField(
        _("secondary CTA label (English)"), max_length=60, blank=True
    )
    hero_secondary_cta_label_ar = models.CharField(
        _("secondary CTA label (Arabic)"), max_length=60, blank=True
    )
    hero_secondary_cta_target = models.CharField(
        _("secondary CTA target"), max_length=20, choices=CtaTarget.choices, blank=True
    )

    features_title_en = models.CharField(
        _("highlights section title (English)"), max_length=200, blank=True
    )
    features_title_ar = models.CharField(
        _("highlights section title (Arabic)"), max_length=200, blank=True
    )

    cta_title_en = models.CharField(_("CTA band title (English)"), max_length=200, blank=True)
    cta_title_ar = models.CharField(_("CTA band title (Arabic)"), max_length=200, blank=True)
    cta_subtitle_en = models.TextField(_("CTA band subtitle (English)"), blank=True)
    cta_subtitle_ar = models.TextField(_("CTA band subtitle (Arabic)"), blank=True)
    cta_label_en = models.CharField(_("CTA band button (English)"), max_length=60, blank=True)
    cta_label_ar = models.CharField(_("CTA band button (Arabic)"), max_length=60, blank=True)
    cta_target = models.CharField(
        _("CTA band target"), max_length=20, choices=CtaTarget.choices, blank=True
    )

    # `{{year}}` is substituted client-side by i18next's interpolation, the
    # same as the shipped `footer.copyright` default. An admin value with no
    # placeholder simply renders literally.
    footer_text_en = models.CharField(_("footer text (English)"), max_length=200, blank=True)
    footer_text_ar = models.CharField(_("footer text (Arabic)"), max_length=200, blank=True)

    class Meta:
        verbose_name = _("landing content")
        verbose_name_plural = _("landing content")

    def __str__(self) -> str:
        return str(_("Landing content"))

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs) -> None:
        # Same no-op as `OrganizationSettings.delete` — "delete the landing
        # copy" has no sensible meaning; blanking the fields is what reverts
        # to the shipped defaults.
        pass

    @classmethod
    def load(cls) -> "LandingContent":
        obj, _created = cls.objects.get_or_create(pk=1)
        return obj


class LandingHighlight(TimeStampedModel):
    """One feature-highlight card on the public landing page — LAND-2.

    A MODEL, NOT A `JSONField` LIST. CONVENTIONS.md § 33 records that ORG-1
    and ORG-2 promoted this codebase's last two JSON string-list columns to
    real models and that "a future story wanting a list of things on that
    model should create a model, not a column: that is now the established
    answer, twice over". This is that future story.

    Ordered exactly like `knowledge_base.FAQ`: a `PositiveIntegerField`
    edited as a plain number in the form, ties broken by `id` so the order
    is total and stable. No drag-and-drop.

    ZERO ROWS IS A REAL STATE and means "render the four cards shipped in
    `frontend/src/features/landing/locales/`" — the same blank-means-default
    rule `LandingContent` uses for its strings. A non-empty table replaces
    the shipped set entirely rather than appending to it; a half-merged list
    would make "delete this card" impossible to express.
    """

    class Icon(models.TextChoices):
        """The curated `lucide-react` set — DSN-4 standardized on that
        library (CONVENTIONS.md § 25) and this is the subset an admin may
        pick from. Each value is a `lucide-react` export name in kebab
        case, mapped to the actual component by
        `src/shared/landing/config.ts`'s `LANDING_ICONS`. A free-text name
        would let one typo blank a card on the product's front door.

        ADDING A VALUE IS A TWO-FILE CHANGE: this enum and `LANDING_ICONS`.
        The frontend map falls back to `inbox` for an unknown key so a
        backend-first deploy degrades instead of crashing.
        """

        INBOX = "inbox", _("Inbox")
        TIMER = "timer", _("Timer")
        SPARKLES = "sparkles", _("Sparkles")
        BAR_CHART = "bar-chart-3", _("Bar chart")
        MESSAGE_SQUARE = "message-square", _("Message")
        USERS = "users", _("People")
        SHIELD_CHECK = "shield-check", _("Shield")
        ZAP = "zap", _("Lightning")
        GLOBE = "globe", _("Globe")
        CLOCK = "clock", _("Clock")
        FILE_TEXT = "file-text", _("Document")
        BELL = "bell", _("Bell")

    title_en = models.CharField(_("title (English)"), max_length=120)
    title_ar = models.CharField(_("title (Arabic)"), max_length=120)
    description_en = models.TextField(_("description (English)"))
    description_ar = models.TextField(_("description (Arabic)"))
    icon = models.CharField(_("icon"), max_length=32, choices=Icon.choices, default=Icon.SPARKLES)
    order = models.PositiveIntegerField(_("order"), default=0)

    class Meta:
        verbose_name = _("landing highlight")
        verbose_name_plural = _("landing highlights")
        ordering = ("order", "id")

    def __str__(self) -> str:
        return self.title_en


# A dialable number: an optional leading `+`, then 7-20 digits. Spaces,
# dashes, parentheses and dots are stripped by the serializer BEFORE this
# runs, so the stored value is canonical and `tel:`/`wa.me` hrefs can be
# built from it without re-parsing on the frontend. Deliberately not a full
# E.164 validator — no phone-number library is installed and adding one for
# a footer link is not warranted (CONVENTIONS.md § 17).
PHONE_VALIDATOR = RegexValidator(
    regex=r"^\+?\d{7,20}$",
    message=_("Enter a phone number as digits, optionally starting with +."),
)


class LandingSocialLink(TimeStampedModel):
    """One social or contact link in the public site's footer — LAND-3.

    A MODEL, NOT A `JSONField` LIST, and not more columns on
    `LandingContent`: the same call CONVENTIONS.md § 33 records twice over
    (ORG-1 and ORG-2 promoting this codebase's last two JSON string lists),
    and the same call `LandingHighlight` above already makes for the other
    ordered list on this page.

    SHAPED AFTER `customers.ContactDetail`, not invented: a `Platform`
    choice set plus ONE generic `value` column, because a profile URL, an
    email address and a phone number are all "a string with a length cap"
    at the model layer. Per-platform format validation is the SERIALIZER's
    job for the same reason that model records — DRF does not call model
    `clean()` — so this model deliberately has none either.

    NOT related to `customers.ContactDetail` by FK or inheritance. That
    model is per-customer CRM data; this is the organization's own public
    presence. Identical shape, different table, different audience.

    `is_enabled` is a real column rather than "delete the row to hide it":
    an admin taking a channel down for a week should not have to retype the
    URL to bring it back. Disabled rows never reach the public serializer —
    see `PublicLandingContentSerializer.get_social_links`.
    """

    class Platform(models.TextChoices):
        """The fixed set an admin may pick from — LAND-3's own constraint,
        and the reason there is no free-text icon or label column.

        `lucide-react` HAS NO BRAND ICONS (verified against 1.34.0: all
        6098 exports, no Facebook/X/Instagram/LinkedIn/YouTube/GitHub), so
        the first eight of these render inline SVG brand paths from
        `src/shared/landing/socialIcons.tsx` while the last four use real
        lucide marks. See Story 95 `## The icon decision`.

        ADDING A VALUE IS A TWO-FILE CHANGE: this enum and
        `SOCIAL_PLATFORMS` in `src/shared/landing/social.ts`. The frontend
        skips a platform it does not know rather than rendering a nameless
        link, so a backend-first deploy degrades quietly.
        """

        FACEBOOK = "facebook", _("Facebook")
        X = "x", _("X")
        INSTAGRAM = "instagram", _("Instagram")
        LINKEDIN = "linkedin", _("LinkedIn")
        YOUTUBE = "youtube", _("YouTube")
        TIKTOK = "tiktok", _("TikTok")
        GITHUB = "github", _("GitHub")
        WEBSITE = "website", _("Website")
        EMAIL = "email", _("Email")
        PHONE = "phone", _("Phone")
        WHATSAPP = "whatsapp", _("WhatsApp")

    platform = models.CharField(_("platform"), max_length=20, choices=Platform.choices)
    # One column for every platform's value — see the class docstring. 254
    # matches `customers.ContactDetail.value` (the RFC-5321 email ceiling),
    # which is comfortably above any real profile URL.
    value = models.CharField(_("value"), max_length=254)
    is_enabled = models.BooleanField(_("enabled"), default=True)
    order = models.PositiveIntegerField(_("order"), default=0)

    class Meta:
        verbose_name = _("landing social link")
        verbose_name_plural = _("landing social links")
        # `LandingHighlight`'s ordering exactly: a manual number, ties
        # broken by `id` so the order is total and stable.
        ordering = ("order", "id")
        constraints = [
            # One row per platform. Two "Facebook" links in a footer is a
            # mistake every time, and the admin form surfaces this as a
            # field error rather than a 500 — DRF derives a
            # `UniqueTogetherValidator` from this automatically, the same
            # way `ContactDetail`'s own constraint does (see Story 11).
            models.UniqueConstraint(fields=["platform"], name="unique_landing_social_platform"),
        ]

    def __str__(self) -> str:
        return f"{self.get_platform_display()}: {self.value}"
