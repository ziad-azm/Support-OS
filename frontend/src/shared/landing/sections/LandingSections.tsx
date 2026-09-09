import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'
import { Reveal } from '@/shared/ui/Reveal'

import { HeroImage } from '../HeroImage'
import { LandingIcon } from '../LandingIcon'
import type { ResolvedLanding } from '../types'

import { LandingSocialRow } from './LandingSocialRow'

/**
 * The public landing page's presentation, section by section — Story 86's
 * markup, restyled by Story 96 (`LAND-4`) per `design-system/supportos/
 * MASTER.md`'s Style Guidelines (Swiss/minimalist, spacious, high-contrast)
 * and Cards spec.
 *
 * IN `shared/`, NOT `features/landing/`, for one reason: the admin editor
 * (`features/organization/components/LandingContentPage.tsx`) renders a live
 * preview from these same components, and `no-restricted-imports`
 * (CONVENTIONS.md §15) forbids it importing from another feature. The
 * alternative was a second copy of this markup that drifts from the real page
 * — which is exactly what the preview exists to prevent.
 *
 * Every component takes an already-RESOLVED `ResolvedLanding`: admin copy
 * merged over the i18n bundle, narrowed to one locale, CTA targets turned
 * into paths. They never see `_en`/`_ar`, an empty string, or a query state.
 *
 * `animate` is false in the preview — see `Reveal`'s `disabled` prop.
 * `Reveal` now lives at `shared/ui/Reveal.tsx` — MOTION-0 (Story 97)
 * promoted it out of this feature and re-expressed its duration on
 * `--motion-reveal`; Story 96 correctly predicted this move and added no
 * motion of its own, only 200ms state transitions (`DSN-8`'s category).
 *
 * The four sections deliberately alternate surface (`bg-primary/5` →
 * `bg-card` → `bg-muted` → default) so consecutive sections stay visually
 * distinguishable — see CONVENTIONS.md §25's "Landing page visual language"
 * subsection.
 */

type SectionProps = { content: ResolvedLanding; animate: boolean }

export function LandingHero({ content, animate }: SectionProps) {
  const hasImage = content.heroImageUrl !== ''
  return (
    // The one background treatment on the page. Token-driven: `bg-primary/5`
    // follows ORG-3's admin-set `primary_color` at runtime, because
    // `shared/branding/branding.ts` overrides the `--primary` custom
    // property itself — so a rebrand retints this band with no class
    // change. A hard-coded hex here would freeze it.
    <section className="border-b bg-primary/5">
      <div
        className={cn(
          'container mx-auto px-4 py-16 sm:py-24',
          // MOTION-0 (Story 97): this literal was a second, untracked
          // 700ms usage alongside `Reveal`'s own — tokenized to
          // `--motion-reveal` so the app has exactly one place that names
          // its one long duration, not two.
          animate && 'animate-in fade-in slide-in-from-bottom-4 duration-(--motion-reveal)',
        )}
      >
        <div
          className={cn(
            'grid items-center gap-10',
            // Two columns ONLY when there is an image. Without one, a
            // 50%-width hero on a 1440px screen is a column of text with a
            // hole beside it.
            hasImage && 'lg:grid-cols-2',
          )}
        >
          <div className={cn(!hasImage && 'max-w-3xl')}>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {content.heroHeadline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {content.heroValueProposition}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to={content.primaryCta.to}>{content.primaryCta.label}</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={content.secondaryCta.to}>{content.secondaryCta.label}</Link>
              </Button>
            </div>
          </div>
          {hasImage ? <HeroImage url={content.heroImageUrl} alt={content.heroHeadline} /> : null}
        </div>
      </div>
    </section>
  )
}

export function LandingFeatures({ content, animate }: SectionProps) {
  return (
    <section className="border-y bg-card">
      <div className="container mx-auto px-4 py-16 sm:py-20">
        <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
          {content.featuresTitle}
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {content.highlights.map((highlight, index) => (
            <Reveal key={highlight.key} delayMs={index * 80} disabled={!animate}>
              {/* MASTER.md Cards spec: shadow-md at rest, shadow-lg + a 2px
                  lift on hover, 200ms. Applied HERE via className, never by
                  editing `card.tsx` — the staff app's other Card usages
                  keep their flat `shadow-sm`. `-translate-y-0.5`, not
                  `scale-*`: MASTER.md's own Anti-Patterns forbid
                  layout-shifting scale hovers, and `translate-y-` is not a
                  physical-direction utility, so `check:rtl` is satisfied. */}
              <Card className="h-full shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
                <CardContent className="flex flex-col items-start gap-3">
                  {/* The `bg-primary/10` circle idiom already in this
                      codebase — `WebFormPage.tsx`'s header mark uses exactly
                      `flex size-12 items-center justify-center rounded-full
                      bg-primary/10`. Reused, not invented. */}
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <LandingIcon icon={highlight.icon} className="size-5 text-primary" />
                  </span>
                  <h3 className="font-semibold">{highlight.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {highlight.description}
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingCtaBand({ content, animate }: SectionProps) {
  const { t } = useTranslation('auth')

  return (
    <Reveal disabled={!animate}>
      <section className="border-y bg-muted">
        <div className="container mx-auto px-4 py-16 text-center sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {content.ctaTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground sm:text-lg">
            {content.ctaSubtitle}
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg">
              <Link to={content.ctaTo}>{content.ctaLabel}</Link>
            </Button>
          </div>
          {/* NOT admin-editable: these three strings are shared with
              `LoginPage`'s own "Not a staff member?" block and point at the
              two public routes an anonymous visitor can actually use. They
              stay in the `auth` namespace. */}
          <div className="mt-6 flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <span>{t('help.prompt')}</span>
            <div className="flex items-center gap-3">
              <Link
                to="/contact"
                className="font-medium text-primary-text underline-offset-4 hover:underline"
              >
                {t('help.contact')}
              </Link>
              <Link
                to="/chat"
                className="font-medium text-primary-text underline-offset-4 hover:underline"
              >
                {t('help.chat')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </Reveal>
  )
}

export function LandingFooter({ content }: { content: ResolvedLanding }) {
  return (
    <footer className="border-t">
      <div className="container mx-auto flex flex-col items-center gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <span>{content.footerText}</span>
        <LandingSocialRow links={content.socialLinks} />
      </div>
    </footer>
  )
}
