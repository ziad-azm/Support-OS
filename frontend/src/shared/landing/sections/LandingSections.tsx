import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'

import { LandingIcon } from '../LandingIcon'
import { Reveal } from '../Reveal'
import type { ResolvedLanding } from '../types'

/**
 * The public landing page's presentation, section by section — Story 86's
 * markup, lifted here unchanged by Story 94 (`LAND-2`).
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
 */

type SectionProps = { content: ResolvedLanding; animate: boolean }

export function LandingHero({ content, animate }: SectionProps) {
  return (
    <section className="container mx-auto px-4 py-16 sm:py-24">
      <div
        className={animate ? 'animate-in fade-in slide-in-from-bottom-4 duration-700' : undefined}
      >
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {content.heroHeadline}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
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
    </section>
  )
}

export function LandingFeatures({ content, animate }: SectionProps) {
  return (
    <section className="border-y bg-card">
      <div className="container mx-auto px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">{content.featuresTitle}</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {content.highlights.map((highlight, index) => (
            <Reveal key={highlight.key} delayMs={index * 80} disabled={!animate}>
              <Card className="h-full">
                <CardContent className="flex flex-col gap-2">
                  <LandingIcon icon={highlight.icon} className="size-6 text-primary" />
                  <h3 className="font-medium">{highlight.title}</h3>
                  <p className="text-sm text-muted-foreground">{highlight.description}</p>
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
      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{content.ctaTitle}</h2>
        <p className="mt-2 text-muted-foreground">{content.ctaSubtitle}</p>
        <div className="mt-6 flex justify-center">
          <Button asChild size="lg">
            <Link to={content.ctaTo}>{content.ctaLabel}</Link>
          </Button>
        </div>
        {/* NOT admin-editable: these three strings are shared with
            `LoginPage`'s own "Not a staff member?" block and point at the two
            public routes an anonymous visitor can actually use. They stay in
            the `auth` namespace. */}
        <div className="mt-6 flex flex-col items-center gap-1 text-sm text-muted-foreground">
          <span>{t('help.prompt')}</span>
          <div className="flex items-center gap-3">
            <Link
              to="/contact"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('help.contact')}
            </Link>
            <Link
              to="/chat"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('help.chat')}
            </Link>
          </div>
        </div>
      </section>
    </Reveal>
  )
}

export function LandingFooter({ content }: { content: ResolvedLanding }) {
  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-6 text-sm text-muted-foreground">
        {content.footerText}
      </div>
    </footer>
  )
}
