import { useSyncExternalStore } from 'react'

import i18next from 'i18next'

import { FALLBACK_LANGUAGE, isRtl } from './config'

function subscribe(onChange: () => void): () => void {
  i18next.on('languageChanged', onChange)
  return () => {
    i18next.off('languageChanged', onChange)
  }
}

function snapshot(): 'ltr' | 'rtl' {
  return isRtl(i18next.resolvedLanguage ?? i18next.language ?? FALLBACK_LANGUAGE) ? 'rtl' : 'ltr'
}

/**
 * The active direction, for the handful of consumers that need it in React:
 * Radix's DirectionProvider, and the two directional icons in the data table.
 *
 * Subscribes to the same i18next event `direction.ts` uses, so there is one
 * source of truth and no chance of the two disagreeing. Reading
 * `document.documentElement.dir` instead would work but would make the DOM the
 * state store, which nothing else in this codebase does.
 */
export function useDirection(): 'ltr' | 'rtl' {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
