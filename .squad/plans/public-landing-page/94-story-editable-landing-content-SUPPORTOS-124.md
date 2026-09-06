# Story 94 — Editable Landing Content, Admin CMS (Story: SUPPORTOS-124)

## Prerequisites

- **Story 86 completed:** [86-story-animated-public-landing-page-SUPPORTOS-120.md](86-story-animated-public-landing-page-SUPPORTOS-120.md). Verified landed: `frontend/src/features/landing/components/LandingPage.tsx` (119 lines), `frontend/src/features/landing/components/Reveal.tsx` (56 lines), the `landing` i18n namespace (`frontend/src/features/landing/locales/{en,ar}.json`, 35 lines each, registered at `frontend/src/shared/i18n/resources.ts:15-16,64,86`), `PublicLayout variant="full"` and the public front-door route tree (`frontend/src/app/router.tsx:14-36`), and `RedirectAuthenticated` (`frontend/src/shared/auth/index.ts:25`). **This story rewrites `LandingPage.tsx` and moves its presentation into `shared/`; it does not touch routing, guards, or motion policy.**
- **Story 90 (`ORG-3`) completed:** [../multi-department-multi-branch-branding/90-story-custom-branding-SUPPORTOS-114.md](../multi-department-multi-branch-branding/90-story-custom-branding-SUPPORTOS-114.md). Verified landed: `BrandingView` (`backend/apps/organization/views.py:75-105`) with `authentication_classes: list = []` + `permission_classes = [AllowAny]`, `BrandingSerializer` (`backend/apps/organization/serializers.py:37-60`), the public route `path("branding/", …)` (`backend/apps/organization/urls.py:21`), and the frontend mirror `frontend/src/shared/branding/` (10 files). **This story copies that public-read shape exactly and adds a sibling to it — it does not widen it.**
- **Story 87 / Story 89 (`ORG-1`/`ORG-2`) completed:** [../multi-department-multi-branch-branding/87-story-multi-department-SUPPORTOS-112.md](../multi-department-multi-branch-branding/87-story-multi-department-SUPPORTOS-112.md) and [../multi-department-multi-branch-branding/89-story-multi-branch-SUPPORTOS-113.md](../multi-department-multi-branch-branding/89-story-multi-branch-SUPPORTOS-113.md). Verified landed: `Department`/`Branch` (`backend/apps/organization/models.py:20-86`), their viewsets (`views.py:17-72`), and the frontend `DepartmentListPage`/`DepartmentFormPage` pair. **This is the ordered-row admin pattern the highlight list copies**, and the reason CONVENTIONS.md § 33 forbids a `JSONField` list here.
- **Story 40 (`KB-2`) completed:** [../knowledge-base/40-story-help-articles-guides-SUPPORTOS-53.md](../knowledge-base/40-story-help-articles-guides-SUPPORTOS-53.md). Verified landed: `Article.title_en/title_ar/body_en/body_ar` (`backend/apps/knowledge_base/models.py:75-82`) and the two-card English/Arabic form layout (`frontend/src/features/knowledge-base/components/ArticleFormPage.tsx:165-200`). **This is the bilingual storage pattern this story mirrors** — separate columns per locale, not a JSON blob and not `django-modeltranslation`.
- **Story 07 (`FORM`) and Story 05 (`I18N`) completed.** `useAppForm`, `TextField`, `SelectField`, `FormErrorSummary`, `SubmitButton` are exported from `frontend/src/shared/ui/form/index.ts`; `applyServerErrors`/`isValidationError` from `frontend/src/shared/validation/serverErrors`.
- **No new dependency.** `lucide-react`, `@tanstack/react-query`, `react-hook-form`, and `zod` are all already installed and already used by the files below (CONVENTIONS.md § 17).

---

## Story Goal

Today every string on the public landing page is frozen in the JS bundle: `frontend/src/features/landing/locales/en.json` and `ar.json` (35 lines each), plus a hard-coded four-entry `FEATURES` array at `frontend/src/features/landing/components/LandingPage.tsx:13-18`. Changing the headline requires an edit, a build, and a deploy.

This story makes that copy admin-editable while keeping the shipped bundle as the permanent floor:

1. **A public, unauthenticated `GET /api/landing/`** returns the admin-set copy — hero headline, value proposition, both CTA labels and targets, the features section title, the CTA band, the footer line, and the ordered highlight cards — with every string stored **twice, `_en` and `_ar`**.
2. **The landing page renders admin copy when present and the shipped bundle string when not**, per field, picking the locale half matching the active `i18n` language. A failed request, a slow request, or a never-edited organization all render exactly today's page. **The hero is never replaced by a spinner.**
3. **Feature highlights become rows**, not code — bilingual title and description, an icon chosen from a fixed curated `lucide-react` set, and a numeric sort order. An empty highlight table falls back to the four shipped cards.
4. **One admin surface at `/settings/landing`**, gated on `settings.manage`, with a **live preview** rendering the real landing presentation components against unsaved form values.

**Explicitly out of scope:**

- **Widening `OrganizationSettingsSerializer`** (`backend/apps/organization/serializers.py:63-109`). It is admin-only by design and carries the org's SLA defaults; its own docstring and `BrandingSerializer`'s "THREE FIELDS, DELIBERATELY" note (lines 40-46) record why. Landing content gets its **own** models, its **own** narrow public serializer, and its **own** public view.
- **A rich-text or Markdown editor for landing copy.** These are short marketing strings in plain `TextField`/`TextareaField` inputs. `MarkdownField` stays a `knowledge-base` concern.
- **Uploaded images.** There is no `<img>` on the landing page and this story does not add one (CONVENTIONS.md § 25; Story 86 `## Story Goal`). Highlights are icons.
- **A free-text icon name.** The intake's constraint: an admin who types `foo` must not be able to blank a card or crash the page.
- **Per-branch or per-department landing content.** One organization, one landing page — the same singleton posture `OrganizationSettings` takes.
- **Drag-and-drop reordering.** A number in the edit form is the whole ordering UI, exactly as `FAQ.order` already does (`backend/apps/knowledge_base/models.py:26-29`, `frontend/src/features/knowledge-base/components/FaqFormPage.tsx:30-31`).
- **Any new permission string.** Writes reuse `settings.manage` (`backend/apps/core/permissions.py:37`), so **no permission-grant migration is added**.

---

## Product rules (from story)

| Landing field | Today | After this story |
|---|---|---|
| Hero headline, value proposition | `t('hero.headline')` / `t('hero.valueProposition')` from the bundle | `LandingContent.hero_headline_{en,ar}` / `hero_value_proposition_{en,ar}` **when non-blank**, else the same bundle string |
| Hero primary CTA (label + target) | Label from bundle, target hard-coded `/login` (`LandingPage.tsx:53,56`) | Admin label per locale; target chosen from a **fixed set** of public routes; blank → bundle label + `/login` |
| Hero secondary CTA | Label `hero.demo`, target hard-coded `/contact` | Same rule; blank → bundle label + `/contact` |
| Features section title | `t('features.sectionTitle')` | `features_section_title_{en,ar}`, blank → bundle |
| Feature highlight cards | Hard-coded `FEATURES` array of four keys + four `lucide` components (`LandingPage.tsx:13-18`) | `LandingHighlight` rows ordered by `order`, then `id`. **Zero rows → the four shipped cards, unchanged** |
| CTA band title / subtitle / button label | `t('cta.title')` / `t('cta.subtitle')` / `t('cta.login')` | `cta_title_{en,ar}` / `cta_subtitle_{en,ar}` / `cta_label_{en,ar}`, each blank → bundle; band target chosen from the same fixed set, blank → `/login` |
| Footer line | `t('footer.copyright', { year })` | `footer_text_{en,ar}`, blank → bundle. **`{{year}}` interpolation is preserved** for an admin-set value too |
| The `auth:help.*` block (`LandingPage.tsx:92-107`) | Bundle strings, links to `/contact` and `/chat` | **Unchanged.** Shared with `LoginPage`; not landing-specific copy |
| `GET /api/landing/` while signed out | 404 (no such route) | 200, `AllowAny`, no `Authorization` header sent |
| `PATCH /api/settings/landing/` without `settings.manage` | — | 403 through `HasPermission` |

