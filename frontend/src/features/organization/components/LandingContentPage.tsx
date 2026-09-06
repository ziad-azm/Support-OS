import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { isRtl } from '@/shared/i18n/config'
import {
  LANDING_CTA_TARGETS,
  isCtaTarget,
  LandingCtaBand,
  LandingFeatures,
  LandingFooter,
  LandingHero,
  resolveLanding,
} from '@/shared/landing'
import type { LandingContent, LandingHighlight, LandingSocialLink } from '@/shared/landing'
import { choice, optionalString } from '@/shared/validation/schemas'
import { applyServerErrors, isValidationError } from '@/shared/validation/serverErrors'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Form } from '@/shared/ui/primitives/form'
import {
  FormErrorSummary,
  SelectField,
  SubmitButton,
  TextField,
  TextareaField,
  useAppForm,
} from '@/shared/ui/form'
import { PageHeader } from '@/shared/ui/PageHeader'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useLandingContentAdmin } from '../api/useLandingContentAdmin'
import { useLandingHighlightList } from '../api/useLandingHighlightList'
import { useLandingSocialLinkList } from '../api/useLandingSocialLinkList'
import { useUpdateLandingContent } from '../api/useUpdateLandingContent'
import type { LandingContentAdmin, LandingContentInput } from '../types/landing'

// Every field is `blank=True` and NOT nullable on the server, so a cleared
// input must round-trip as `''`, never `null` — hence `.transform(… ?? '')`
// on each one (CONVENTIONS.md §23's `optionalString`/`nullableString` table,
// and the comment `DepartmentFormPage.tsx` records for `description`).
//
// The `max` on each mirrors the model's own `max_length`; the two `TextField`
// server columns (`hero_value_proposition_*`, `cta_subtitle_*`) are uncapped
// in the database and get a generous client-side ceiling instead.
const shortText = (max: number) => optionalString(max).transform((value) => value ?? '')
const longText = shortText(2000)
// A blank target means "keep the CTA pointing where it pointed before LAND-2"
// — `resolveLanding` turns it into the shipped default path.
const ctaTarget = z.union([z.literal(''), choice(LANDING_CTA_TARGETS)])

// A literal tuple, not `string[]`: that is what lets the template-literal
// `t()` key below typecheck against the strict i18next resource map.
const PREVIEW_LANGUAGES = ['en', 'ar'] as const

const schema = z
  .object({
    hero_headline_en: shortText(200),
    hero_headline_ar: shortText(200),
    hero_value_proposition_en: longText,
    hero_value_proposition_ar: longText,
    hero_image_url: shortText(500),
    hero_primary_cta_label_en: shortText(60),
    hero_primary_cta_label_ar: shortText(60),
    hero_primary_cta_target: ctaTarget,
    hero_secondary_cta_label_en: shortText(60),
    hero_secondary_cta_label_ar: shortText(60),
    hero_secondary_cta_target: ctaTarget,
    features_title_en: shortText(200),
    features_title_ar: shortText(200),
    cta_title_en: shortText(200),
    cta_title_ar: shortText(200),
    cta_subtitle_en: longText,
    cta_subtitle_ar: longText,
    cta_label_en: shortText(60),
    cta_label_ar: shortText(60),
    cta_target: ctaTarget,
    footer_text_en: shortText(200),
    footer_text_ar: shortText(200),
  })
  // `hero_image_url` gets the same non-empty-only format check
  // `SettingsPage.tsx`'s `logo_url` uses: `z.url()`'s own translated error
  // reused rather than a new message, only when the field is non-empty —
  // it stays optional (Story 96).
  .superRefine((data, ctx) => {
    if (data.hero_image_url !== '') {
      const result = z.url().safeParse(data.hero_image_url)
      if (!result.success) {
        for (const issue of result.error.issues) {
          ctx.addIssue({ ...issue, path: ['hero_image_url'] })
        }
      }
    }
  })

type FormValues = z.output<typeof schema>

function toDefaults(content: LandingContentAdmin): FormValues {
  const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...fields } = content
  return {
    ...fields,
    // The API types these as plain `string` on purpose — a backend-first
    // deploy can store a `CtaTarget` this bundle has never heard of. Narrow
    // to `''` ("default destination") rather than feeding the `Select` a
    // value with no matching option, which renders as blank with no
    // explanation.
    hero_primary_cta_target: asTarget(fields.hero_primary_cta_target),
    hero_secondary_cta_target: asTarget(fields.hero_secondary_cta_target),
    cta_target: asTarget(fields.cta_target),
  }
}

function asTarget(value: string): FormValues['cta_target'] {
  return isCtaTarget(value) ? value : ''
}

function toLandingContentInput(values: FormValues): LandingContentInput {
  return { ...values }
}

