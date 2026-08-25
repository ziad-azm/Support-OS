import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { formatCurrency, formatDate, formatDateTime, formatNumber } from '@/shared/lib/format'

/** Formatters bound to the active language. Re-memoised on language change. */
export function useFormatters() {
  const { i18n } = useTranslation()
  const language = i18n.resolvedLanguage ?? i18n.language

  return useMemo(
    () => ({
      number: (v: number, o?: Intl.NumberFormatOptions) => formatNumber(v, language, o),
      currency: (v: number, c: string, o?: Intl.NumberFormatOptions) =>
        formatCurrency(v, language, c, o),
      date: (v: Date | string | number, o?: Intl.DateTimeFormatOptions) =>
        formatDate(v, language, o),
      dateTime: (v: Date | string | number, o?: Intl.DateTimeFormatOptions) =>
        formatDateTime(v, language, o),
    }),
    [language],
  )
}
