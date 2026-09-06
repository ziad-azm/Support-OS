import type { TFunction } from 'i18next'

import { isRtl } from '@/shared/i18n/config'

import { DEFAULT_CTA_PATHS, ctaPath } from './config'
import type { LandingContent, ResolvedHighlight, ResolvedLanding } from './types'

/** The four cards shipped in `features/landing/locales/{en,ar}.json` — keys
 * into that namespace, plus the icon each one had in `LandingPage.tsx`'s
 * `FEATURES` array before LAND-2. */
const BUNDLED_HIGHLIGHTS = [
  { key: 'tickets', icon: 'inbox' },
  { key: 'sla', icon: 'timer' },
  { key: 'ai', icon: 'sparkles' },
  { key: 'reports', icon: 'bar-chart-3' },
] as const

const YEAR_PLACEHOLDER = '{{year}}'

/**
 * Merges admin-set landing copy over the shipped i18n bundle, per field.
 *
 * `content` is `undefined` while the request is in flight, when it fails, and
 * on an organization that never opened the editor — all three collapse to the
 * same answer, which is why there is one parameter and not a status flag. The
 * landing page therefore never needs a loading state.
 *
 * `language` selects the `_en`/`_ar` half. It is passed in rather than read
 * from `i18next` here so the admin preview can force a locale.
 */
export function resolveLanding(
  content: LandingContent | undefined,
  language: string,
  t: TFunction<'landing'>,
): ResolvedLanding {
  const rtl = isRtl(language)

  /** The active locale's half, trimmed. Empty means "fall back". */
  function pick(en: string | undefined, ar: string | undefined): string {
    return ((rtl ? ar : en) ?? '').trim()
  }

  /** Either locale, active one first — used only for highlights, where a
   * card with a title in just one locale is still worth rendering. */
  function pickEither(en: string | undefined, ar: string | undefined): string {
    return pick(en, ar) || ((rtl ? en : ar) ?? '').trim()
  }

  const year = String(new Date().getFullYear())
  const adminFooter = pick(content?.footer_text_en, content?.footer_text_ar)

  return {
    heroHeadline: pick(content?.hero_headline_en, content?.hero_headline_ar) || t('hero.headline'),
    heroValueProposition:
      pick(content?.hero_value_proposition_en, content?.hero_value_proposition_ar) ||
      t('hero.valueProposition'),
    primaryCta: {
      label:
        pick(content?.hero_primary_cta_label_en, content?.hero_primary_cta_label_ar) ||
        t('hero.login'),
      to: ctaPath(content?.hero_primary_cta_target, DEFAULT_CTA_PATHS.heroPrimary),
    },
    secondaryCta: {
      label:
        pick(content?.hero_secondary_cta_label_en, content?.hero_secondary_cta_label_ar) ||
        t('hero.demo'),
      to: ctaPath(content?.hero_secondary_cta_target, DEFAULT_CTA_PATHS.heroSecondary),
    },
    featuresTitle:
      pick(content?.features_title_en, content?.features_title_ar) || t('features.sectionTitle'),
    highlights: resolveHighlights(content, pickEither, t),
    ctaTitle: pick(content?.cta_title_en, content?.cta_title_ar) || t('cta.title'),
    ctaSubtitle: pick(content?.cta_subtitle_en, content?.cta_subtitle_ar) || t('cta.subtitle'),
    ctaLabel: pick(content?.cta_label_en, content?.cta_label_ar) || t('cta.login'),
    ctaTo: ctaPath(content?.cta_target, DEFAULT_CTA_PATHS.ctaBand),
    // `t()` interpolates the SHIPPED default. An admin value is never passed
    // through `t()` — that would make org-authored text an i18next template
    // and expose every other key in the namespace — so `{{year}}` is the one
    // placeholder honoured, by literal substitution. Any other `{{…}}` an
    // admin types renders as typed.
    footerText: adminFooter
      ? adminFooter.split(YEAR_PLACEHOLDER).join(year)
      : t('footer.copyright', { year }),
  }
}

function resolveHighlights(
  content: LandingContent | undefined,
  pickEither: (en: string | undefined, ar: string | undefined) => string,
  t: TFunction<'landing'>,
): ResolvedHighlight[] {
  const rows = content?.highlights ?? []

  if (rows.length > 0) {
    // A non-empty table REPLACES the shipped set rather than appending to it
    // — a half-merged list would make "delete this card" impossible to
    // express. A row with no title in either locale is dropped: a titleless
    // card on the front door is worse than one card fewer. The API requires
    // both titles, so this only fires for a row written through Django admin.
    return rows
      .map((row) => ({
        key: String(row.id),
        title: pickEither(row.title_en, row.title_ar),
        description: pickEither(row.description_en, row.description_ar),
        icon: row.icon,
      }))
      .filter((row) => row.title !== '')
  }

  return BUNDLED_HIGHLIGHTS.map(({ key, icon }) => ({
    key,
    title: t(`features.${key}.title`),
    description: t(`features.${key}.description`),
    icon,
  }))
}