/** The draft form values plus the SAVED highlight rows, shaped like the
 * public payload so the preview can go through the exact same
 * `resolveLanding` the live page uses. Highlights are edited on their own
 * screen, so they are not part of this form's draft. */
function toPreviewContent(
  values: FormValues,
  highlights: LandingHighlight[],
  socialLinks: LandingSocialLink[],
): LandingContent {
  return { ...values, highlights, social_links: socialLinks }
}

/**
 * The landing-page CMS — LAND-2, Story 94. Its own route rather than more
 * fields on `SettingsPage`: that form is already long, and landing copy is a
 * different job from branding and SLA defaults. Gated on `settings.manage`
 * in `app/router.tsx` — org marketing copy is admin-only by intent.
 */
export function LandingContentPage() {
  const query = useLandingContentAdmin()
  return (
    <div className="flex flex-col gap-4">
      <QueryBoundary query={query}>
        {(content) => <LandingContentForm content={content} />}
      </QueryBoundary>
    </div>
  )
}

function LandingContentForm({ content }: { content: LandingContentAdmin }) {
  const { t, i18n } = useTranslation('organization')
  const { toast } = useToast()
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [previewLanguage, setPreviewLanguage] = useState(i18n.language)
  const mutation = useUpdateLandingContent()

  // The preview renders the SAVED highlights against the DRAFT copy. A large
  // page size because the landing page renders every card, not a page of
  // them — this list is a handful of rows by nature.
  const highlightsQuery = useLandingHighlightList({ page: 1, page_size: 100, ordering: 'order' })
  // The preview also shows enabled+disabled social links exactly as the
  // highlight preview does — a handful of rows by nature, so one
  // large page rather than the admin table's server pagination.
  const socialLinksQuery = useLandingSocialLinkList({ page: 1, page_size: 100, ordering: 'order' })

  const form = useAppForm({ schema, defaultValues: toDefaults(content) })
  // Re-renders this component on every keystroke so the preview follows the
  // draft — the same `form.watch()` pattern `SettingsPage.tsx`'s colour
  // swatch uses, and the same restraint: it does NOT push into the shared
  // query cache. The live app repaints on save, via the mutation's
  // invalidation of `landingKeys`.
  const draft = form.watch()

  function onSubmit(values: FormValues) {
    mutation.mutate(toLandingContentInput(values), {
      onSuccess: () => toast({ tone: 'success', message: t('landing.saved') }),
      onError: (error) => {
        if (isValidationError(error)) {
          setFormErrors(applyServerErrors(form, error))
        }
      },
    })
  }

  const targetOptions = [
    { value: '', label: t('landing.fields.defaultTarget') },
    ...LANDING_CTA_TARGETS.map((value) => ({
      value,
      label: t(`landing.targets.${value}`),
    })),
  ]

  return (
    <>
      <PageHeader
        title={t('landing.title')}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/settings/landing/highlights">{t('landing.manageHighlights')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/settings/landing/social">{t('landing.manageSocial')}</Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('landing.sections.heroEnglish')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TextField
                  control={form.control}
                  name="hero_headline_en"
                  label={t('landing.fields.headline')}
                  description={t('landing.blankHint')}
                />
                <TextareaField
                  control={form.control}
                  name="hero_value_proposition_en"
                  label={t('landing.fields.valueProposition')}
                />
                <TextField
                  control={form.control}
                  name="hero_primary_cta_label_en"
                  label={t('landing.fields.primaryCtaLabel')}
                />
                <TextField
                  control={form.control}
                  name="hero_secondary_cta_label_en"
                  label={t('landing.fields.secondaryCtaLabel')}
                />
                <TextField
                  control={form.control}
                  name="features_title_en"
                  label={t('landing.fields.featuresTitle')}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('landing.sections.heroArabic')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TextField
                  control={form.control}
                  name="hero_headline_ar"
                  label={t('landing.fields.headline')}
                  dir="auto"
                />
                <TextareaField
                  control={form.control}
                  name="hero_value_proposition_ar"
                  label={t('landing.fields.valueProposition')}
                  dir="auto"
                />
                <TextField
                  control={form.control}
                  name="hero_primary_cta_label_ar"
                  label={t('landing.fields.primaryCtaLabel')}
                  dir="auto"
                />
                <TextField
                  control={form.control}
                  name="hero_secondary_cta_label_ar"
                  label={t('landing.fields.secondaryCtaLabel')}
                  dir="auto"
                />
                <TextField
                  control={form.control}
                  name="features_title_ar"
                  label={t('landing.fields.featuresTitle')}
                  dir="auto"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('landing.sections.ctaEnglish')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TextField
                  control={form.control}
                  name="cta_title_en"
                  label={t('landing.fields.ctaTitle')}
                />
                <TextareaField
                  control={form.control}
                  name="cta_subtitle_en"
                  label={t('landing.fields.ctaSubtitle')}
                />
                <TextField
                  control={form.control}
                  name="cta_label_en"
                  label={t('landing.fields.ctaLabel')}
                />
                <TextField
                  control={form.control}
                  name="footer_text_en"
                  label={t('landing.fields.footerText')}
                  description={t('landing.yearHint')}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('landing.sections.ctaArabic')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TextField
                  control={form.control}
                  name="cta_title_ar"
                  label={t('landing.fields.ctaTitle')}
                  dir="auto"
                />
                <TextareaField
                  control={form.control}
                  name="cta_subtitle_ar"
                  label={t('landing.fields.ctaSubtitle')}
                  dir="auto"
                />
                <TextField
                  control={form.control}
                  name="cta_label_ar"
                  label={t('landing.fields.ctaLabel')}
                  dir="auto"
                />
                <TextField
                  control={form.control}
                  name="footer_text_ar"
                  label={t('landing.fields.footerText')}
                  dir="auto"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('landing.sections.targets')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <TextField
                  control={form.control}
                  name="hero_image_url"
                  label={t('landing.fields.heroImageUrl')}
                  description={t('landing.heroImageHint')}
                />
                <SelectField
                  control={form.control}
                  name="hero_primary_cta_target"
                  label={t('landing.fields.primaryCtaTarget')}
                  options={targetOptions}
                />
                <SelectField
                  control={form.control}
                  name="hero_secondary_cta_target"
                  label={t('landing.fields.secondaryCtaTarget')}
                  options={targetOptions}
                />
                <SelectField
                  control={form.control}
                  name="cta_target"
                  label={t('landing.fields.ctaTarget')}
                  options={targetOptions}
                />
              </CardContent>
            </Card>

            <FormErrorSummary errors={formErrors} />
            <SubmitButton pending={mutation.isPending}>{t('landing.actions.save')}</SubmitButton>
          </form>
        </Form>

        <LandingPreview
          draft={draft}
          highlights={highlightsQuery.data?.items ?? []}
          socialLinks={socialLinksQuery.data?.items ?? []}
          previewLanguage={previewLanguage}
          onPreviewLanguageChange={setPreviewLanguage}
        />
      </div>
    </>
  )
}

