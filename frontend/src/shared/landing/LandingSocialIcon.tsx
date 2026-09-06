import { createElement } from 'react'
import { GlobeIcon, MailIcon, MessageCircleIcon, PhoneIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { SOCIAL_BRAND_MARKS } from './socialIcons'

const GENERIC_MARKS: Record<string, LucideIcon> = {
  website: GlobeIcon,
  email: MailIcon,
  phone: PhoneIcon,
  whatsapp: MessageCircleIcon,
}

/**
 * Renders one social/contact platform's mark from its stored key — a brand
 * SVG from `socialIcons.tsx` for the seven platforms lucide has no icon
 * for, else a real lucide mark. Shared by the public footer/`/contact`
 * block and the admin list/form screens.
 *
 * `createElement`, not `const Mark = …; <Mark />`: `LandingIcon.tsx`
 * documents why — the latter reads to `oxlint`'s `react/static-components`
 * as a component built during render, even though this only ever returns
 * one of a fixed set of module-level components.
 *
 * An unknown platform renders `GlobeIcon` — the same "degrade to a real
 * icon, never a hole" rule `landingIcon()` (`config.ts`) follows.
 */
export function LandingSocialIcon({
  platform,
  className,
}: {
  platform: string
  className?: string
}) {
  const Mark = SOCIAL_BRAND_MARKS[platform] ?? GENERIC_MARKS[platform] ?? GlobeIcon
  return createElement(Mark, { className })
}
