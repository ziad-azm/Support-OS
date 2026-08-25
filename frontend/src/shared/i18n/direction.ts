import type { i18n } from 'i18next'

import { isRtl } from './config'

/** Set `lang` and `dir` on <html>. The only place either attribute is written. */
export function applyDirection(language: string): void {
  const root = document.documentElement
  root.lang = language
  root.dir = isRtl(language) ? 'rtl' : 'ltr'
}

/**
 * Keep the attributes in step with the active language.
 *
 * An i18next event subscription rather than a React effect: direction is a
 * document-level concern, so it must not depend on a component being mounted.
 */
export function watchDirection(instance: i18n): void {
  instance.on('languageChanged', applyDirection)
}
