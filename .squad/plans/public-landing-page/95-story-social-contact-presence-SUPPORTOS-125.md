# Story 95 — Social Media & Contact Presence (Story: SUPPORTOS-125)

## Prerequisites

- **Story 94 completed and implemented:** [94-story-editable-landing-content-SUPPORTOS-124.md](94-story-editable-landing-content-SUPPORTOS-124.md). Verified landed in the working tree: `LandingContent` and `LandingHighlight` (`backend/apps/organization/models.py:196-366`), `PublicLandingContentSerializer` / `LandingContentAdminSerializer` / `LandingHighlightSerializer` (`backend/apps/organization/serializers.py:112-227`), `LandingContentView` / `LandingContentAdminView` / `LandingHighlightViewSet` (`backend/apps/organization/views.py:135-224`), migration `0012_landing_content`, and the whole `frontend/src/shared/landing/` module. **This story extends every one of those rather than adding a parallel path.**
- **Story 86 completed:** [86-story-animated-public-landing-page-SUPPORTOS-120.md](86-story-animated-public-landing-page-SUPPORTOS-120.md). The `/` public tree, `PublicLayout variant="full"`, and the `landing` i18n namespace.
- **Story 19 (`WEB-1`) completed:** [../communication-channels/19-story-web-forms-SUPPORTOS-43.md](../communication-channels/19-story-web-forms-SUPPORTOS-43.md). **Verified by inspection — this is Task 3's answer:** `/contact` is a route in the public tree (`frontend/src/app/router.tsx:61-67`) that lazy-loads `WebFormPage` (`frontend/src/features/web-form/components/WebFormPage.tsx`, 149 lines). It is **complete and working**: a name/email/subject/description/category form that POSTs a ticket and renders a success card with the ticket id. See `## Product rules` for what this means for the CTA.
- **Story 11 (`CUST-2`) completed:** [../customer-management/11-story-contact-details-SUPPORTOS-29.md](../customer-management/11-story-contact-details-SUPPORTOS-29.md). Verified landed: `customers.ContactDetail` (`backend/apps/customers/models.py:132-174`) — a `Channel` `TextChoices` plus **one generic `value` column**, with per-channel format validation in `ContactDetailSerializer.validate` (`backend/apps/customers/serializers.py:116-132`) because "DRF does not call model `clean()`, and this model deliberately has none". **This is the exact shape `LandingSocialLink` copies.**
- **No new dependency.** See `## The icon decision` below — this is the one place where a naive reading of the intake would add one, and it must not.

---

## Story Goal

The landing footer renders one line — `content.footerText` (`frontend/src/shared/landing/sections/LandingSections.tsx`, `LandingFooter`). There is no way for a visitor to reach the organization anywhere off-site, and no way for an admin to say where "anywhere off-site" even is.

This story adds an **ordered, admin-managed list of social and contact links**, served through Story 94's existing public endpoint:

1. **`LandingSocialLink`** — a real model (platform choice set, one `value` column, `order`, `is_enabled`), CRUD'd under `settings.manage`, with **per-platform** server-side validation: a URL platform must parse as a URL, `email` as an email, `phone`/`whatsapp` as a dialable number.
2. **`GET /api/landing/` grows one key, `social_links`** — enabled rows only, already ordered. No second request, no second endpoint.
3. **The landing footer renders them** as icon links with accessible names, `rel="noopener noreferrer"` on every external target, correct in RTL. **An empty list renders no row at all** — not an empty flex container, not a divider with nothing under it.
4. **`/contact` gains the same block**, so the hero's "Get a demo" CTA leads to a page that shows both the form *and* the organization's real channels.

**Explicitly out of scope:**

- **Repointing the hero's secondary CTA.** `/contact` is a finished, working page (see `## Product rules`), so the intake's "either wiring the real contact channels into it or repointing the CTA" resolves to **the first branch**. The CTA target stays admin-configurable through Story 94's `hero_secondary_cta_target`.
- **A second bilingual copy field per link.** A link's visible name is the **platform name** (`LinkedIn`, `WhatsApp`), which is a proper noun and identical in both locales. The `aria-label` is composed from a translated pattern plus that proper noun — see Task 6. No `label_en`/`label_ar` columns.
- **Any change to `customers.ContactDetail`.** That model is per-customer CRM data. This story's links are the organization's own public presence. Same shape, different table, no FK between them.
- **LAND-4's redesign placement.** The intake says "wherever DSN guidance places them in LAND-4's redesign". LAND-4 is not planned yet (`.squad/stories/public-landing-page/SUPPORTOS-126/` and `SUPPORTOS-128/` are intakes with no plan). This story puts the block in the footer and on `/contact`, and exports it as a **standalone section component** so LAND-4 can move it without rewriting it.
- **Click analytics, link-health checking, or `rel="me"` verification.**
- **Uploaded brand logos.** There is still no `<img>` in this codebase (CONVENTIONS.md § 25).

---

## Product rules (from story)

### Task 3 resolved by inspection — `/contact` is not unfinished

The intake instructs: *"Confirm what `/contact` currently renders … resolve by inspection first; do not assume the route is missing or complete."* Inspected:

| Question | Verified answer |
|---|---|
| Is `/contact` routed? | **Yes** — `frontend/src/app/router.tsx:61-67`, inside the pathless public `PublicLayout` tree, no guard. |
| What renders? | **`WebFormPage`** (`frontend/src/features/web-form/components/WebFormPage.tsx`, 149 lines) — a real form: `name`, `email` (optional), `subject`, `description` (5000 max), `category` picker, submitting through `submitWebForm` to create a ticket. |
| Does it work end to end? | **Yes** — on success it swaps to a card reading "Request submitted … your request (#{{id}}) has been submitted" (`locales/en.json` `success.description`). |
| Is anything missing? | **One thing.** The page tells a visitor how to *open a ticket* and how to *start a live chat* (`links.chatPrompt` / `links.chat`, lines 141-147) — but never shows the organization's own phone, email, or social channels. |

