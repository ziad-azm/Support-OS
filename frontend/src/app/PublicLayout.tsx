import { Outlet } from 'react-router'

/**
 * Shell for routes reachable with no session: `/login`, `/chat`, `/contact`.
 * Deliberately NOT `RootLayout` — no staff `Sidebar`, no nav, no
 * authenticated-only chrome. A visitor who isn't signed in (or isn't staff
 * at all, e.g. an anonymous customer starting a chat) should see a clean,
 * standalone screen, not the full app shell with nav links it has no
 * business rendering for them.
 */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-6">
      <Outlet />
    </div>
  )
}
