import { BarChart3Icon, InboxIcon, SparklesIcon, TimerIcon } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BrandMark } from '@/shared/branding'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent } from '@/shared/ui/primitives/card'

import { Reveal } from './Reveal'

const FEATURES = [
  { key: 'tickets', icon: InboxIcon },
  { key: 'sla', icon: TimerIcon },
  { key: 'ai', icon: SparklesIcon },
  { key: 'reports', icon: BarChart3Icon },
] as const

/**
 * The public front door at `/` (Story 86, `LAND-1`). Reachable with no
 * session — `RedirectAuthenticated` (`shared/auth`) sends a signed-in
 * visitor straight to `/home` before this ever renders.
 */
export function LandingPage() {
  const { t } = useTranslation(['landing', 'common', 'auth'])

  return (
    <div className="flex flex-col">
      <header className="border-b">
        <div className="container mx-auto flex flex-wrap items-center gap-4 px-4 py-3">
          <BrandMark />
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
            <Button asChild size="sm">
              <Link to="/login">{t('hero.login')}</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-16 sm:py-24">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            {t('hero.headline')}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            {t('hero.valueProposition')}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">{t('hero.login')}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/contact">{t('hero.demo')}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-y bg-card">
        <div className="container mx-auto px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">{t('features.sectionTitle')}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ key, icon: Icon }, index) => (
              <Reveal key={key} delayMs={index * 80}>
                <Card className="h-full">
                  <CardContent className="flex flex-col gap-2">
                    <Icon className="size-6 text-primary" />
                    <h3 className="font-medium">{t(`features.${key}.title`)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t(`features.${key}.description`)}
                    </p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <Reveal>
        <section className="container mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">{t('cta.title')}</h2>
          <p className="mt-2 text-muted-foreground">{t('cta.subtitle')}</p>
          <div className="mt-6 flex justify-center">
            <Button asChild size="lg">
              <Link to="/login">{t('cta.login')}</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-col items-center gap-1 text-sm text-muted-foreground">
            <span>{t('help.prompt', { ns: 'auth' })}</span>
            <div className="flex items-center gap-3">
              <Link
                to="/contact"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('help.contact', { ns: 'auth' })}
              </Link>
              <Link
                to="/chat"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('help.chat', { ns: 'auth' })}
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      <footer className="border-t">
        <div className="container mx-auto px-4 py-6 text-sm text-muted-foreground">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </div>
      </footer>
    </div>
  )
}