**So the CTA does not lead somewhere unfinished, and must not be repointed.** The real gap is that `/contact` is a *form*, not a *contact page*. Task 7 closes that by rendering this story's admin-managed block beneath the form.

### Link behaviour

| Platform | Stored `value` | Rendered `href` | Opens |
|---|---|---|---|
| `facebook`, `x`, `instagram`, `linkedin`, `youtube`, `tiktok`, `github`, `website` | An `http(s)` URL | the value verbatim | new tab |
| `email` | An email address | `mailto:<value>` | same tab (the mail client takes over) |
| `phone` | A dialable number | `tel:<digits>` | same tab |
| `whatsapp` | A dialable number | `https://wa.me/<digits>` | new tab |

- **Every new-tab link carries `target="_blank" rel="noopener noreferrer"`.** `mailto:` and `tel:` get neither — a `_blank` on those opens a stranded blank tab in most browsers.
- **`is_enabled=False` rows are invisible to the public endpoint entirely** — filtered in the queryset, not hidden in CSS. An admin turning a channel off must not leave its URL in the page source.
- **An empty enabled set renders nothing.** `LandingSocialRow` returns `null` when it has no links; the footer's layout must not reserve space for it.

---

## The icon decision (read this before writing any code)

The intake's constraint is *"a fixed platform choice set mapped to curated `lucide-react` icons — not a JSONField and not free-text icon names"*. The **fixed set** and **no free text** halves stand. The **`lucide-react` icons** half cannot be satisfied for brands, and this was verified, not assumed:

```
lucide-react 1.34.0 — 6098 exports
Facebook, Twitter, Instagram, Linkedin, Youtube, Github, Twitch, Slack: ALL MISSING
```

Lucide removed its brand icons. The exports matching a brand grep (`BadgeX`, `Inbox`, `Toolbox`, …) are all coincidental `-X`/`-box` matches. Generic marks **are** present and are used unchanged for the non-brand platforms: `MailIcon`, `PhoneIcon`, `MessageCircleIcon`, `GlobeIcon`.

**Decision: inline SVG brand paths in one module, no new dependency.** Rationale, in the order CONVENTIONS.md § 17 asks for it:

1. **An existing dependency cannot do it.** `lucide-react` is the icon library DSN-4 standardized on and it has no brand marks. No other installed package ships icons.
2. **Adding one is worse than the alternative.** `react-icons` pulls a very large surface for ten glyphs; the alternative is 10 short `<path d="…">` strings.
3. **Inline `<svg>` already has precedent here** — `frontend/src/shared/ui/chart/GaugeChart.tsx:72` and `LineChart.tsx:132` both render raw `<svg>`. This does **not** breach § 25's "no `<img>` anywhere": an inline `<svg>` is not an `<img>`, needs no `alt`, and inherits `currentColor`.
4. **The "fixed set, no free text" constraint is fully preserved** — the platform enum is the fixed set, and it lives in two places (the Django `TextChoices` and the frontend map), exactly as `LandingHighlight.Icon` / `LANDING_ICONS` already do.

Source the path data from **Simple Icons** (CC0 1.0, `https://simpleicons.org`) and record that in the module docstring. Brand names and marks remain their owners' trademarks; an organization linking to its own profiles is ordinary nominative use.

---

## Context — Read These Files First

