import * as z from 'zod'

import { FALLBACK_LANGUAGE } from '@/shared/i18n/config'
import type { Language } from '@/shared/i18n/config'

import { zodErrorMap } from './errorMap'

/**
 * Zod's own locale, used as the FALLBACK beneath our error map.
 *
 * Keyed off `Language` so adding a language to `shared/i18n/config.ts` is a
 * type error here until its locale is registered — there is one list of
 * languages in this codebase, not two.
 */
const ZOD_LOCALES: Record<Language, () => z.core.$ZodConfig> = {
  en: z.locales.en,
  ar: z.locales.ar,
}

/**
 * Point Zod at a language. Called once at boot and again on every
 * `languageChanged` (see ./index.ts).
 *
 * `customError` wins; returning `undefined` from it falls through to the
 * spread locale. Verified against zod@4.4.3 — that fallthrough is the whole
 * reason we only have to translate the codes forms actually produce.
 */
export function applyZodLocale(language: string): void {
  const locale = ZOD_LOCALES[language as Language] ?? ZOD_LOCALES[FALLBACK_LANGUAGE]
  z.config({ ...locale(), customError: zodErrorMap })
}
