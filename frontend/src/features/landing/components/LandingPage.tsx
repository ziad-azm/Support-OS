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
 * `RedirectAuthenticated` (`shared/auth`) sends a signed-in visitor straight
 * to `/home` before this ever renders.
 *
 * NO LOADING STATE, deliberately. `useLandingContent()` returns `undefined`
 * while in flight AND on failure, and `resolveLanding` turns both into the
 * shipped bundle copy — so the hero paints on the first frame with real
 * content and is REPLACED by admin copy if and when the request lands. A
 * spinner on a first-time visitor's first impression is the thing this shape
 * exists to prevent (LAND-2's own constraint).
 *
 * The presentation itself lives in `shared/landing/sections/` so the admin
 * editor's live preview renders the same components rather than a second copy
 * of this markup that drifts (`no-restricted-imports`, CONVENTIONS.md §15).
 */
export function LandingPage() {
  const { t, i18n } = useTranslation('landing')
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
