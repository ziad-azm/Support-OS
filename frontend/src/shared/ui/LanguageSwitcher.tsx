import { useTranslation } from 'react-i18next'

import { SUPPORTED_LANGUAGES } from '@/shared/i18n/config'
import type { Language } from '@/shared/i18n/config'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'

/**
 * Restyled by Story 06 with the shadcn `Select` primitive. Props unchanged
 * from Story 03 (zero props).
 *
 * `Select` is not a native form control — FORM-1 integrates it through React
 * Hook Form's `Controller`, not `register()`. This component never touches
 * localStorage or document.documentElement itself — i18next's detector
 * persists the choice and `shared/i18n/direction.ts` flips `dir`. Two writers
 * of the same state is how they drift.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <Select
      value={i18n.resolvedLanguage ?? i18n.language}
      onValueChange={(next) => void i18n.changeLanguage(next as Language)}
    >
      <SelectTrigger aria-label={t('language.label')} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LANGUAGES.map((code) => (
          <SelectItem key={code} value={code}>
            {t(`language.${code}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