1. `backend/apps/customers/models.py` — read lines 132-174 (`ContactDetail`). **The model shape to copy**, and read its comments rather than skimming: line 154 is `channel = models.CharField(… choices=Channel.choices)`, lines 155-160 explain why there is **one generic `value` column** rather than one column per channel ("an email address, a phone number, and a WhatsApp identifier are all 'a string with a length cap' at the model layer"), and lines 156-159 state that **per-channel format validation is the serializer's job** because "DRF does not call model `clean()`, and this model deliberately has none". Also read the `UniqueConstraint` at 166-171.
2. `backend/apps/customers/serializers.py` — read lines 103-141 (`ContactDetailSerializer`). **The validation shape to copy.** Note specifically lines 125-126: `channel`/`value` each fall back to `getattr(self.instance, …, None)` so a PATCH that sends only one still validates the pair together. Note also the `try: validate_email(value) / except DjangoValidationError → raise serializers.ValidationError({"value": list(exc.messages)}) from exc` idiom at 127-131 — reuse it verbatim, including the `from exc`.
3. `backend/apps/organization/models.py` — read lines 196-233 (`LandingContent`'s docstring and `CtaTarget`) and lines 310-366 (`LandingHighlight`, including its `Icon` `TextChoices` at 325-351 and `ordering = ("order", "id")`). **`LandingSocialLink` is a sibling of `LandingHighlight`, not a field on `LandingContent`.** Also read lines 8-17 for `HEX_COLOR_VALIDATOR` — the module-level `RegexValidator` idiom with a comment explaining the exact regex, which the new phone validator copies.
4. `backend/apps/organization/serializers.py` — read lines 146-207 (`PublicLandingContentSerializer`). Three things matter: `highlights = serializers.SerializerMethodField()` (line 168), the comment at 172-176 stating **`highlights` MUST stay last** because `LandingContentAdminSerializer` slices it off with `[:-1]`, and `get_highlights` at 203-207. **Adding `social_links` changes that slice** — see Task 3 for exactly how.
5. `backend/apps/organization/views.py` — read lines 135-166 (`LandingContentView`, the public read; note `authentication_classes: list = []` + `AllowAny` at 162-163 and the "NO `throttle_classes`" paragraph at 153-156) and lines 196-224 (`LandingHighlightViewSet` — the `permission_map` with `SETTINGS_MANAGE` on all six actions, and the `ordering_fields`/`search_fields` pair). The new viewset is this class with a different model.
6. `backend/apps/organization/urls.py` — all 36 lines. `router.register("landing-highlights", …)` is line 23; the new registration goes next to it. **No new `path()`** — the public read already exists at line 33.
7. `backend/apps/organization/admin.py` — read the `LandingHighlightAdmin` block added by Story 94 (`list_display`, `search_fields`, `ordering`, `readonly_fields`). Copy it.
8. `frontend/src/shared/landing/types.ts` — all 66 lines. `LandingContent` (the API mirror) gains one field; `ResolvedLanding` (what the sections render) gains one; a new `ResolvedSocialLink` type is added. Read the docstring at 1-5 explaining **why this module is in `shared/` and not `features/landing/`** — `no-restricted-imports` forbids `features/organization/`'s preview importing from `features/landing/`, and that reasoning now extends to `features/web-form/` too (Task 7).
9. `frontend/src/shared/landing/config.ts` — all ~105 lines. Read `LANDING_ICON_KEYS` (an `as const` tuple), `LandingIconKey`, `isIconKey`, `landingIcon`, and `ctaPath`. **The `as const` tuple is load-bearing** — a plain `string[]` makes `t(\`…${key}\`)` fail to typecheck against the strict i18next resource map (`frontend/src/shared/i18n/i18next.d.ts`). The platform list must be declared the same way.
10. `frontend/src/shared/landing/resolve.ts` — all ~116 lines. `resolveLanding(content, language, t)` is the single place blank-means-default lives. Read `pick`/`pickEither` and `resolveHighlights`. **Social links do NOT get a bundle fallback** — there is no shipped default social presence, so an empty list resolves to an empty array and the row disappears. Say so in the code.
11. `frontend/src/shared/landing/sections/LandingSections.tsx` — read `LandingCtaBand` (lines ~79-109, note the "NOT admin-editable" comment on the `auth:help.*` block, which stays) and `LandingFooter` (lines ~111-119) — currently a `<footer className="border-t">` wrapping one `container mx-auto px-4 py-6` div holding `content.footerText`. **That div becomes a two-row flex.**
12. `frontend/src/shared/landing/LandingIcon.tsx` — all 21 lines. Note the `createElement(landingIcon(icon), { className })` form and the docstring explaining why (avoids `oxlint`'s `react/static-components` on a dynamically-resolved component). `LandingSocialIcon` must use the same form for the same reason.
13. `frontend/src/features/web-form/components/WebFormPage.tsx` — read lines 86-148. The page's outer wrapper is `<div className="flex w-full max-w-xl flex-col gap-6">` (line 87), and the last child (141-147) is the centred "Prefer to talk right now? / Start a live chat" paragraph. **The contact block goes after that paragraph, inside the same wrapper.** Read lines 1-20 for its import set — it already imports `Card`/`CardContent` and `Link`.
14. `frontend/src/features/web-form/locales/en.json` and `ar.json` — 20 lines each. The `links` block (`chatPrompt`, `chat`) is what the new keys sit beside.
15. `frontend/src/app/router.tsx` — read lines 55-67 (`/chat` and `/contact` in the pathless public tree) to confirm Task 3's finding for yourself, and lines 505-570 (the `settings.manage` `RequirePermission` block, which Story 94 filled with `settings/landing` and the three `settings/landing/highlights` routes). **The two new routes go in that same block** — no new guard.
16. `frontend/src/features/organization/components/LandingHighlightListPage.tsx` and `LandingHighlightFormPage.tsx` — the list/form pair to copy wholesale. Note in the list page: `initialSort: { field: 'order', direction: 'asc' }`, the `<LandingIcon>` cell, the "not sortable — absent from `ordering_fields`" comment, and the `Empty` description that explains what an empty table *means*. Note in the form page: `order: z.coerce.number().int().min(0).max(9999)` with its "NOT `positiveInt()` — that floors at 1" comment, `choice(LANDING_ICON_KEYS)`, and `isIconKey(…) ? … : DEFAULT_ICON_KEY` narrowing in `toDefaults`.
17. `frontend/src/features/organization/api/` — read `landingKeys.ts` (`landingContentKeys`, and its docstring on why it is separate from `shared/landing`'s `landingKeys`), `useLandingHighlightMutations.ts` (the `useInvalidateHighlights` helper invalidating **both** `landingContentKeys.all` and `landingKeys.all`), and `getLandingHighlightList.ts` (`api.getPage` + `ServerTableParams & { search?: string }`). The social-link API files are a rename-for-rename copy.
18. `frontend/src/shared/ui/primitives/button.tsx` — read lines 7-40 (`buttonVariants`). Sizes include `icon` (`size-9`), `icon-sm` (`size-8`), `icon-xs` (`size-6`). CONVENTIONS.md § 25 records that `icon-xs` = 24px "meets WCAG 2.2's minimum exactly" — **use `icon-sm` (32px) for the footer social links**, which clears it comfortably for a primary public-facing target.
19. `frontend/src/shared/ui/chart/GaugeChart.tsx` — read line 72 and the surrounding element. The inline-`<svg>` precedent: `viewBox`, a `role`, sized by className. `LineChart.tsx:132` shows the `aria-hidden="true"` variant for a decorative mark, which is what the brand paths use (the accessible name lives on the `<a>`).
20. `CONVENTIONS.md` — § 17 (dependencies: check an existing one first — the whole basis of `## The icon decision`), § 18 (no hardcoded strings; every `en` key must exist in `ar`; logical properties only), § 19 (tokens only), § 25's "UX & accessibility guidance" subsection at lines 1651-1707 (**DSN-2's bar**: "icon-only buttons (all 5 already have `aria-label`)", "no emoji used as icons (SVG icon set only)", visible focus states, 4.5:1 contrast), § 20 (forms), § 23 (`ordering_fields` must match `ColumnDef.id`), and § 16 (**this project does not author automated tests**).
21. `frontend/scripts/check-rtl.mjs` — read lines 12-31 (`PATTERNS`). It scans `.ts`, `.tsx`, **and `.css`**, and it is a **text** tripwire: it will match a forbidden utility inside a comment or a string. Story 94 hit exactly that. Keep `pl-`/`pr-`/`ml-`/`mr-`/`left-`/`right-`/`text-left`/`text-right`/`translate-x-` out of the new files **including prose**.

---

## Backend Tasks

### 1 — `LandingSocialLink`

**File: `backend/apps/organization/models.py`**

Append after `LandingHighlight` (after line 366). Add `RegexValidator` usage alongside the existing import at line 2.

```python
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
```

> **`UniqueConstraint(fields=["platform"])` rather than `unique=True` on the field.** Both work; the constraint form keeps the reason in one place and matches `ContactDetail`'s own `Meta.constraints` idiom. Verify after `makemigrations` that DRF generates the validator — Task 8's verification step covers it.

### 2 — Migration

**File: create via `makemigrations`, do not hand-write**

```
cd backend && python manage.py makemigrations organization --name landing_social_link
```

Expect `0013_landing_social_link.py` with `dependencies = [("organization", "0012_landing_content")]`, one `CreateModel`, and one `AddConstraint`. **Verify there is no `AlterField` on `landingcontent` or `organizationsettings`** — if one appears, a field landed on the wrong class. No data migration and no permission migration: writes reuse `settings.manage` (`backend/apps/core/permissions.py:37`), exactly as Story 94 did.

### 3 — Serializers

**File: `backend/apps/organization/serializers.py`**

Add `LandingSocialLink` to the model import on line 6, and add these imports at the top:

```python
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator, validate_email
```

**3a. Two new serializer classes**, appended after `LandingHighlightSerializer`:

```python
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
            _run(PHONE_VALIDATOR, value)
        elif platform == LandingSocialLink.Platform.EMAIL:
            _run(validate_email, value)
        else:
            # Every remaining platform is a profile URL.
            _run(URLValidator(schemes=["http", "https"]), value)
        return attrs
```

Plus the two module-level helpers and the platform tuple, declared **above** the class:

```python
_PHONE_PLATFORMS = (LandingSocialLink.Platform.PHONE, LandingSocialLink.Platform.WHATSAPP)

# Everything a human types into a phone field and no dialer wants back.
_PHONE_NOISE = str.maketrans("", "", " -(). ")


def _normalize_phone(value: str) -> str:
    return value.translate(_PHONE_NOISE)


def _run(validator, value) -> None:
    """Run a Django validator and re-raise as a DRF field error on `value`.
    The exact `except … from exc` shape `ContactDetailSerializer.validate`
    already uses (apps/customers/serializers.py:127-131).
    """
    try:
        validator(value)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({"value": list(exc.messages)}) from exc


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
```

**3b. Extend `PublicLandingContentSerializer`.** Add the field declaration next to `highlights` (line 168) and the method next to `get_highlights`:

```python
    social_links = serializers.SerializerMethodField()
```

```python
    def get_social_links(self, obj) -> list:
        # ENABLED ONLY, and filtered in the QUERYSET rather than hidden on
        # the frontend: a channel an admin switched off must not appear in
        # the page source at all. `Meta.ordering` supplies the sort.
        return PublicLandingSocialLinkSerializer(
            LandingSocialLink.objects.filter(is_enabled=True), many=True
        ).data
```

**3c. Fix the `Meta.fields` slice — this is the one place a careless edit breaks Story 94.** `LandingContentAdminSerializer` currently derives its field list as `("id",) + PublicLandingContentSerializer.Meta.fields[:-1] + ("created_at", "updated_at")`, and the public tuple's comment says `highlights` **MUST stay last**. Adding a second read-only nested field makes a one-element slice wrong.

Do exactly this: put `social_links` **after** `highlights` at the end of the public tuple, change that comment to say the **last two** entries are the read-only nested lists, and change the slice to `[:-2]`. Update both comments so neither lies:

```python
        # The last TWO entries (`highlights`, `social_links`) are read-only
        # nested lists written through their own viewsets, and
        # `LandingContentAdminSerializer` below slices both off with
        # `[:-2]`. Keep them last, and keep that slice in step — Story 95
        # widened it from `[:-1]`.
```

```python
        # `[:-2]` strips the trailing `"highlights"` and `"social_links"`
        # entries, both read-only and both living on their own endpoints.
        # Everything else is written here.
        fields = (
            ("id",) + PublicLandingContentSerializer.Meta.fields[:-2] + ("created_at", "updated_at")
        )
```

> **Verification, not assumption:** Task 10's step 5 asserts `"social_links" not in` the admin payload and `len(admin_fields) == len(public_fields) - 2 + 3`. If the slice is wrong, the admin serializer starts trying to write a `SerializerMethodField` and 500s on PATCH.

### 4 — Viewset, URL, admin

**File: `backend/apps/organization/views.py`** — extend both imports, then append:

```python
class LandingSocialLinkViewSet(BaseModelViewSet):
    """Social/contact link CRUD — LAND-3. `LandingHighlightViewSet` above,
    for the other ordered list behind the public landing page.

    ONE permission, for the same reason that viewset gives: nothing in the
    staff app reads these except this screen, and the one caller that needs
    them without `settings.manage` is the anonymous landing page, which
    reads them through `LandingContentView`.

    `list` is NOT filtered to `is_enabled=True` — the admin screen must show
    disabled rows, since toggling them is the whole point. Only the PUBLIC
    serializer filters.
    """

    queryset = LandingSocialLink.objects.all()
    serializer_class = LandingSocialLinkSerializer

    permission_map = {
        "list": Permissions.SETTINGS_MANAGE,
        "retrieve": Permissions.SETTINGS_MANAGE,
        "create": Permissions.SETTINGS_MANAGE,
        "update": Permissions.SETTINGS_MANAGE,
        "partial_update": Permissions.SETTINGS_MANAGE,
        "destroy": Permissions.SETTINGS_MANAGE,
    }

    # Each name must match a `ColumnDef.id` on `LandingSocialLinkListPage` (§23).
    ordering_fields = ("order", "platform", "created_at")
    search_fields = ("value",)
```

**File: `backend/apps/organization/urls.py`** — one line after line 23, and **no new `path()`**: the public read is already mounted.

```python
router.register("landing-social-links", LandingSocialLinkViewSet, basename="landing-social-link")
```

**File: `backend/apps/organization/admin.py`** — register `LandingSocialLink` copying `LandingHighlightAdmin`: `list_display = ("platform", "value", "is_enabled", "order")`, `list_filter = ("platform", "is_enabled")`, `search_fields = ("value",)`, `ordering = ("order", "id")`, `readonly_fields = ("created_at", "updated_at")`.

---

## Frontend Tasks

### 5 — Brand icons and the platform contract

**Create file: `frontend/src/shared/landing/socialIcons.tsx`**

Inline `<svg>` brand marks — see `## The icon decision` for why this is not a new dependency. Module docstring must record: the Simple Icons CC0 source, that `lucide-react` 1.34.0 ships no brand icons (verified), and that trademarks remain their owners'.

Each mark is one component of exactly this shape — `24 24` viewBox, `fill="currentColor"`, **`aria-hidden="true"`** (the accessible name lives on the `<a>`, per DSN-2's icon-only rule), and no hardcoded size so the caller's `className` controls it:

```tsx
function FacebookMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="…" />
    </svg>
  )
}
```

Export a `SOCIAL_BRAND_MARKS: Record<string, (props: { className?: string }) => ReactNode>` covering `facebook`, `x`, `instagram`, `linkedin`, `youtube`, `tiktok`, `github`.

**Create file: `frontend/src/shared/landing/social.ts`**

```ts
export const SOCIAL_PLATFORMS = [
  'facebook', 'x', 'instagram', 'linkedin', 'youtube', 'tiktok',
  'github', 'website', 'email', 'phone', 'whatsapp',
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]
```

**`as const` is required, not stylistic** — `config.ts` records why: a plain `string[]` breaks `t(\`…${platform}\`)` against the strict i18next map.

Then, mirroring `config.ts`'s existing `isIconKey`/`landingIcon`/`ctaPath` trio:

- `isSocialPlatform(value: string): value is SocialPlatform` — a `SOCIAL_PLATFORMS.includes` guard. **The public payload types `platform` as plain `string`** for the same honesty reason Story 94's `icon` is: a backend-first deploy can send a platform this bundle has never heard of.
- `socialHref(platform: SocialPlatform, value: string): string` — the `## Product rules` table: `mailto:${value}` for `email`, `tel:${value}` for `phone`, `https://wa.me/${value.replace(/\D/g, '')}` for `whatsapp`, and `value` verbatim otherwise. Comment that the server already normalized phone values, so the `\D` strip is belt-and-braces for rows written through Django admin.
- `opensInNewTab(platform: SocialPlatform): boolean` — `false` for `email` and `phone`, `true` otherwise, with the comment from `## Product rules` about `_blank` on `mailto:` stranding a blank tab.

**Create file: `frontend/src/shared/landing/LandingSocialIcon.tsx`**

Resolves a platform to its mark: a brand component from `SOCIAL_BRAND_MARKS`, else a lucide icon (`website`→`GlobeIcon`, `email`→`MailIcon`, `phone`→`PhoneIcon`, `whatsapp`→`MessageCircleIcon`). **Use `createElement(…)`, not `const M = …; <M />`** — `LandingIcon.tsx:21` documents why (`oxlint`'s `react/static-components`).

### 6 — Resolve and render the block

**File: `frontend/src/shared/landing/types.ts`**

```ts
/** Mirrors `apps.organization.serializers.PublicLandingSocialLinkSerializer`.
 * `platform` is plain `string`, not `SocialPlatform`: a backend-first deploy
 * can store a choice this bundle has no mark for, and typing it narrowly
 * would move that failure to runtime. `resolveLanding` drops such rows. */
export type LandingSocialLink = {
  id: number
  platform: string
  value: string
  order: number
}

/** One resolved link — platform already narrowed, href already built. */
export type ResolvedSocialLink = {
  key: string
  platform: SocialPlatform
  label: string
  href: string
  external: boolean
}
```

Add `social_links: LandingSocialLink[]` to `LandingContent` and `socialLinks: ResolvedSocialLink[]` to `ResolvedLanding`.

**File: `frontend/src/shared/landing/resolve.ts`**

Add `socialLinks: resolveSocialLinks(content, t)` to the returned object, and:

```ts
function resolveSocialLinks(
  content: LandingContent | undefined,
  t: TFunction<'landing'>,
): ResolvedSocialLink[] {
  // NO BUNDLE FALLBACK, unlike every other field here: there is no shipped
  // default social presence to fall back TO. An org that has configured
  // nothing gets an empty array, and `LandingSocialRow` renders nothing at
  // all rather than an empty shell (LAND-3's own constraint).
  return (content?.social_links ?? [])
    .filter((link) => isSocialPlatform(link.platform) && link.value.trim() !== '')
    .map((link) => { /* platform narrowed by the filter — re-guard for TS */ })
}
```

Each resolved `label` is `t('social.platforms.<platform>')` — the proper noun, added to the `landing` namespace in Task 9.

**Create file: `frontend/src/shared/landing/sections/LandingSocialRow.tsx`**

```tsx
export function LandingSocialRow({
  links,
  className,
}: {
  links: ResolvedSocialLink[]
  className?: string
}) {
  const { t } = useTranslation('landing')
  if (links.length === 0) return null
  …
}
```

- **The early `return null` is the requirement**, not a nicety — LAND-3: "an empty list must render no social row at all rather than an empty shell".
- Each link is `<Button asChild variant="ghost" size="icon-sm">` wrapping an `<a>`. `icon-sm` is 32px — CONVENTIONS.md § 25 notes `icon-xs`'s 24px "meets WCAG 2.2's minimum exactly", and a public front-door target should clear it, not tie it.
- **`aria-label={t('social.visit', { platform: link.label })}`** on every `<a>` — DSN-2's bar: an icon-only control needs an accessible name. The mark itself is `aria-hidden`.
- `target="_blank" rel="noopener noreferrer"` **only when `link.external`**.
- Layout `flex flex-wrap items-center gap-1` — no `ml-`/`mr-`/`space-x-`, and **no `translate-x-`, `left-`, or `right-` anywhere including comments** (`check:rtl` is a text scan; Story 94 tripped exactly this).
- A separate component file, not a nested function, precisely so LAND-4 can relocate it without touching `LandingSections.tsx`.

**File: `frontend/src/shared/landing/sections/LandingSections.tsx`** — `LandingFooter` becomes:

```tsx
export function LandingFooter({ content }: { content: ResolvedLanding }) {
  return (
    <footer className="border-t">
      <div className="container mx-auto flex flex-col items-center gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>{content.footerText}</span>
        <LandingSocialRow links={content.socialLinks} />
      </div>
    </footer>
  )
}
```

`justify-between` and `flex-col`/`sm:flex-row` are direction-neutral; with no links the row returns `null` and `justify-between` leaves the footer text exactly where it is today.

**File: `frontend/src/shared/landing/index.ts`** — export `LandingSocialRow`, `LandingSocialIcon`, `SOCIAL_PLATFORMS`, `isSocialPlatform`, `socialHref`, and the `SocialPlatform` / `LandingSocialLink` / `ResolvedSocialLink` types. Keep `fetchLandingContent` unexported.

### 7 — `/contact` shows the real channels (Task 3's fix)

**File: `frontend/src/features/web-form/components/WebFormPage.tsx`**

`/contact` works; what it lacks is the organization's own channels. Add, **after** the existing "Prefer to talk right now?" paragraph (lines 141-147) and inside the same `flex w-full max-w-xl flex-col gap-6` wrapper:

```tsx
<ContactChannels />
```

A local component in the same file that calls `useLandingContent()` + `resolveLanding()` from `@/shared/landing` (a `shared/` import — `features/web-form/` importing `features/landing/` would violate `no-restricted-imports`, which is the same constraint that put this module in `shared/` in Story 94) and renders `<LandingSocialRow>` under a translated heading inside a `Card`.

**It returns `null` when there are no links** — same rule as the footer. And it must **not** gate the form on the request: the form renders regardless, exactly as the landing hero does (Story 94's "no loading state" rule). Reuse the already-cached query — `useLandingContent` has `staleTime: Infinity`, so on a visitor arriving from `/` this costs no extra request.

**Files: `frontend/src/features/web-form/locales/{en,ar}.json`** — add `links.contactHeading` (e.g. "Or reach us directly" / "أو تواصل معنا مباشرة").

### 8 — Admin screens

**Create files** in `frontend/src/features/organization/`:

- `api/` — `getLandingSocialLinkList.ts`, `getLandingSocialLink.ts`, `createLandingSocialLink.ts`, `updateLandingSocialLink.ts`, `deleteLandingSocialLink.ts` against `/landing-social-links/`, plus `useLandingSocialLinkList.ts`, `useLandingSocialLink.ts`, `useLandingSocialLinkMutations.ts`. Copy the highlight equivalents exactly, **including invalidating both `landingContentKeys.all` and `landingKeys.all`** in all three write hooks — a toggled channel must reach the live footer without a reload.
- `types/landing.ts` — extend with `LandingSocialLinkRow` (the shared type plus timestamps and `is_enabled`) and `LandingSocialLinkInput`. Import the shared `LandingSocialLink` rather than restating the columns, as the file already does for highlights.
- `components/LandingSocialLinkListPage.tsx` — `LandingHighlightListPage`'s copy. Columns: `order` (sortable), `platform` (sortable, `TableLink` to edit, rendering `<LandingSocialIcon>` + the translated platform name), `value` (**not** sortable — absent from `ordering_fields`; `priority: 'sm'`), `is_enabled` (a `Badge`, `success`/`outline` per DSN-4's semantics), and `actions`. The `Empty` description must say that an empty list means **no social row renders at all** — the same "explain what empty means" duty Story 94's highlight list carries.
- `components/LandingSocialLinkFormPage.tsx` — `LandingHighlightFormPage`'s copy. Schema: `platform: choice(SOCIAL_PLATFORMS)`, `value: requiredString(254)`, `is_enabled: z.boolean()` via `CheckboxField` or `SwitchField` (both exist in `shared/ui/form/index.ts`), `order: z.coerce.number().int().min(0).max(9999)` — **not `positiveInt()`**, for the reason `FaqFormPage.tsx:30` records. In `toDefaults`, narrow `platform` with `isSocialPlatform(...) ? … : 'website'` so a row written through Django admin still opens. Show a live `<LandingSocialIcon>` preview of the picked platform, as the highlight form does for its icon.
- The `value` field's `description` must change with the selected platform (`form.watch('platform')`) — "Full profile URL" vs "Email address" vs "Phone number, digits only". Without it, an admin types a Facebook handle into a URL field and only learns from a 400.

### 9 — Routes, nav, i18n

**File: `frontend/src/app/router.tsx`** — three routes inside the **existing** `settings.manage` block (no new guard): `settings/landing/social`, `settings/landing/social/new`, `settings/landing/social/:id/edit`. **`new` must be declared before `:id/edit`**, the ordering `settings/departments/new` and Story 94's highlight routes both record.

**File: `frontend/src/features/organization/components/LandingContentPage.tsx`** — add a second `<Button asChild variant="outline">` to the `PageHeader` action linking `/settings/landing/social`, beside the existing "Manage highlights" button.

**File: `frontend/src/app/Sidebar.tsx`** — **no change.** `/settings/landing` is already linked and reaches both sub-screens; adding a third settings link for a sub-page of a sub-page is nav clutter. Note this decision in the plan's Done Criteria so it reads as deliberate.

**Files: `frontend/src/features/landing/locales/{en,ar}.json`** — add a `social` block to the **`landing`** namespace (the sections live in `shared/` but read this namespace by string, which is not an import): `social.visit` (`"Visit our {{platform}} page"` / `"زوروا صفحتنا على {{platform}}"`) and `social.platforms.*` — one entry per `SOCIAL_PLATFORMS` value. Platform names are proper nouns: keep `Facebook`, `LinkedIn`, `WhatsApp`, `GitHub`, `X`, `TikTok`, `YouTube`, `Instagram` **identical in both files**, and translate only `website`, `email`, `phone`.

**Files: `frontend/src/features/organization/locales/{en,ar}.json`** — add a `landingSocial` block mirroring `landingHighlights`' shape (`title`, `navLabel`, `new`, `edit`, `search`, `searchPlaceholder`, `empty`, `emptyDescription`, `noSearchResults`, `created`, `updated`, `fields.*`, `actions.*`, `delete.*`, `platforms.*`, plus `valueHint.{url,email,phone}`), and `landing.manageSocial` for the new header button.

**Every `en` key must exist in `ar`** (CONVENTIONS.md § 18). Verify with a flattened set-difference, not by eye.

---

## Edge Cases & Failure Modes

- **No links configured (the default on every existing deployment).** `social_links` is `[]`, `resolveSocialLinks` returns `[]`, `LandingSocialRow` returns `null` before rendering any element. The footer is byte-identical to today's. Enforced by the early return in `LandingSocialRow.tsx` — **the single most important line in this story.**
- **All links disabled.** Identical to the above: `get_social_links` filters `is_enabled=True` in the queryset, so the payload is `[]` and no URL appears in the page source.
- **A platform this bundle does not know** (backend-first deploy adding a `Platform` value). `resolveSocialLinks`'s `isSocialPlatform` filter drops the row. A nameless, markless link never renders. The admin form falls back to `website` so the row is still editable.
- **A row with a blank `value`** (only reachable through Django admin — the serializer requires it). Dropped by the same filter's `value.trim() !== ''`.
- **Admin pastes `facebook.com/acme` without a scheme.** `URLValidator(schemes=["http", "https"])` rejects it → 400 → `applyServerErrors` puts "Enter a valid URL." on the `value` field. **This is the designed behaviour**: a scheme-less href would resolve relative to the app's own origin and 404 inside the SPA.
- **Admin pastes `+966 55 123 4567`.** `_normalize_phone` strips spaces/dashes/parens/dots (including the non-breaking space, which is what a copy-paste from a web page usually carries) *before* validation, so it is accepted and stored as `+966551234567` — directly usable by `tel:` and `wa.me`.
- **A second row for the same platform.** The `UniqueConstraint` yields a DRF `UniqueTogetherValidator` → 400 with a field error, not a 500.
- **`mailto:`/`tel:` with `target="_blank"`.** Prevented by `opensInNewTab` returning `false` for both — otherwise most browsers leave a blank tab behind after handing off to the mail client.
- **RTL.** The row is `flex flex-wrap gap-1` and the footer `flex-col sm:flex-row justify-between` — all direction-neutral. `check:rtl` scans text including comments, so a `translate-x-`/`left-`/`ml-` mentioned in prose fails CI. Story 94 hit this exact trap; do not repeat it.
- **Icon-only links and screen readers.** Every `<a>` carries `aria-label` from `social.visit`; every mark is `aria-hidden="true"`. This is DSN-2's stated bar (CONVENTIONS.md § 25: "icon-only buttons (all 5 already have `aria-label`)").
- **The `[:-2]` slice.** If `social_links` is not last in the public tuple, or the slice stays `[:-1]`, `LandingContentAdminSerializer` inherits a `SerializerMethodField` it cannot write and `PATCH /api/settings/landing/` breaks. Task 10 step 5 asserts this directly rather than trusting the edit.
- **Anon throttle budget.** `/` still makes exactly **two** anonymous GETs (`/api/branding/`, `/api/landing/`) — social links ride the existing payload. `/contact` now makes one, reusing the `staleTime: Infinity` cache for a visitor arriving from `/`. The `anon` bucket is `300/hour` per IP (`backend/config/settings/base.py:333`) and neither view declares `throttle_classes`, which would replace the baseline rather than stack (CONVENTIONS.md § 36).
- **Brand SVG paths.** Sourced from Simple Icons (CC0). If a path renders as a filled box, the `viewBox` is wrong for that mark — every Simple Icons path is authored for `0 0 24 24`.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md § 16: "Changes are verified by running the commands in `README.md` and driving the app directly. The 54 backend tests under `backend/apps/core/tests/` and `backend/config/tests/` predate this policy and are kept, but they are not extended and no new test file is added anywhere in the repo."

**No test file is added, modified, or removed.** Verification is `## Verification Steps` below. Do not create `backend/apps/organization/tests/`.

---

## Migration / Rollback

**Forward.** One migration, `0013_landing_social_link`: one new table plus one constraint. It touches no existing table and backfills nothing — safe against a live database, no downtime.

**Half-applied states, in deploy order:**

- **Migration applied, code not deployed.** An empty table nothing reads. No visible effect.
- **Backend deployed, frontend old.** `/api/landing/` returns an extra `social_links` key that the old bundle ignores (TypeScript types are compile-time only; the runtime object simply carries a field nobody reads). Footer unchanged. **This is the safe order — use it.**
- **Frontend deployed, backend old.** `social_links` is absent → `content?.social_links ?? []` → empty array → no row. Degrades to exactly today's footer, silently, by construction.

**Rollback.** Revert both deploys; leave `0013` applied — the table becomes inert and admin-entered links are preserved for a roll-forward. Only if the model itself must go: `python manage.py migrate organization 0012` drops the table and **destroys the configured links**; dump first.

**One-way door:** removing a value from `Platform` after admins have selected it orphans those rows. The frontend's `isSocialPlatform` filter keeps the page rendering (the link silently disappears), and the admin form falls back to `website`, but the data is stranded. Prefer adding values to removing them — the same note Story 94 records for `LandingHighlight.Icon`.

---

## Verification Steps

1. **Backend migrates:** in `backend/`, `python manage.py makemigrations organization --check --dry-run` reports **"No changes detected"** once `0013` is committed, and `python manage.py migrate` applies cleanly.
2. **Backend lints:** in `backend/`, `ruff check .` and `ruff format --check .` both pass.
3. **Public payload grows exactly one key:** `curl -s http://localhost:8000/api/landing/ | python -m json.tool` shows `social_links: []` on a fresh database, alongside the 21 Story-94 fields and `highlights`. Still **200** with no session and **200** with a malformed `Authorization` header (`curl -i -H "Authorization: Bearer garbage" …`).
4. **Per-platform validation, as an admin** (`settings.manage`), against `POST /api/landing-social-links/`:
   - `{"platform":"facebook","value":"facebook.com/acme"}` → **400** ("Enter a valid URL.")
   - `{"platform":"facebook","value":"https://facebook.com/acme"}` → **201**
   - a second `facebook` row → **400** (unique constraint)
   - `{"platform":"email","value":"not-an-email"}` → **400**; `{"platform":"phone","value":"+966 55 123 4567"}` → **201**, and re-reading the row shows `value == "+966551234567"`
   - the same POST with an `agent` token → **403**; with no token → **401**
5. **The slice is right:** `GET /api/settings/landing/` (admin) returns a payload **without** `social_links` and **without** `highlights`, and `PATCH /api/settings/landing/ -d '{"hero_headline_en":"x"}'` still returns **200**. A 500 here means step 3c was applied wrongly.
6. **Enabled-only:** set one row `is_enabled=false`; `GET /api/landing/` no longer contains its `value` anywhere in the response body (`curl … | grep -c "<that url>"` → `0`), while `GET /api/landing-social-links/` (admin) still lists it.
7. **Frontend typechecks and lints:** in `frontend/`, `npx tsc -b` (the project has **no** `typecheck` script — `build` runs `tsc -b`), `npm run lint`, `npm run check:rtl`, and `npm run format:check` all pass. `check:rtl` must report "no physical direction utilities in src/."
8. **Frontend builds:** `npx vite build` succeeds.
9. **Empty state — the headline check:** with zero rows, open `/` signed out. The footer shows the copyright line **and nothing else**, with no empty gap where the row would be. Inspect the DOM: there is **no** element between the footer text and the container's closing tag.
10. **Populated state:** add Facebook, LinkedIn, WhatsApp, and Email rows. `/` shows four icon links. Tab to each: a visible focus ring, and a screen reader (or DevTools' accessibility pane) announces "Visit our Facebook page". Verify in the DOM that each external anchor has `rel="noopener noreferrer"` and the `mailto:` anchor has **no** `target="_blank"`.
11. **Hrefs resolve:** clicking WhatsApp opens `https://wa.me/966551234567`; Email opens the mail client; Phone offers to dial on a mobile viewport.
12. **`/contact` reconciled:** from `/`, click the hero's secondary "Get a demo" CTA. It lands on `/contact`, which renders the working web form **and** the new contact block below it. Submit the form and confirm the success card still appears — the block must not interfere.
13. **RTL:** switch to Arabic on `/` and `/contact`. The footer's text and icon row swap sides as a unit, icons stay in reading order, nothing overflows. Page does not scroll horizontally.
14. **Admin round trip:** at `/settings/landing/social`, create, reorder (0/1/2), toggle one off, and delete one. Each change appears on `/` in a signed-out window **without a reload of the admin tab and without a rebuild**. As an `agent`, navigating to `/settings/landing/social` redirects to `/home`.
15. **Regression — Story 94 intact:** `/settings/landing` still saves landing copy and its live preview still updates as you type; `/settings/landing/highlights` still creates and orders highlight cards; deleting all highlights still restores the four shipped ones.

---

## Done Criteria

- [ ] `LandingSocialLink` exists with a fixed `Platform` choice set, one generic `value` column, `is_enabled`, and `order` — **no `JSONField`, no free-text icon or label column** — and migration `0013_landing_social_link` applies cleanly.
- [ ] Per-platform validation runs **server-side** in the serializer (URL platforms via `URLValidator(schemes=["http","https"])`, `email` via `validate_email`, `phone`/`whatsapp` via `PHONE_VALIDATOR` after normalization), copying `ContactDetailSerializer.validate`'s PATCH-safe shape.
- [ ] Duplicate platforms are rejected with a 400 field error, not a 500.
- [ ] `GET /api/landing/` carries `social_links` with **enabled rows only, filtered in the queryset**, ordered by `order` then `id`; no second endpoint and no second request.
- [ ] `LandingContentAdminSerializer` excludes **both** nested lists (`[:-2]`), and `PATCH /api/settings/landing/` still returns 200 — verified, not assumed.
- [ ] Writes are gated on the existing `settings.manage`: **no new permission string and no grant migration.**
- [ ] Brand marks are **inline SVG in the repo, with no new dependency** — justified in code by the verified fact that `lucide-react` 1.34.0 ships no brand icons; non-brand platforms use real lucide marks.
- [ ] Every icon-only link has an `aria-label` and every mark is `aria-hidden="true"` (DSN-2's bar); every new-tab link has `rel="noopener noreferrer"`; `mailto:`/`tel:` links do **not** open a new tab.
- [ ] **With no enabled links, the footer renders no row element at all** — not an empty container, not a gap.
- [ ] `/contact` renders the working web form **and** the admin-managed channels; the hero's secondary CTA was **not** repointed, because inspection showed `/contact` is complete.
- [ ] The block is a standalone `LandingSocialRow` component so LAND-4 can relocate it without a rewrite.
- [ ] Admin list/form screens exist at `/settings/landing/social`, reachable from `/settings/landing`'s header; **no new sidebar link** (deliberate — it is a sub-page of a sub-page).
- [ ] Every new `en` key has an `ar` counterpart, verified by flattened set-difference; platform proper nouns are identical in both files.
- [ ] `npx tsc -b`, `npm run lint`, `npm run check:rtl`, `npm run format:check`, `npx vite build`, `ruff check .`, `ruff format --check .`, and `makemigrations --check` all pass.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md § 16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 96.**
