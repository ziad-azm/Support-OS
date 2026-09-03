/**
 * The branding contract. Everything else imports from here — no module
 * hardcodes the storage key or a token name.
 */

/** Mirrors `apps.organization.models.HEX_COLOR_VALIDATOR`. */
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Also read by the inline anti-FOUC script in index.html — keep in sync.
 * Unlike the theme and language keys, this one holds JSON. */
export const BRANDING_STORAGE_KEY = 'supportos.branding'

/** The two custom properties this module is allowed to write, and the only
 * runtime exception to CONVENTIONS.md §19's "colours come from tokens"
 * rule. Declared in index.css (`:root` lines 26-27, `.dark` 87-88) and
 * mapped to Tailwind by `@theme inline` (132-133) — which is why
 * overriding them reaches every `bg-primary`/`text-primary` utility in the
 * app with no class changes. */
export const PRIMARY_TOKEN = '--primary'
export const PRIMARY_FOREGROUND_TOKEN = '--primary-foreground'

/** Picked for contrast against the brand colour, never configured. */
export const ON_LIGHT = '#000000'
export const ON_DARK = '#FFFFFF'
