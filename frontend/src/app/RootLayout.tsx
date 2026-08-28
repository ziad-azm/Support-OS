import { Link, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { NotificationBell } from '@/features/notifications/components/NotificationBell'
import { Can, useAuth } from '@/shared/auth'
import { Button } from '@/shared/ui/primitives/button'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'

/** Story 06 owns layout: a header with the language and theme controls, and
 * a main content area for the routed page. */
export function RootLayout() {
  const { t } = useTranslation(['common', 'customers', 'tickets', 'tasks', 'knowledgeBase'])
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
            <Can permission="tickets.view">
              <Button asChild variant="ghost" size="sm">
                <Link to="/tickets">{t('tickets:title')}</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/tickets/my-tickets">{t('tickets:myQueue.title')}</Link>
              </Button>
            </Can>
            <Button asChild variant="ghost" size="sm">
              <Link to="/tasks">{t('tasks:title')}</Link>
            </Button>
            <Can permission="knowledge_base.view">
              <Button asChild variant="ghost" size="sm">
                <Link to="/knowledge-base">{t('knowledgeBase:title')}</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/knowledge-base/articles">{t('knowledgeBase:articles.title')}</Link>
              </Button>
            </Can>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            {user ? (
              <>
                <NotificationBell />
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