**"Blank means fall back" is enforced on the frontend, not the backend.** The API returns the empty string it stores; `shared/landing/resolve.ts` is the single place that turns `''` into the bundle default. The backend must not know the bundle strings — they are i18n resources, and duplicating them into Python would create a second source of truth that drifts.

---

## Context — Read These Files First

1. `backend/apps/organization/models.py` — read lines 89-195 (`OrganizationSettings`). The **singleton mechanism to copy verbatim**: `save()` forces `self.pk = 1` (182-184), `delete()` is a documented no-op (186-190), `load()` is `get_or_create(pk=1)` (192-194). Read lines 114-118 especially — the docstring paragraph the intake quotes about `primary_color` being publicly readable. Also read lines 20-86 (`Department`/`Branch`) for the plain-model shape, and lines 8-17 (`HEX_COLOR_VALIDATOR`) for how this app declares a module-level validator with a comment explaining the exact regex.
2. `backend/apps/organization/serializers.py` — read lines 37-60 (`BrandingSerializer`). Note it subclasses `serializers.ModelSerializer`, **not** `BaseModelSerializer` (line 48-50 explains why: timestamps are not part of a public payload), and that its safety mechanism is a hand-listed `fields` tuple. Read lines 63-109 (`OrganizationSettingsSerializer`) to see exactly what must **not** be widened.
3. `backend/apps/organization/views.py` — read lines 75-105 (`BrandingView`). Copy this class shape: `authentication_classes: list = []` **and** `permission_classes = [AllowAny]` (101-102, the docstring at 79-84 explains why both are needed), a single `get`, returning `Response(Serializer(...).data)` with no envelope (97-98). Read lines 108-129 (`SettingsView`) — the GET/PATCH singleton `APIView` keyed by lowercased method in `permission_map` (line 119); the landing admin view is this class with a different serializer. Read lines 17-72 for the `BaseModelViewSet` + `permission_map` + `ordering_fields`/`search_fields` shape the highlight viewset copies.
4. `backend/apps/organization/urls.py` — all 23 lines. `SimpleRouter` (not `DefaultRouter`, line 8-11 says why), two `router.register` calls (13-14), and the comment at 17-20 explaining why `branding/` is a **sibling** of `settings/` and not nested under it. That comment's reasoning applies unchanged to the new public path.
5. `backend/apps/organization/migrations/0010_grant_branch_permissions.py` — all 47 lines. The `GRANTS` dict + `grant`/`revoke` `RunPython` pair. **Read it to confirm you do not need one:** this story adds no permission string, so it adds no migration of this kind. The last migration is `0011_organizationsettings_primary_color.py`, so the new schema migration is `0012_…`.
6. `backend/apps/knowledge_base/models.py` — read lines 64-104 (`Article`). The bilingual column split (`title_en`/`title_ar` at 75-76, `body_en`/`body_ar` at 81-82) and the `Status` inner `TextChoices` class (71-73). Read lines 17-37 (`FAQ`) for `order = models.PositiveIntegerField(_("order"), default=0)` (line 29) and `ordering = ("order", "question")` (line 34) — the exact ordered-row shape `LandingHighlight` copies.
7. `backend/apps/core/serializers.py` — all 40 lines. `BaseModelSerializer.Meta.read_only_fields = ("id", "created_at", "updated_at")` (line 21) and the rule that a subclass Meta **must inherit** `BaseModelSerializer.Meta` for it to apply (lines 11-17).
8. `backend/apps/core/views.py` — read lines 12-32 (`BaseModelViewSet`): `permission_classes = [IsAuthenticated, HasPermission]`, and the rule at 20-23 that **an action with no `permission_map` entry is authenticated-only, not forbidden**. Every action on the new viewset gets an explicit entry.
9. `backend/apps/core/permissions.py` — read the `Permissions` class from line 18. `SETTINGS_MANAGE = "settings.manage"` is line 37. No new constant is added.
10. `backend/config/settings/base.py` — read lines 318-340 (`DEFAULT_THROTTLE_CLASSES` / `DEFAULT_THROTTLE_RATES`). `anon` is `300/hour` per IP and is the baseline the new public view inherits by **not** declaring `throttle_classes`. Line 321-322 records that a view's own `throttle_classes` **replaces** the baseline rather than stacking — which is why the new view declares none.
11. `frontend/src/features/landing/components/LandingPage.tsx` — all 119 lines. This is the file being decomposed. Lines 13-18 are the `FEATURES` array being replaced; 43-60 the hero; 62-81 the features band; 83-110 the CTA band (note lines 92-107 are the shared `auth:help.*` block that **stays**); 112-116 the footer.
12. `frontend/src/features/landing/components/Reveal.tsx` — all 56 lines. Moves to `shared/landing/`. Note line 22-24: the reduced-motion check runs in `useState`'s initializer, and lines 43-51 apply `opacity-0` until revealed. **This is the file the preview must be able to bypass** — an unrevealed section is invisible.
13. `frontend/src/features/landing/locales/en.json` and `ar.json` — both 35 lines. The key set (`hero.headline`, `hero.valueProposition`, `hero.login`, `hero.demo`, `features.sectionTitle`, `features.{tickets,sla,ai,reports}.{title,description}`, `cta.{title,subtitle,login}`, `footer.copyright`) is the **exact list of fallbacks** `resolve.ts` must cover. `footer.copyright` is `"© {{year}} SupportOS"` — the only interpolated key.
14. `frontend/src/shared/branding/` — read `types.ts` (18 lines: the `Branding` type mirroring `BrandingSerializer`, `EMPTY_BRANDING` as three empty strings, and the docstring explaining **why this lives in `shared/` and not in a feature** — `no-restricted-imports` forbids a cross-feature import), `fetchBranding.ts` (16 lines, note the comment at 10-13 about the unauthenticated GET needing no special handling), `brandingKeys.ts` (`featureKey('branding')`), and `useBranding.ts` (22 lines — `staleTime: Infinity` at 17 and the deliberate absence of `meta.toastOnError` at 18-21). **`shared/landing/` is a direct structural copy of this module.**
15. `frontend/.oxlintrc.json` — read lines 8-19. `no-restricted-imports` bans `@/features/*` from anywhere except `**/app/**` and `**/shared/i18n/resources.ts` (overrides at 24-40). **This is the single constraint that forces the landing presentation components into `shared/`:** `features/organization/`'s preview cannot import them from `features/landing/`. Also line 7: `react/jsx-no-literals` is `error`.
16. `frontend/src/shared/i18n/resources.ts` — all 98 lines. The `landing` namespace is registered at 15-16, 64, 86 and **is not moved by this story** — the locale JSON stays under `features/landing/locales/`, and `shared/landing/` reads it by namespace string (`useTranslation('landing')`), which is not an import and not a lint violation.
17. `frontend/src/features/organization/components/SettingsPage.tsx` — all 180 lines. The form idiom to copy: the Zod schema with `optionalString(n).transform((value) => value ?? '')` for `blank=True` server fields (lines 22-28), `useAppForm({ schema, defaultValues })` (98), `form.watch(name)` for a live draft preview (105 — and read the comment at 99-104 explaining why it does **not** push into a global store on every keystroke; the landing preview makes the same call), `applyServerErrors(form, error)` into `FormErrorSummary` (112, 174), and `toast({ tone: 'success', … })` on save (109). **Do not append landing fields to this form** — the intake forbids it and this file is already at the length that motivated the rule.
18. `frontend/src/features/organization/components/DepartmentListPage.tsx` — all 126 lines. The list-page pattern: `useServerTable`, `useDebouncedSearch`, `ColumnDef[]` where **every `sortable: true` column id must appear in the viewset's `ordering_fields`** (see the comment at 63-64), `TableLink` to the edit route, `DeleteRowButton` inside `<Can>`, `PageHeader` with a `<Can>`-wrapped "New" action, and `Empty` with separate search/no-rows states.
19. `frontend/src/features/organization/components/DepartmentFormPage.tsx` — read lines 1-60. One component for both create and edit (docstring at 38-40), `EMPTY_DEFAULTS` for create, `toDefaults(row)` for edit, `toXInput(values)` for the write shape, and the comment at 21-23 on why `optionalString(...).transform(… ?? '')` is required for a `blank=True`, non-nullable server field.
20. `frontend/src/features/knowledge-base/components/ArticleFormPage.tsx` — read lines 155-216. The **bilingual form layout to copy**: one `Card` per locale with a `CardHeader`/`CardTitle` naming it (`articles.manage.sections.english` / `.arabic`), and `dir="auto"` on every Arabic input (lines 191, 197). Line 201-209 is the `SelectField` idiom for a picker with a sentinel option.
21. `frontend/src/features/knowledge-base/components/FaqFormPage.tsx` — read lines 28-43 and 112-120. `order: z.coerce.number().int().min(0).max(9999)` (line 31) and the `TextField type="number"` that edits it. **`positiveInt()` from `shared/validation/schemas` is wrong here** — the comment at line 30 records that it floors at 1 while `order` defaults to 0.
22. `frontend/src/shared/validation/schemas.ts` — read the exported helpers (`requiredString` line 11, `optionalString` 16, `choice` 74). `choice<const T extends readonly [string, ...string[]]>(values: T)` is what constrains the icon and CTA-target fields client-side.
23. `frontend/src/shared/ui/form/SelectField.tsx` — read lines 20-60. `options: readonly { value: string; label: string }[]`, already translated by the caller. The docstring at 30-34 explains the explicit `field.value`/`field.onChange` wiring.
24. `frontend/src/app/router.tsx` — read lines 505-517 (the `settings.manage` `RequirePermission` block wrapping `path: 'settings'` — the new landing routes go inside **this** block) and lines 575-613 (the `departments` list/new/edit split, including the comment at 588-592 on why `new` and `:id/edit` sit under a separate `manage` guard, and at 596-598 on why `new` must be declared **before** `:id/edit`).
25. `frontend/src/app/Sidebar.tsx` — read lines 170-181 (`showAdministration`, the `can(...)` disjunction) and lines 360-407 (the `<Can>`-wrapped `SidebarLink` list). The new link goes after the `/settings` link at 361-366 and needs **no** change to `showAdministration`, since it reuses `settings.manage` which is already in that list at line 176.
26. `frontend/src/features/organization/locales/en.json` / `ar.json` — read the `settings` block (lines 2-16 of `en.json`) and the `departments` block (17-42). Every new key added under a `landing` block must exist in **both** files (CONVENTIONS.md § 18).
27. `CONVENTIONS.md` — § 33 (lines 2226-2308; specifically the paragraph at ~2287-2296: "**`Department` and `Branch` replaced the two JSON string lists** … A future story wanting a list of things on that model should create a model, not a column: that is now the established answer, twice over"), § 18 (i18n: no hardcoded strings, every `en` key must exist in `ar`, logical properties only), § 19 (tokens are the only styling source), § 20 (forms), § 23 (`optionalString`/`nullableString` table; `ordering_fields` must match `ColumnDef.id`), § 25 (design intelligence, iconography), § 36 (throttling: `NUM_PROXIES`, fail-open classes, "a view's own `throttle_classes` replaces the baseline"), and § 16 (**this project does not author automated tests**).
28. `SupportOs backlog.MD` — read the `EPIC 15` block. `LAND-2` is this story; its five tasks map to the five task groups below.

