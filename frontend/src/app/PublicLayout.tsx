import { Outlet } from 'react-router'

import { cn } from '@/shared/lib/cn'

/**
 * Shell for routes reachable with no session: `/` (the landing page),
 * `/login`, `/chat`, `/contact`, `/set-password`, `/forgot-password`,
 * `/reset-password`. Deliberately NOT `RootLayout` — no staff `Sidebar`, no
 * nav, no authenticated-only chrome. A visitor who isn't signed in (or isn't
 * staff at all, e.g. an anonymous customer starting a chat) should see a
 * clean, standalone screen, not the full app shell with nav links it has no
 * business rendering for them.
 *
 * `variant` exists so the landing page (Story 86, `LAND-1`) reuses this shell
 * instead of introducing a third layout type — the backlog's own constraint.
 * `centered` is every auth/form page: one card, middle of the screen.
 * `full` is edge-to-edge: the landing page paints its own full-bleed section
 * bands and owns its horizontal padding.
 *
 * The OUTER div is the scroll container, not `body`: `index.css`'s base layer
 * sets `html, body { h-full overflow-hidden }`, so the document never scrolls
 * and any region taller than the viewport must scroll itself. Before this
 * story the centred card was always short enough to hide that; the landing
 * page is not.
 */
export function PublicLayout({ variant = 'centered' }: { variant?: 'centered' | 'full' }) {
  return (
    <div className="h-dvh overflow-y-auto bg-background">
      <div
        className={cn(
          variant === 'centered' && 'flex min-h-full items-center justify-center px-4 py-6',
        )}
      >
        <Outlet />
      </div>
    </div>
  )
}
