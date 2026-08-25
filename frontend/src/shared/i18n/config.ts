/**
 * The language contract. Everything else imports from here — no module
 * hardcodes a language tag or the storage key.
 */
export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const FALLBACK_LANGUAGE: Language = 'en'

/** Also read by the inline anti-FOUC script in index.html — keep in sync. */
export const LANGUAGE_STORAGE_KEY = 'supportos.language'

export const RTL_LANGUAGES: readonly Language[] = ['ar']

/**
 * Intl locale tag per language, with the numbering system and calendar pinned.
 *
 * Verified: bare `ar` resolves to Western digits (`latn`) and the Gregorian
 * calendar, while `ar-EG` and `ar-SA` resolve to Arabic-Indic digits (`arab`).
 * Because ICU differs by tag — and browser ICU can differ from Node's — both
 * are pinned explicitly rather than left to resolution. See § "The Arabic
 * numeral decision" in the plan.
 */
export const INTL_LOCALE: Record<Language, string> = {
  en: 'en-US',
  ar: 'ar',
}

export function isRtl(language: string): boolean {
  return RTL_LANGUAGES.includes(language as Language)
}

export function isSupported(language: string): language is Language {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language)
}