---

## Backend Tasks

### 1 — `LandingContent` and `LandingHighlight` models

**File: `backend/apps/organization/models.py`**

Append both classes after `OrganizationSettings` (after line 195). Import `TextChoices` via the existing `models` import — no new imports are needed.

```python
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
    icon = models.CharField(
        _("icon"), max_length=32, choices=Icon.choices, default=Icon.SPARKLES
    )
    order = models.PositiveIntegerField(_("order"), default=0)

    class Meta:
        verbose_name = _("landing highlight")
        verbose_name_plural = _("landing highlights")
        ordering = ("order", "id")

    def __str__(self) -> str:
        return self.title_en
```

**Do not** add `LandingContent` fields to `OrganizationSettings`, and **do not** touch its `clean()`.

### 2 — Migration

**Create file: `backend/apps/organization/migrations/0012_landing_content.py`**

Generate it, do not hand-write it:

```
cd backend && python manage.py makemigrations organization --name landing_content
```

Verify the generated file: `dependencies = [("organization", "0011_organizationsettings_primary_color")]`, two `CreateModel` operations, and **no** `AlterField` on `organizationsettings` (if one appears, a field was added to the wrong class — revert and fix Task 1). No data migration and no permission-grant migration: the row is created lazily by `load()`, and writes reuse the existing `settings.manage`.

### 3 — Serializers

**File: `backend/apps/organization/serializers.py`**

Add `LandingContent, LandingHighlight` to the model import on line 6. Append three classes.

```python
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
    """The public half of a highlight — no timestamps, no `id` churn beyond
    what the frontend needs for a React key. Not `BaseModelSerializer` for
    the same reason `BrandingSerializer` above is not: timestamps are not
    part of a public payload.
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
        fields = ("id",) + PublicLandingContentSerializer.Meta.fields[:-1] + (
            "created_at",
            "updated_at",
        )
```

> **`fields[:-1]` is deliberate and fragile-looking — make it obvious.** It strips the trailing `"highlights"` entry. Add an inline comment saying so, and keep `"highlights"` **last** in `PublicLandingContentSerializer.Meta.fields`. If that ordering feels too implicit when you get there, write the tuple out in full instead; do **not** leave it undocumented.

### 4 — Views

**File: `backend/apps/organization/views.py`**

Extend the imports on lines 8-14, then append three classes.

