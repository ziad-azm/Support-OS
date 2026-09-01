import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/shared/ui/primitives/card'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'
import { PageHeader } from '@/shared/ui/PageHeader'

/**
 * A personal-preferences page open to every authenticated user (unlike
 * `/settings`, `features/organization/components/SettingsPage.tsx`, which
 * is an org-admin form gated behind `settings.manage`). Hosts the
 * `LanguageSwitcher`/`ThemeToggle` moved out of `Sidebar.tsx`'s footer
 * (SUPPORTOS-105 task 4) — both components are unchanged, still own their
 * state via `i18n.changeLanguage`/`useTheme()`, zero props either way.
 */
export function PreferencesPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('preferences.title')} />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('language.label')}</span>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('theme.label')}</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
