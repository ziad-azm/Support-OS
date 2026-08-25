import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import { applyDirection, watchDirection } from './direction'
import { FALLBACK_LANGUAGE, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from './config'
import { resources } from './resources'

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    fallbackLng: FALLBACK_LANGUAGE,
    defaultNS: 'common',
    // Resources are bundled, so init is synchronous and no Suspense boundary
    // is needed. Turning this on later requires a <Suspense> around the tree.
    react: { useSuspense: false },
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

applyDirection(i18next.resolvedLanguage ?? FALLBACK_LANGUAGE)
watchDirection(i18next)

export { i18next }