/**
 * The live preview. Renders the REAL `shared/landing/sections/` components
 * against unsaved form values — never a second copy of the landing markup,
 * which is the whole reason those components live in `shared/`.
 *
 * `animate={false}` throughout: `Reveal`'s IntersectionObserver keys on the
 * viewport, so inside this bounded, scaled panel a section would sit at
 * `opacity-0` indefinitely.
 */
function LandingPreview({
  draft,
  highlights,
  socialLinks,
  previewLanguage,
  onPreviewLanguageChange,
}: {
  draft: FormValues
  highlights: LandingHighlight[]
  socialLinks: LandingSocialLink[]
  previewLanguage: string
  onPreviewLanguageChange: (language: string) => void
}) {
  const { t, i18n } = useTranslation(['organization', 'landing'])
  // The `landing` namespace's own `t`, so the preview falls back to exactly
  // the strings the live page falls back to. Fixed to the PREVIEWED language
  // rather than the app language — an admin checking the Arabic half must see
  // the Arabic defaults too.
  const landingT = i18n.getFixedT(previewLanguage, 'landing')
  const content = resolveLanding(
    toPreviewContent(draft, highlights, socialLinks),
    previewLanguage,
    landingT,
  )

  return (
    <Card className="lg:sticky lg:top-4 lg:self-start">
      <CardHeader>
        <CardTitle className="text-base">{t('organization:landing.preview.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div
          className="flex items-center gap-2"
          role="group"
          aria-label={t('organization:landing.preview.language')}
        >
          {PREVIEW_LANGUAGES.map((language) => (
            <Button
              key={language}
              type="button"
              size="sm"
              variant={previewLanguage === language ? 'default' : 'outline'}
              onClick={() => onPreviewLanguageChange(language)}
              aria-pressed={previewLanguage === language}
            >
              {t(`organization:landing.preview.languages.${language}`)}
            </Button>
          ))}
        </div>
        {/* A local `dir`, never `<html dir>` — `shared/i18n/direction.ts` is
            this app's only writer of that, and the preview must not become a
            second one. `scale-90` is uniform and therefore direction-neutral;
            an axis-specific scale or translate would not be, and
            `npm run check:rtl` rejects those. */}
        <div className="overflow-x-auto rounded border">
          <div
            dir={isRtl(previewLanguage) ? 'rtl' : 'ltr'}
            lang={previewLanguage}
            className="origin-top scale-90 bg-background"
          >
            <LandingHero content={content} animate={false} />
            <LandingFeatures content={content} animate={false} />
            <LandingCtaBand content={content} animate={false} />
            <LandingFooter content={content} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