```python
class LandingContentView(APIView):
    """Public landing content — LAND-2. The SECOND endpoint in this app
    reachable without a session, and a deliberate SIBLING of `BrandingView`
    above rather than an extension of it.

    Why not just add the fields to `BrandingSerializer`: that payload is
    fetched once per session by `<BrandingSync>` on EVERY route — login,
    portal, every staff screen — because it drives the brand colour and the
    document title. Landing marketing copy is needed on exactly one route.
    Merging them would ship ~20 unused strings to every signed-in agent's
    first page load and break that serializer's "THREE FIELDS,
    DELIBERATELY" contract.

    Same explicit-open pair as `BrandingView`: `authentication_classes = []`
    AND `permission_classes = [AllowAny]`. Both are needed — `AllowAny`
    alone still runs authentication, so a stale `Authorization` header
    would 401 the product's front door.

    NO `throttle_classes`: it inherits the `anon` 300/hour baseline from
    `DEFAULT_THROTTLE_CLASSES` (config/settings/base.py). Declaring its own
    would REPLACE that baseline rather than stack with it (CONVENTIONS.md
    § 36).

    GET only; any other verb 405s through Django's own
    `http_method_not_allowed`.
    """

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(PublicLandingContentSerializer(LandingContent.load()).data)


class LandingContentAdminView(APIView):
    """The admin read/write side of the one `LandingContent` row —
    `SettingsView` below, for landing copy. Same singleton `APIView` shape,
    same lowercased-method `permission_map`, same `settings.manage`: org
    marketing copy is admin-only by intent (LAND-2's own constraint), so
    this reuses the existing permission rather than minting a new one.
    """

    permission_classes = [IsAuthenticated, HasPermission]
    permission_map = {"get": Permissions.SETTINGS_MANAGE, "patch": Permissions.SETTINGS_MANAGE}

    def get(self, request):
        return Response(LandingContentAdminSerializer(LandingContent.load()).data)

    def patch(self, request):
        content = LandingContent.load()
        serializer = LandingContentAdminSerializer(content, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class LandingHighlightViewSet(BaseModelViewSet):
    """Highlight-card CRUD — LAND-2. `DepartmentViewSet` above, for the
    ordered list behind the public landing page.

    ONE permission, not two, unlike `DEPARTMENTS_VIEW`/`DEPARTMENTS_MANAGE`:
    nothing in the staff app renders a highlight picker or filter, so there
    is no read-only consumer to widen for. The one caller that needs to
    READ highlights without `settings.manage` is the anonymous landing page,
    and it reads them through `LandingContentView` above.

    NOT a `ScopedQuerysetMixin` consumer — there is one landing page, not
    one per branch.
    """

    queryset = LandingHighlight.objects.all()
    serializer_class = LandingHighlightSerializer

    permission_map = {
        "list": Permissions.SETTINGS_MANAGE,
        "retrieve": Permissions.SETTINGS_MANAGE,
        "create": Permissions.SETTINGS_MANAGE,
        "update": Permissions.SETTINGS_MANAGE,
        "partial_update": Permissions.SETTINGS_MANAGE,
        "destroy": Permissions.SETTINGS_MANAGE,
    }

    # Each name must match a `ColumnDef.id` on `LandingHighlightListPage` (§23).
    ordering_fields = ("order", "title_en", "created_at")
    search_fields = ("title_en", "title_ar")
```

### 5 — URLs

**File: `backend/apps/organization/urls.py`**

Extend the import on line 4, add one `router.register` after line 14, and two `path()` entries.

```python
router.register("landing-highlights", LandingHighlightViewSet, basename="landing-highlight")

urlpatterns = router.urls + [
    path("branding/", BrandingView.as_view(), name="branding"),
    # Public (see LandingContentView). A sibling of `settings/` for the same
    # reason `branding/` is: nesting a public path inside a path whose
    # siblings are all admin-gated is how one gets opened by accident later.
    path("landing/", LandingContentView.as_view(), name="landing"),
    path("settings/", SettingsView.as_view(), name="settings"),
    path("settings/landing/", LandingContentAdminView.as_view(), name="landing-settings"),
]
```

`apps.organization.urls` is already mounted at `path("", …)` in `backend/config/api_urls.py:15` — **no change there**.

### 6 — Django admin

**File: `backend/apps/organization/admin.py`**

Register both models following whatever registration style that file already uses for `OrganizationSettings`/`Department`/`Branch` — read it first and match it. `LandingHighlight` gets `list_display = ("title_en", "icon", "order")` and `ordering = ("order", "id")`.

---

## Frontend Tasks

### 7 — New shared module: `src/shared/landing/`

**This module exists because of `no-restricted-imports`** (`frontend/.oxlintrc.json:8-19`): `features/organization/`'s preview must render the same components as `features/landing/`, and a feature may not import from another feature. Structurally a copy of `src/shared/branding/`.

**Create file: `frontend/src/shared/landing/types.ts`**

```ts
/** Mirrors `apps.organization.serializers.PublicLandingContentSerializer`'s
 * read shape. Lives in `shared/`, not `features/landing/`, because
 * `features/organization/`'s editor preview renders the same sections and
 * `no-restricted-imports` forbids the cross-feature import
 * (CONVENTIONS.md §15). Same reasoning `shared/branding/types.ts` records. */
export type LandingContent = {
  hero_headline_en: string
  hero_headline_ar: string
  hero_value_proposition_en: string
  hero_value_proposition_ar: string
  hero_primary_cta_label_en: string
  hero_primary_cta_label_ar: string
  hero_primary_cta_target: string
  hero_secondary_cta_label_en: string
  hero_secondary_cta_label_ar: string
  hero_secondary_cta_target: string
  features_title_en: string
  features_title_ar: string
  cta_title_en: string
  cta_title_ar: string
  cta_subtitle_en: string
  cta_subtitle_ar: string
  cta_label_en: string
  cta_label_ar: string
  cta_target: string
  footer_text_en: string
  footer_text_ar: string
  highlights: LandingHighlight[]
}

export type LandingHighlight = {
  id: number
  title_en: string
  title_ar: string
  description_en: string
  description_ar: string
  icon: string
  order: number
}

/** What the RESOLVED page renders — every string already merged against the
 * i18n bundle default and already narrowed to the active locale. The
 * section components take only this; they never see `_en`/`_ar` or an
 * empty string. */
export type ResolvedLanding = {
  heroHeadline: string
  heroValueProposition: string
  primaryCta: { label: string; to: string }
  secondaryCta: { label: string; to: string }
  featuresTitle: string
  highlights: { key: string; title: string; description: string; icon: string }[]
  ctaTitle: string
  ctaSubtitle: string
  ctaLabel: string
  ctaTo: string
  footerText: string
}
```

**Create file: `frontend/src/shared/landing/config.ts`**

```ts
import {
  BarChart3Icon,
  BellIcon,
  ClockIcon,
  FileTextIcon,
  GlobeIcon,
  InboxIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TimerIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * The landing contract. Everything else imports from here — the same role
 * `shared/branding/config.ts` plays for branding.
 *
 * `LANDING_ICONS` mirrors `apps.organization.models.LandingHighlight.Icon`
 * key-for-key. Adding an icon is a two-file change: that enum and this map.
 */
export const LANDING_ICONS: Record<string, LucideIcon> = {
  inbox: InboxIcon,
  timer: TimerIcon,
  sparkles: SparklesIcon,
  'bar-chart-3': BarChart3Icon,
  'message-square': MessageSquareIcon,
  users: UsersIcon,
  'shield-check': ShieldCheckIcon,
  zap: ZapIcon,
  globe: GlobeIcon,
  clock: ClockIcon,
  'file-text': FileTextIcon,
  bell: BellIcon,
}

export const LANDING_ICON_KEYS = Object.keys(LANDING_ICONS) as [string, ...string[]]

/** An unknown key means the backend shipped a value this build has no
 * component for (a backend-first deploy). Degrade to a real icon rather
 * than rendering nothing where a card's icon should be. */
export function landingIcon(key: string): LucideIcon {
  return LANDING_ICONS[key] ?? InboxIcon
}

/** Mirrors `LandingContent.CtaTarget`. The value is what the API stores;
 * the path is where the CTA actually points. Every path is in
 * `app/router.tsx`'s public tree. */
export const LANDING_CTA_PATHS: Record<string, string> = {
  login: '/login',
  contact: '/contact',
  chat: '/chat',
}

export const LANDING_CTA_TARGETS = ['login', 'contact', 'chat'] as const

/** Where each CTA points when the admin has chosen nothing — the hard-coded
 * targets `LandingPage.tsx` carried before LAND-2 (`:53`, `:56`, `:89`). */
export const DEFAULT_CTA_PATHS = {
  heroPrimary: '/login',
  heroSecondary: '/contact',
  ctaBand: '/login',
} as const
```

**Create file: `frontend/src/shared/landing/landingKeys.ts`**

```ts
import { featureKey } from '@/shared/lib/api/queryKeys'

export const landingKeys = featureKey('landingContent')
```

**Create file: `frontend/src/shared/landing/fetchLandingContent.ts`**

```ts
import { api } from '@/shared/lib/api/client'

import type { LandingContent } from './types'

// The app's second unauthenticated GET from `src/`, after
// `shared/branding/fetchBranding.ts`. `/api/landing/` is `AllowAny`
// server-side, and the request interceptor (`shared/lib/api/client.ts`)
// attaches no `Authorization` header when no token exists.
export function fetchLandingContent(): Promise<LandingContent> {
  return api.get<LandingContent>('/landing/')
}
```

