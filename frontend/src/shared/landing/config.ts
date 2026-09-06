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
 * The two key lists are `as const` tuples, not `string[]`, on purpose: that
 * is what lets `t(\`landingHighlights.icons.${key}\`)` typecheck against the
 * strict i18next resource map, the same trick the old `FEATURES` array in
 * `LandingPage.tsx` relied on.
 */

/** Mirrors `apps.organization.models.LandingHighlight.Icon` key-for-key.
 * Adding an icon is a two-file change: that enum and this list + the map
 * below. */
export const LANDING_ICON_KEYS = [
  'inbox',
  'timer',
  'sparkles',
  'bar-chart-3',
  'message-square',
  'users',
  'shield-check',
  'zap',
  'globe',
  'clock',
  'file-text',
  'bell',
] as const

export type LandingIconKey = (typeof LANDING_ICON_KEYS)[number]

/** The icon a new card gets, and the one an unrecognised key falls back to
 * in the admin form. Matches `LandingHighlight.Icon`'s model default. */
export const DEFAULT_ICON_KEY: LandingIconKey = 'sparkles'

const LANDING_ICONS: Record<LandingIconKey, LucideIcon> = {
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

/** True when the stored value is a key this build knows. The API types those
 * columns as plain `string` deliberately — a backend-first deploy can add a
 * choice this bundle has never heard of, and pretending otherwise in the type
 * would just move the failure to runtime. */
export function isIconKey(value: string): value is LandingIconKey {
  return value in LANDING_ICONS
}

/** An unknown key means the backend shipped a value this build has no
 * component for. Degrade to a real icon rather than rendering nothing where a
 * card's icon should be. */
export function landingIcon(key: string): LucideIcon {
  return isIconKey(key) ? LANDING_ICONS[key] : InboxIcon
}

/** Mirrors `LandingContent.CtaTarget`. */
export const LANDING_CTA_TARGETS = ['login', 'contact', 'chat'] as const

export type LandingCtaTarget = (typeof LANDING_CTA_TARGETS)[number]

/** The value is what the API stores; the path is where the CTA actually
 * points. Every path is in `app/router.tsx`'s public tree. */
const LANDING_CTA_PATHS: Record<LandingCtaTarget, string> = {
  login: '/login',
  contact: '/contact',
  chat: '/chat',
}

export function isCtaTarget(value: string): value is LandingCtaTarget {
  return value in LANDING_CTA_PATHS
}

/** The path for a stored target, or `fallback` when the target is blank (the
 * admin chose nothing) or unknown to this build. */
export function ctaPath(target: string | undefined, fallback: string): string {
  return target !== undefined && isCtaTarget(target) ? LANDING_CTA_PATHS[target] : fallback
}

/** Where each CTA points when the admin has chosen nothing — the hard-coded
 * targets `LandingPage.tsx` carried before LAND-2. */
export const DEFAULT_CTA_PATHS = {
  heroPrimary: '/login',
  heroSecondary: '/contact',
  ctaBand: '/login',
} as const
