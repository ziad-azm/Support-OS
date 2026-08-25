import { useTranslation } from 'react-i18next'

import { SUPPORTED_LANGUAGES } from '@/shared/i18n/config'
import type { Language } from '@/shared/i18n/config'

/**
 * Minimal, near-unstyled language switcher. UI-1 replaces the internals with a
 * shadcn/Tailwind treatment without changing this component's props.
 *
 * A native <select> is keyboard- and screen-reader-correct with no extra
 * work. This component never touches localStorage or document.documentElement
 * itself — i18next's detector persists the choice and
 * `shared/i18n/direction.ts` flips `dir`. Two writers of the same state is
 * how they drift.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation()

  return (
    <label>
      {t('language.label')}
      <select
        value={i18n.resolvedLanguage ?? i18n.language}
        onChange={(event) => void i18n.changeLanguage(event.target.value as Language)}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {t(`language.${code}`)}
          </option>
        ))}
      </select>
    </label>
  )
}
