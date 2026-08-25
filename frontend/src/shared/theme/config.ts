/**
 * The theme contract. Everything else imports from here — no module hardcodes
 * a theme name or the storage key.
 */
export const THEMES = ['light', 'dark', 'system'] as const

export type Theme = (typeof THEMES)[number]

export const FALLBACK_THEME: Theme = 'system'

/** Also read by the inline anti-FOUC script in index.html — keep in sync. */
export const THEME_STORAGE_KEY = 'supportos.theme'

/** The class `@custom-variant dark` in index.css matches on. */
export const DARK_CLASS = 'dark'

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function isTheme(value: string): value is Theme {
  return (THEMES as readonly string[]).includes(value)
}
