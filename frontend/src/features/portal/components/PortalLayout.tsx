import { Link, Outlet } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/shared/auth'
import { Button } from '@/shared/ui/primitives/button'
import { LanguageSwitcher } from '@/shared/ui/LanguageSwitcher'
import { ThemeToggle } from '@/shared/ui/ThemeToggle'

/**
 * The customer-facing shell — a sibling to `app/RootLayout.tsx`, not nested
 * inside it (see Story 42 `## Story Goal`'s router finding). Deliberately
 * smaller than `RootLayout`: no `NotificationBell` (staff-only), no
 * `Can`-gated multi-feature nav — there is exactly one portal feature
 * (this shell) until PORTAL-1 lands.
 *
 * Responsive via the same `flex flex-wrap` technique `RootLayout` uses, not
 * a mobile drawer — there is nothing to hide behind one yet. See
 * CONVENTIONS.md §26.
 */
export function PortalLayout() {
  const { t } = useTranslation('portal')
  const { user, logout } = useAuth()

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="container mx-auto flex flex-wrap items-center gap-4 px-4 py-3">
          <span className="font-semibold">{t('shell.title')}</span>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal">{t('nav.home')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal/tickets/new">{t('nav.newTicket')}</Link>
            </Button>
          </nav>
          <div className="ms-auto flex items-center gap-2">
            {user ? (
              <>
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <Button variant="ghost" size="sm" onClick={() => void logout()}>
                  {t('actions.logout', { ns: 'common' })}
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