**Create file: `frontend/src/shared/landing/useLandingContent.ts`**

```ts
import { useQuery } from '@tanstack/react-query'

import { fetchLandingContent } from './fetchLandingContent'
import { landingKeys } from './landingKeys'

/**
 * The fetch half of landing content. `staleTime: Infinity` and NO
 * `meta.toastOnError`, for exactly the reasons `shared/branding/
 * useBranding.ts` records for itself: the content only changes when an
 * admin saves (which invalidates this key directly), and a failure must be
 * INVISIBLE — this runs on the product's front door for an anonymous
 * visitor, who gets the shipped bundle copy and no error at all.
 *
 * Callers must render from bundle defaults while `data` is undefined.
 * `resolveLanding(undefined, …)` returns exactly that.
 */
export function useLandingContent() {
  return useQuery({
    queryKey: landingKeys.resource('current'),
    queryFn: fetchLandingContent,
    staleTime: Infinity,
    retry: 1,
  })
}
```

**Create file: `frontend/src/shared/landing/resolve.ts`**

The **one place** blank-means-default is implemented. Signature:

```ts
import type { TFunction } from 'i18next'

import { isRtl } from '@/shared/i18n/config'

import { DEFAULT_CTA_PATHS, LANDING_CTA_PATHS } from './config'
import type { LandingContent, ResolvedLanding } from './types'

/** The four cards shipped in `features/landing/locales/{en,ar}.json` —
 * keys into that namespace, plus the icon each one had in
 * `LandingPage.tsx`'s `FEATURES` array before LAND-2. */
const BUNDLED_HIGHLIGHTS = [
  { key: 'tickets', icon: 'inbox' },
  { key: 'sla', icon: 'timer' },
  { key: 'ai', icon: 'sparkles' },
  { key: 'reports', icon: 'bar-chart-3' },
] as const

/**
 * Merges admin-set landing copy over the shipped i18n bundle, per field.
 *
 * `content` is `undefined` while the request is in flight, when it fails,
 * and on an organization that never opened the editor — all three collapse
 * to the same answer, which is why there is one parameter and not a status
 * flag. The landing page therefore never needs a loading state.
 *
 * `language` selects the `_en`/`_ar` half. It is passed in rather than read
 * from `i18next` here so the admin preview can force a locale.
 */
export function resolveLanding(
  content: LandingContent | undefined,
  language: string,
  t: TFunction,
): ResolvedLanding
```

Implementation rules, all of which the executor must follow exactly:

- A local `pick(en, ar)` helper returns `isRtl(language) ? ar : en`, then `.trim()`; a falsy result means "fall back".
- Every string field: `pick(...) || t('<bundle key>')`. The bundle keys are the ones in `frontend/src/features/landing/locales/en.json` — `hero.headline`, `hero.valueProposition`, `hero.login`, `hero.demo`, `features.sectionTitle`, `cta.title`, `cta.subtitle`, `cta.login`.
- **`footerText` is the one interpolated field**: `pick(footer_text_en, footer_text_ar)` falls back to `t('footer.copyright', { year: new Date().getFullYear() })`. When the admin value is non-blank, run it through the same interpolation — `t` cannot interpolate an arbitrary string, so do a literal `.replace('{{year}}', String(new Date().getFullYear()))` and comment why.
- CTA targets: `LANDING_CTA_PATHS[content?.hero_primary_cta_target ?? ''] ?? DEFAULT_CTA_PATHS.heroPrimary`. The double fallback covers both "blank" and "a target value this build does not know".
- Highlights: when `content?.highlights` is a non-empty array, map it to `{ key: String(h.id), title: pick(h.title_en, h.title_ar) || pick-the-other-locale || '', description: …, icon: h.icon }` and **drop any row whose resolved title is empty after both locales are tried** — a titleless card is worse than no card. When the array is empty or absent, map `BUNDLED_HIGHLIGHTS` through `t('features.<key>.title')` / `t('features.<key>.description')`.
- **A non-empty highlight table replaces the shipped four entirely.** Do not concatenate.
- `resolve.ts` imports nothing from `features/`. It reads the `landing` namespace through the `t` its caller passes.

**Create file: `frontend/src/shared/landing/Reveal.tsx`**

Move `frontend/src/features/landing/components/Reveal.tsx` here **verbatim**, then add one prop:

```tsx
export function Reveal({
  children,
  delayMs = 0,
  disabled = false,
}: {
  children: ReactNode
  delayMs?: number
  disabled?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [revealed, setRevealed] = useState(
    () => disabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  // …unchanged from here down
```

Extend the docstring: `disabled` exists for the admin preview (Task 11). The preview renders inside a bounded panel, and an `IntersectionObserver` keyed on the viewport can leave a section stuck at `opacity-0` there — an editor whose preview is blank is worse than an editor with no animation. **Delete the old file** and update no other import: `LandingPage.tsx` is rewritten in Task 9 anyway.

**Create file: `frontend/src/shared/landing/index.ts`** — the barrel. Export `useLandingContent`, `resolveLanding`, `landingKeys`, `LANDING_ICON_KEYS`, `LANDING_CTA_TARGETS`, the section components from Task 8, and the `LandingContent`/`LandingHighlight`/`ResolvedLanding` types. Do **not** re-export `fetchLandingContent` — nothing outside the module calls it, the same restraint `shared/branding/index.ts` shows.

### 8 — Move the landing presentation into `shared/landing/sections/`

**Create file: `frontend/src/shared/landing/sections/LandingSections.tsx`**

One file holding the four section components, each taking `ResolvedLanding` (or the slice it needs) plus `animate: boolean`. Lift the markup from `LandingPage.tsx` **unchanged** — same classes, same structure, same tokens:

- `LandingHero({ content, animate })` — from `LandingPage.tsx:43-60`. The wrapper's `animate-in fade-in slide-in-from-bottom-4 duration-700` (line 44) applies only when `animate`. Two `<Button asChild size="lg">` with `<Link to={content.primaryCta.to}>` / `secondaryCta`, the second `variant="outline"`.
- `LandingFeatures({ content, animate })` — from `:62-81`. Maps `content.highlights`, resolving each card's component with `landingIcon(highlight.icon)` and rendering it at `className="size-6 text-primary"`. `<Reveal key={highlight.key} delayMs={index * 80} disabled={!animate}>`.
- `LandingCtaBand({ content, animate })` — from `:83-110`. **Keep lines 92-107 exactly as they are**: the `auth:help.*` prompt and the two `/contact` / `/chat` links are shared with `LoginPage` and are not admin-editable. Wrap in `<Reveal disabled={!animate}>`.
- `LandingFooter({ content })` — from `:112-116`, rendering `content.footerText`.

**Every string in this file comes from `ResolvedLanding` or a `t()` call.** `react/jsx-no-literals` is `error` (`.oxlintrc.json:7`); grep the finished file by hand for the three patterns it misses (CONVENTIONS.md § 18).

**Logical properties only.** `npm run check:rtl` forbids `pl-`/`pr-`/`ml-`/`mr-`/`text-left`/`text-right`/`translate-x-` and friends. The lifted markup already complies (`ms-auto` at `LandingPage.tsx:33`); keep it that way.

### 9 — Rewire `LandingPage.tsx`

**File: `frontend/src/features/landing/components/LandingPage.tsx`**

Replace the whole file. It becomes a thin composition: header + the four shared sections.

