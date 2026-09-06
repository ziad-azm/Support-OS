import type { SocialPlatform } from './social'

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
  /** An absolute http(s) URL, or `''`. NOT an upload — see Story 96
   * `## The hero image decision`: an uploaded file could not be served to an
   * anonymous visitor without reversing the "no MEDIA_URL" stance
   * `config/settings/base.py:170-174` records. */
  hero_image_url: string
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
  social_links: LandingSocialLink[]
}

/** Mirrors `apps.organization.serializers.PublicLandingHighlightSerializer`. */
export type LandingHighlight = {
  id: number
  title_en: string
  title_ar: string
  description_en: string
  description_ar: string
  icon: string
  order: number
}

/** Mirrors `apps.organization.serializers.PublicLandingSocialLinkSerializer`.
 * `platform` is plain `string`, not `SocialPlatform`: a backend-first
 * deploy can store a choice this bundle has no mark for, and typing it
 * narrowly would move that failure to runtime. `resolveLanding` drops such
 * rows. */
export type LandingSocialLink = {
  id: number
  platform: string
  value: string
  order: number
}

/** One resolved highlight card — already merged and already narrowed to the
 * active locale. `key` is a React key: the row id for an admin-managed card,
 * the bundle key for a shipped one. */
export type ResolvedHighlight = {
  key: string
  title: string
  description: string
  icon: string
}

/** One resolved link — platform already narrowed to a known
 * `SocialPlatform`, href already built, and `external` already decided.
 * `LandingSocialRow` needs nothing else to render it. */
export type ResolvedSocialLink = {
  key: string
  platform: SocialPlatform
  label: string
  href: string
  external: boolean
}

/** What the RESOLVED page renders — every string already merged against the
 * i18n bundle default and already narrowed to the active locale. The section
 * components take only this; they never see `_en`/`_ar` or an empty string. */
export type ResolvedLanding = {
  heroHeadline: string
  heroValueProposition: string
  heroImageUrl: string
  primaryCta: { label: string; to: string }
  secondaryCta: { label: string; to: string }
  featuresTitle: string
  highlights: ResolvedHighlight[]
  ctaTitle: string
  ctaSubtitle: string
  ctaLabel: string
  ctaTo: string
  footerText: string
  socialLinks: ResolvedSocialLink[]
}
