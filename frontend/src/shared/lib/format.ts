import { FALLBACK_LANGUAGE, INTL_LOCALE, isSupported } from '@/shared/i18n/config'

/**
 * Shared formatters. Features never call `Intl` or `toLocaleString` directly —
 * see CONVENTIONS.md §18.
 *
 * `numberingSystem` and `calendar` are pinned on every call: bare `ar`
 * resolves to Western digits and the Gregorian calendar, but `ar-EG`/`ar-SA`
 * resolve to Arabic-Indic digits, so relying on resolution makes output
 * depend on the tag and on the browser's ICU build.
 */
const NUMBERING_SYSTEM = 'latn'
const CALENDAR = 'gregory'

function localeFor(language: string): string {
  return INTL_LOCALE[isSupported(language) ? language : FALLBACK_LANGUAGE]
}

export function formatNumber(
  value: number,
  language: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(localeFor(language), {
    numberingSystem: NUMBERING_SYSTEM,
    ...options,
  }).format(value)
}

export function formatCurrency(
  value: number,
  language: string,
  currency: string,
  options: Intl.NumberFormatOptions = {},
): string {
  return formatNumber(value, language, { style: 'currency', currency, ...options })
}

export function formatDate(
  value: Date | string | number,
  language: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  return new Intl.DateTimeFormat(localeFor(language), {
    numberingSystem: NUMBERING_SYSTEM,
    calendar: CALENDAR,
    ...options,
  }).format(new Date(value))
}

export function formatDateTime(
  value: Date | string | number,
  language: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return formatDate(value, language, options)
}
