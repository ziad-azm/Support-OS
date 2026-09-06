/**
 * The social-link contract. Everything else imports from here — the same
 * role `config.ts` plays for icons and CTA targets.
 *
 * `as const`, not `string[]`, is required, not stylistic: a plain
 * `string[]` breaks `t(\`social.platforms.${platform}\`)` against the
 * strict i18next resource map, the same reason `LANDING_ICON_KEYS`
 * (`config.ts`) and `LANDING_CTA_TARGETS` are declared this way.
 *
 * Mirrors `apps.organization.models.LandingSocialLink.Platform` key-for-key.
 * Adding a value is a two-file change: that enum and this list (plus a mark
 * in `socialIcons.tsx` or `LandingSocialIcon.tsx` if it needs a new one).
 */
export const SOCIAL_PLATFORMS = [
  'facebook',
  'x',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'github',
  'website',
  'email',
  'phone',
  'whatsapp',
] as const

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

/** The public payload types `platform` as plain `string`, not
 * `SocialPlatform` — a backend-first deploy can send a platform this
 * bundle has never heard of, and typing it narrowly would move that
 * failure to runtime instead of catching it here. */
export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value)
}

const _PHONE_DIGITS = /\D/g

/**
 * Builds the href for a resolved link — see Story 95 `## Product rules`'
 * link-behaviour table. The server already normalizes `phone`/`whatsapp`
 * values to digits-plus-optional-leading-`+`
 * (`apps.organization.serializers.LandingSocialLinkSerializer.validate`),
 * so the `\D` strip here is belt-and-braces for a row written directly
 * through Django admin, not the primary defence.
 */
export function socialHref(platform: SocialPlatform, value: string): string {
  switch (platform) {
    case 'email':
      return `mailto:${value}`
    case 'phone':
      return `tel:${value}`
    case 'whatsapp':
      return `https://wa.me/${value.replace(_PHONE_DIGITS, '')}`
    default:
      return value
  }
}

/** `email` and `phone` hand off to another app (a mail client, a dialer) —
 * `target="_blank"` on those strands a blank tab in most browsers once the
 * handoff completes. Every other platform is a genuine off-site page. */
export function opensInNewTab(platform: SocialPlatform): boolean {
  return platform !== 'email' && platform !== 'phone'
}
