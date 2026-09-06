import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/primitives/button'

import { LandingSocialIcon } from '../LandingSocialIcon'
import type { ResolvedSocialLink } from '../types'

/**
 * The organization's social/contact links, as icon-only buttons — LAND-3.
 * A standalone component (not a nested function inside `LandingSections.tsx`)
 * so LAND-4's eventual redesign can relocate it without touching that file.
 * Used both in the landing footer and on `/contact`.
 *
 * WITH NO LINKS, RENDERS NOTHING — the required behaviour, not a nicety:
 * "an empty list must render no social row at all rather than an empty
 * shell" (LAND-3's own constraint). The caller's layout must not reserve
 * space for this component.
 */
export function LandingSocialRow({
  links,
  className,
}: {
  links: ResolvedSocialLink[]
  className?: string
}) {
  const { t } = useTranslation('landing')

  if (links.length === 0) return null

  return (
    <div
      className={
        className
          ? `flex flex-wrap items-center gap-1 ${className}`
          : 'flex flex-wrap items-center gap-1'
      }
    >
      {links.map((link) => (
        <Button key={link.key} asChild variant="ghost" size="icon-sm">
          <a
            href={link.href}
            aria-label={t('social.visit', { platform: link.label })}
            {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <LandingSocialIcon platform={link.platform} className="size-4" />
          </a>
        </Button>
      ))}
    </div>
  )
}
