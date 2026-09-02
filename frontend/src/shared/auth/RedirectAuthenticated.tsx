import { Navigate, Outlet } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { getRefreshToken } from './tokenStorage'
import { useAuth } from './useAuth'

/**
 * Wraps ONLY the `/` index route (the public landing page, Story 86). A
 * signed-in account is sent to `/home` — the staff dashboard, which
 * `RedirectPortalOnly` then forwards to `/portal` for a `portal.access`-only
 * account. A signed-out visitor gets `<Outlet/>`: the landing page.
 *
 * The `loading` branch is deliberately NOT a plain `<Loading />`, unlike
 * `RequireAuth`/`RequirePermission`. `AuthProvider`'s boot effect settles a
 * visitor with no stored refresh token to 'unauthenticated' immediately and
 * with no network call — but it is a `useEffect`, so it runs AFTER the first
 * paint. Rendering a spinner in that window would flash a loading state at
 * every first-time visitor on the product's front door. `getRefreshToken()`
 * is the same synchronous check `AuthProvider` itself makes first
 * (`AuthProvider.tsx`), so consulting it here reaches the identical
 * conclusion one frame earlier, with no risk of showing the landing page to
 * someone who is about to be recognised as signed in.
 */
export function RedirectAuthenticated() {
  const { status } = useAuth()

  if (status === 'loading') {
    if (!getRefreshToken()) return <Outlet />
    return <Loading />
  }
  if (status === 'authenticated') return <Navigate to="/home" replace />

  return <Outlet />
}