```tsx
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { BrandMark } from '@/shared/branding'
import {
  LandingCtaBand,
  LandingFeatures,
  LandingFooter,
  LandingHero,
  resolveLanding,
  useLandingContent,
} from '@/shared/landing'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { Button } from '@/shared/ui/primitives/button'

/**
 * The public front door at `/` (Story 86, `LAND-1`), now rendering
 * admin-editable copy (Story 94, `LAND-2`). Reachable with no session —
 * `RedirectAuthenticated` (`shared/auth`) sends a signed-in visitor
 * straight to `/home` before this ever renders.
 *
 * NO LOADING STATE, deliberately. `useLandingContent()` returns
 * `undefined` while in flight and on failure, and `resolveLanding` turns
 * both into the shipped bundle copy — so the hero paints on the first
 * frame with real content and is REPLACED by admin copy if and when the
 * request lands. A spinner on a first-time visitor's first impression is
 * the thing this shape exists to prevent (LAND-2's own constraint).
 *
 * The presentation itself lives in `shared/landing/sections/` so the admin
 * editor's live preview renders the same components rather than a second
 * copy of this markup that drifts (`no-restricted-imports`, §15).
 */
export function LandingPage() {
  const { t, i18n } = useTranslation(['landing', 'common', 'auth'])
  const { data } = useLandingContent()
  const content = resolveLanding(data, i18n.language, t)

  return (
    <div className="flex flex-col">
      <header className="border-b">
        <div className="container mx-auto flex flex-wrap items-center gap-4 px-4 py-3">
          <BrandMark />
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button asChild size="sm">
              <Link to={content.primaryCta.to}>{content.primaryCta.label}</Link>
            </Button>
          </div>
        </div>
      </header>
      <LandingHero content={content} animate />
      <LandingFeatures content={content} animate />
      <LandingCtaBand content={content} animate />
      <LandingFooter content={content} />
    </div>
  )
}
```

The `landing` locale JSON files stay exactly where they are and are **not edited** — they are the permanent fallback, and `resources.ts` needs no change.

### 10 — Admin API layer

**Create files under `frontend/src/features/organization/api/`**, matching the naming already there (`getSettings.ts` / `updateSettings.ts` / `useSettings.ts` / `useUpdateSettings.ts` / `settingsKeys.ts`):

- `landingKeys.ts` — `export const landingContentKeys = featureKey('landingContentAdmin')`. **A different key from `shared/landing/landingKeys.ts`**: that one caches the public payload; this one caches the admin payload. Add a comment saying so, and saying that the mutation must invalidate **both**.
- `getLandingContent.ts` / `updateLandingContent.ts` — `api.get`/`api.patch` against `'/settings/landing/'`.
- `useLandingContent.ts` — **name it `useLandingContentAdmin`** to avoid shadowing the shared hook in a reader's head.
- `useUpdateLandingContent.ts` — the mutation. `onSuccess` invalidates `landingContentKeys.all` **and** `landingKeys.all` from `@/shared/landing`, for exactly the reason `useUpdateSettings.ts:15-21` invalidates `brandingKeys.all`: without it an admin saves and the running app keeps the old copy until a reload.
- `getLandingHighlightList.ts`, `getLandingHighlight.ts`, `createLandingHighlight.ts`, `updateLandingHighlight.ts`, `deleteLandingHighlight.ts` against `'/landing-highlights/'`, plus `useLandingHighlightList.ts`, `useLandingHighlight.ts`, `useLandingHighlightMutations.ts`. Copy `useDepartmentMutations.ts` exactly, and add the same `landingKeys.all` invalidation to all three write hooks — a new highlight must show on the public page without a reload.

**Create file: `frontend/src/features/organization/types/landing.ts`** — `LandingContentAdmin` (the shared `LandingContent` fields minus `highlights`, plus `id`/`created_at`/`updated_at`), `LandingContentInput`, `LandingHighlightRow`, `LandingHighlightInput`. Import the shared `LandingHighlight` type from `@/shared/landing` rather than redeclaring the six columns.

### 11 — The editor page with live preview

**Create file: `frontend/src/features/organization/components/LandingContentPage.tsx`**

Structure, copying `SettingsPage.tsx:81-180`:

- Zod schema: every string field `optionalString(n).transform((value) => value ?? '')` with `n` matching the model's `max_length` (200/60/120; the three `TextField`-backed long fields are `TextField` on a `TextField` server column and `TextareaField` on a `models.TextField` — cap those at 2000 client-side). The three target fields: `choice(LANDING_CTA_TARGETS).or(z.literal(''))`. **`.transform(… ?? '')` is required on every one** — these are `blank=True` and non-nullable server-side (CONVENTIONS.md § 23's table; the comment at `DepartmentFormPage.tsx:21-23`).
- `useAppForm({ schema, defaultValues: toDefaults(content) })`.
- Layout: `<QueryBoundary query={query}>` at the top, then `PageHeader`, then a **two-column grid at `lg:` and stacked below** — `grid gap-4 lg:grid-cols-2`. Left: the form. Right: the preview, `sticky top-4` inside its own bordered container.
- The form body is **two `Card`s per section, one per locale**, following `ArticleFormPage.tsx:165-200`: an English card and an Arabic card, `CardHeader`/`CardTitle` naming each, and `dir="auto"` on **every** Arabic input. Group by landing section (Hero / Highlights title / CTA band / Footer) so the page reads in the order the visitor sees.
- The three CTA-target `SelectField`s take `options` built from `LANDING_CTA_TARGETS` with a translated label each, plus a first `{ value: '', label: t('landing.fields.defaultTarget') }` sentinel.
- `FormErrorSummary` + `SubmitButton` at the bottom, exactly as `SettingsPage.tsx:174-175`. `applyServerErrors(form, error)` on a validation error, `toast({ tone: 'success', … })` on save.
- A link into the highlight list page (Task 12), since highlights are rows and not fields on this form.

**The preview.** A `<LandingPreview>` component in the same file:

```tsx
const draft = form.watch()
```

`form.watch()` with no argument returns the whole draft and re-renders on every keystroke — the same call `SettingsPage.tsx:105` makes for the colour swatch, and its comment at 99-104 applies here verbatim: **do not push the draft into the shared query cache**; the running app repaints on save, via the mutation's invalidation.

Then:

```tsx
const preview = resolveLanding(toPreviewContent(draft, highlights), previewLanguage, t)
```

