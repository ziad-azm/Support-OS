import { Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'

/** Story 06 owns layout: a header with the language and theme controls, and
 * a main content area for the routed page. */
export function RootLayout() {
  const { t } = useTranslation()

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center gap-4 px-4 py-3">
          <span className="font-semibold">{t('app.name')}</span>
          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
