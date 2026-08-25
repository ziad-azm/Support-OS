import healthAr from '@/features/health/locales/ar.json'
import healthEn from '@/features/health/locales/en.json'

import arCommon from './locales/ar/common.json'
import arErrors from './locales/ar/errors.json'
import enCommon from './locales/en/common.json'
import enErrors from './locales/en/errors.json'

/**
 * The whole resource map, explicitly registered.
 *
 * Deliberately not `import.meta.glob`: an explicit map is greppable, fully
 * typed under `strict`, and shows every namespace in one place. Adding a
 * feature costs two imports and one line per language — that is the
 * "every feature adds its own namespace" checklist item.
 */
export const resources = {
  en: { common: enCommon, errors: enErrors, health: healthEn },
  ar: { common: arCommon, errors: arErrors, health: healthAr },
} as const

export type AppResources = (typeof resources)['en']
