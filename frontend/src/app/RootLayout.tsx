import { Link, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Can, useAuth } from '@/shared/auth'
import { Button } from '@/shared/ui/primitives/button'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'

/** Story 06 owns layout: a header with the language and theme controls, and
 * a main content area for the routed page. */
export function RootLayout() {
  const { t } = useTranslation(['common', 'customers'])
  const { user, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center gap-4 px-4 py-3">
          <span className="font-semibold">{t('app.name')}</span>
          <nav className="flex items-center gap-1">
            <Can permission="customers.view">
              <Button asChild variant="ghost" size="sm">
                <Link to="/customers">{t('customers:title')}</Link>
              </Button>
            </Can>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  {t('actions.logout')}
                </Button>
              </>
            ) : null}
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