- `toPreviewContent` assembles a `LandingContent`-shaped object from the draft plus the **saved** highlight rows (highlights are edited on their own page, so they are not part of this form's draft).
- `previewLanguage` is local `useState` initialised to `i18n.language`, with a small two-button toggle so the admin can check the Arabic half without switching the whole app. When it differs from the app language, wrap the preview in `<div dir={isRtl(previewLanguage) ? 'rtl' : 'ltr'}>` — `shared/i18n/direction.ts` is the only writer of `<html dir>` and this must not become a second one.
- The preview renders **the real components**: `<LandingHero content={preview} animate={false} />`, `<LandingFeatures … animate={false} />`, `<LandingCtaBand … animate={false} />`, `<LandingFooter content={preview} />`. `animate={false}` is what Task 7's `Reveal disabled` prop exists for.
- Theme needs nothing: the sections use `bg-card`/`text-muted-foreground`/`bg-primary` tokens, which already follow `.dark` on the root.
- Scale the preview down with `origin-top scale-90` inside an `overflow-x-auto` container so a `container mx-auto` section does not force the settings page to scroll sideways. **No `scale-x-`/`translate-x-`** — `check:rtl` forbids the latter and `scale-90` is uniform, so neither is directional.

### 12 — Highlight list and form pages

**Create file: `frontend/src/features/organization/components/LandingHighlightListPage.tsx`** — a direct copy of `DepartmentListPage.tsx` (all 126 lines) with these differences:

- `useServerTable({ initialSort: { field: 'order', direction: 'asc' } })`.
- Columns: `order` (sortable — it is in `ordering_fields`), `title_en` (sortable, `TableLink` to `/settings/landing/highlights/${row.id}/edit`), `title_ar` (**not** sortable, `priority: 'sm'`, `dir="auto"`), `icon` (not sortable — render the actual `landingIcon(row.icon)` component at `size-4`, not the raw string), `actions` (`DeleteRowButton` inside `<Can permission="settings.manage">`).
- `Empty` copy must say that an empty list means the four shipped cards still render — an admin who deletes every row and sees the old cards on `/` must not think the delete failed.

**Create file: `frontend/src/features/organization/components/LandingHighlightFormPage.tsx`** — a copy of `DepartmentFormPage.tsx`'s create/edit-in-one-component shape:

- Schema: `title_en`/`title_ar` `requiredString(120)`, `description_en`/`description_ar` `requiredString(2000)`, `icon: choice(LANDING_ICON_KEYS)`, `order: z.coerce.number().int().min(0).max(9999)`. **Use the literal `z.coerce…` form, not `positiveInt()`** — see the comment at `FaqFormPage.tsx:30` explaining that `positiveInt()` floors at 1 while `order` defaults to 0.
- Two locale `Card`s as in Task 11, `dir="auto"` on the Arabic inputs.
- The icon `SelectField`'s options come from `LANDING_ICON_KEYS`, each label translated under `organization:landing.icons.<key>`.

### 13 — Routes, nav, and i18n keys

**File: `frontend/src/app/router.tsx`**

Add three routes **inside the existing `settings.manage` `RequirePermission` block at lines 505-517**, after the `path: 'settings'` entry. All three use `settings.manage`, so unlike `departments` there is **no** view/manage split and no second guard block.

```tsx
{
  path: 'settings/landing',
  lazy: async () => {
    const { LandingContentPage } =
      await import('@/features/organization/components/LandingContentPage')
    return { element: <LandingContentPage /> }
  },
},
{
  // Must stay before `settings/landing/highlights/:id/edit`, the same
  // declaration order `settings/departments/new` uses.
  path: 'settings/landing/highlights',
  lazy: async () => { /* LandingHighlightListPage */ },
},
{ path: 'settings/landing/highlights/new', lazy: /* LandingHighlightFormPage */ },
{ path: 'settings/landing/highlights/:id/edit', lazy: /* LandingHighlightFormPage */ },
```

**File: `frontend/src/app/Sidebar.tsx`** — add one `<Can permission="settings.manage">`-wrapped `SidebarLink` to `/settings/landing` immediately after the `/settings` link (lines 360-367), with a `lucide-react` icon (`LayoutTemplateIcon`) added to the existing import. **`showAdministration` (lines 172-181) needs no change** — `can('settings.manage')` is already line 176.

**Files: `frontend/src/features/organization/locales/en.json` and `ar.json`** — add a `landing` block covering: `title`, `navLabel`, `saved`, `sections.{hero,highlights,cta,footer}`, `sections.{english,arabic}`, `fields.*` (one per form field), `fields.defaultTarget`, `targets.{login,contact,chat}`, `preview.{title,language}`, `icons.*` (one per `LANDING_ICON_KEYS` entry), and a `highlights` block mirroring the shape of the existing `departments` block (lines 17-42 of `en.json`) — `title`, `new`, `edit`, `search`, `searchPlaceholder`, `empty`, `emptyDescription`, `noSearchResults`, `created`, `updated`, `fields.*`, `actions.*`, `delete.{title,description}`.

**Every key added to `en.json` must exist in `ar.json`** (CONVENTIONS.md § 18). No new namespace is registered — these keys live under the existing `organization` namespace.

---

## Edge Cases & Failure Modes

- **`GET /api/landing/` fails, times out, or the visitor is offline.** `useLandingContent`'s `data` stays `undefined`; `resolveLanding(undefined, …)` returns the full bundle copy; the page renders today's content. No toast (no `meta.toastOnError` — `frontend/src/shared/landing/useLandingContent.ts`), no error boundary, no spinner. Enforced by `LandingPage.tsx` having **no** `isPending` branch at all.
- **The request is still in flight on first paint.** Identical path to the failure case — same `undefined`, same bundle render. When it lands, React re-renders with admin copy. Accept the content swap: it is strictly better than a spinner where the headline goes.
- **A never-edited organization.** `LandingContent.load()` creates the row with every field `""` and `highlights: []`, so the payload is all-blank and `resolveLanding` returns pure bundle copy. Enforced by `load()` (`backend/apps/organization/models.py`, the `get_or_create(pk=1)` copy).
- **Admin fills English only.** `pick()` in `resolve.ts` returns `''` for `ar`, so the Arabic visitor gets the shipped Arabic string while the English visitor gets the override. **This is the designed behaviour, not a bug** — it is exactly what the intake's "or the Arabic side silently freezes" constraint asks for. The editor's per-locale cards make the gap visible.
- **Admin sets a CTA target this build does not know** (a value added to `LandingContent.CtaTarget` and deployed backend-first). `LANDING_CTA_PATHS[value] ?? DEFAULT_CTA_PATHS.*` in `resolve.ts` falls through to `/login`. The CTA works; it just points at the old destination.
- **Admin sets an icon this build does not know**, same deploy-order scenario. `landingIcon()` in `shared/landing/config.ts` returns `InboxIcon`. The card renders with a generic icon rather than a hole where an icon belongs.
- **A highlight row with a blank title in both locales.** Server-side impossible — `title_en`/`title_ar` are required (no `blank=True`), so DRF 400s. `resolve.ts` drops such a row anyway, because the Django admin can write one directly.
- **Every highlight deleted.** `highlights: []` → the four bundled cards render. An admin who wanted an empty section instead cannot express that, and that is deliberate: an empty features band on the front door is worse than four accurate defaults. The list page's `emptyDescription` copy must say so (Task 12).
- **Admin footer text with no `{{year}}`.** The literal `.replace('{{year}}', …)` in `resolve.ts` is a no-op and the string renders as typed.
- **Admin footer text containing `{{something_else}}`.** Renders literally — `resolve.ts` replaces only `{{year}}` and never calls `t()` on an admin string, so there is no i18next interpolation path an admin can reach. This is the reason for the literal `.replace` rather than `t(adminString)`.
- **Anon throttle budget.** `/` now makes **two** anonymous GETs (`/api/branding/` via `<BrandingSync>`, `/api/landing/` via this page) against a **shared** `anon: 300/hour` per-IP bucket (`backend/config/settings/base.py:333`). A NAT'd office therefore halves its effective landing-page budget. Neither view declares `throttle_classes` (which would replace the baseline rather than stack — CONVENTIONS.md § 36), and 150 landing loads/hour/IP is well clear of real use. **Do not "fix" this by merging the two payloads** — see `LandingContentView`'s docstring.
- **`NUM_PROXIES` misconfigured behind a load balancer.** Every IP-keyed throttle, including the two above, keys on the wrong address. Pre-existing and documented in CONVENTIONS.md § 36; unchanged by this story, but it is the reason a 429 on `/api/landing/` in staging is an infrastructure symptom, not a landing bug.
- **Preview panel and `Reveal`.** Without `animate={false}`, a section scrolled out of the preview panel's own bounds can sit at `opacity-0` forever, because `Reveal`'s `IntersectionObserver` uses the default (viewport) root. `disabled` short-circuits the initial state to `revealed` and never registers an observer.
- **Preview locale differs from app locale.** The preview wraps in a local `dir` attribute. `shared/i18n/direction.ts` remains the only writer of `<html dir>`; the preview must not call it.
- **Two admins editing at once.** `PATCH /api/settings/landing/` is last-write-wins on a `partial=True` serializer, so each admin overwrites only the fields their form submitted — the same concurrency posture `SettingsView.patch` (`backend/apps/organization/views.py:124-129`) already has. No locking is added.
- **`OrganizationSettings` is untouched.** After this story, `git diff` on `backend/apps/organization/serializers.py` must show **zero** changes inside `OrganizationSettingsSerializer` (lines 63-109) and `BrandingSerializer` (37-60). If either moved, the intake's central constraint was violated.

---

## Test Plan

**This project does not author automated tests** — CONVENTIONS.md § 16: "Changes are verified by running the commands in `README.md` and driving the app directly. The 54 backend tests under `backend/apps/core/tests/` and `backend/config/tests/` predate this policy and are kept, but they are not extended and no new test file is added anywhere in the repo."

**No test file is added, modified, or removed by this story.** Verification is the manual sequence in `## Verification Steps` below. Do not create `backend/apps/organization/tests/`.

---

## Migration / Rollback

**Forward.** One schema migration, `0012_landing_content`, creating two new tables. It touches no existing table, adds no column to `organizationsettings`, drops nothing, and backfills nothing — so it is safe to apply against a live database and needs no downtime.

**Half-applied states, in deploy order:**

- **Migration applied, new code not yet deployed.** Two empty tables nothing reads. Zero user-visible effect.
- **Backend deployed, frontend still old.** `/api/landing/` answers and nobody calls it. The old bundle-only `LandingPage.tsx` renders exactly as before. This is the **safe deploy order** — use it.
- **Frontend deployed, backend still old.** `/api/landing/` 404s → `useLandingContent` errors → `data` is `undefined` → `resolveLanding` returns bundle copy → the landing page renders today's content with no toast and no error. **This is the failure mode the whole fallback design exists for**, and it degrades silently by construction. The admin editor at `/settings/landing`, however, will show `QueryBoundary`'s error state, since it has no fallback and should not have one.

**Rollback.** Revert the frontend and backend deploys; leave `0012` applied. The two tables become inert and the page returns to bundle copy, with any admin-entered text preserved for a re-roll-forward. Only if the models themselves must go: `python manage.py migrate organization 0011` drops both tables and **destroys the admin-entered copy**, which is unrecoverable — take a dump first.

**One-way door to name explicitly:** removing a value from `LandingHighlight.Icon` or `LandingContent.CtaTarget` after admins have selected it leaves orphaned rows. The frontend's `landingIcon()` / `LANDING_CTA_PATHS` fallbacks keep the page rendering, but the admin form's `SelectField` will show no selection for that row. Prefer adding values over removing them.

---

## Verification Steps

1. **Backend migrates:** in `backend/`, `python manage.py makemigrations organization --check --dry-run` reports no pending changes after `0012` is committed, and `python manage.py migrate` applies cleanly.
2. **Backend lints:** in `backend/`, `ruff check .` and `ruff format --check .` pass. Import order (stdlib → third-party → `apps`/`config` → relative) is what `I` enforces in the three edited modules.
3. **Public read works with no session:** with the dev server up, `curl -i http://localhost:8000/api/landing/` returns **200** with every field `""` and `"highlights": []` on a fresh database. Repeat with a deliberately malformed header — `curl -i -H "Authorization: Bearer garbage" http://localhost:8000/api/landing/` must still be **200**, not 401. That is what `authentication_classes = []` buys.
4. **Admin write is gated:** `curl -i -X PATCH http://localhost:8000/api/settings/landing/` with no token returns **401**; with an `agent` account's token returns **403**; with an `admin` token and `-d '{"hero_headline_en":"Hello"}'` returns **200**. `GET /api/landing-highlights/` follows the same three answers.
5. **The narrow-public contract held:** `git diff backend/apps/organization/serializers.py` shows **no** hunk inside `BrandingSerializer` or `OrganizationSettingsSerializer`. `curl http://localhost:8000/api/branding/` still returns exactly `name`, `logo_url`, `primary_color` — three keys, no more.
6. **Frontend type-checks and lints:** in `frontend/`, `npm run typecheck`, `npm run lint`, and `npm run check:rtl` all pass. `check:rtl` is the one that catches a `pl-`/`ml-`/`text-left` slipping into the moved section markup.
7. **Frontend runs — the fallback path:** `npm run dev`, sign out, open `/`. With the backend **stopped**, the page renders the shipped English copy and the four shipped cards, with **no spinner in the hero** and **no error toast**. Switch to Arabic via the header switcher — the Arabic bundle copy renders RTL. This is the single most important check in this list.
8. **Frontend runs — the edit path:** restart the backend, sign in as an admin, go to `/settings/landing`. Change the hero headline (English), watch the preview update as you type, save, then open `/` in a signed-out window: the new headline is live with no rebuild. Confirm the Arabic half of `/` still shows the **shipped** Arabic headline.
9. **Highlights:** at `/settings/landing/highlights`, add three cards with distinct icons and orders `0`, `1`, `2`. `/` shows exactly those three, in that order, replacing the shipped four. Delete all three — `/` returns to the shipped four.
10. **Preview fidelity:** on `/settings/landing`, toggle the preview's language to Arabic while the app is in English; the preview flips to RTL and the rest of the page does not. Toggle the app theme; the preview follows. Confirm every preview section is **visible** (no `opacity-0` ghosts) — that is the `animate={false}` check.
11. **Guard check:** sign in as an `agent` (no `settings.manage`) and navigate directly to `/settings/landing`. `RequirePermission` redirects to `/home`; the sidebar shows no landing link.
12. **Regression — Story 86 untouched:** `/` still redirects a signed-in staff account to `/home`; `/login`, `/contact`, `/chat` still render centred cards in `PublicLayout`; the hero entrance animation still plays for a signed-out visitor with motion enabled and is collapsed under `prefers-reduced-motion` (DevTools → Rendering → Emulate CSS `prefers-reduced-motion`).
13. **Regression — `/settings` unchanged:** the org settings form still saves name, logo URL, brand colour and the two SLA targets, and the colour swatch still previews. No landing field appears on it.

---

## Done Criteria

- [ ] `LandingContent` (singleton, `pk=1`, `load()`/`save()`/`delete()` copied from `OrganizationSettings`) and `LandingHighlight` (ordered, `Icon` `TextChoices`, no `JSONField`) exist in `backend/apps/organization/models.py`, and migration `0012_landing_content` applies cleanly.
- [ ] Every landing string is stored as a `_en`/`_ar` pair, mirroring `knowledge_base.Article` — no JSON blob, no translation package, no second bilingual pattern.
- [ ] `GET /api/landing/` is public: 200 with no session, 200 with a malformed `Authorization` header, and it serves a **separate, narrower** serializer from the admin one.
- [ ] `OrganizationSettingsSerializer` and `BrandingSerializer` are **byte-for-byte unchanged**.
- [ ] Writes go through `PATCH /api/settings/landing/` and `/api/landing-highlights/`, both under `settings.manage`; **no new permission string and no permission-grant migration**.
- [ ] `LandingPage.tsx` renders admin copy when present and the `landing/locales/{en,ar}.json` string when not, per field, choosing the locale half matching the active language.
- [ ] With the backend down, `/` renders today's page — full copy, four cards, no spinner in the hero, no error toast.
- [ ] With zero highlight rows, `/` renders the four shipped cards; with rows, it renders exactly those, ordered by `order` then `id`.
- [ ] Highlight icons come from a fixed curated `lucide-react` set enforced on both sides (`LandingHighlight.Icon` and `LANDING_ICON_KEYS`); an unknown key degrades to a real icon instead of a blank.
- [ ] CTA targets come from a fixed set of existing public routes; an unknown value falls back to the route hard-coded before this story.
- [ ] The editor lives at `/settings/landing` behind `settings.manage`, uses RHF + Zod with `FormErrorSummary` and `applyServerErrors`, and is a **separate route** from the org settings form — no landing fields were appended to `SettingsPage.tsx`.
- [ ] The live preview renders the **same** `shared/landing/sections/` components the public page does — no forked copy of the landing markup exists anywhere — and honours the previewed locale and the active theme.
- [ ] Every new `en.json` key has an `ar.json` counterpart; `npm run typecheck`, `npm run lint`, `npm run check:rtl`, `ruff check .`, and `ruff format --check .` all pass.
- [ ] No test file was added, changed, or removed (CONVENTIONS.md § 16).

---

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 95.**
