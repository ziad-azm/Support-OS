import { Navigate, Outlet, useLocation } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { useAuth } from './useAuth'

/**
 * A path-less layout route that additionally requires a permission. Nest it
 * INSIDE `RequireAuth` — it re-checks `status` so it is safe standalone, but
 * the documented arrangement keeps the redirect-to-login logic in one place:
 *
 *   { element: <RequireAuth />, children: [
 *     { element: <RequirePermission permission="users.view" />, children: [...] },
 *   ]}
 *
 * A permission miss redirects to `/home` (the staff dashboard), not to a 403
 * page — there is no 403 route in this app, and inventing one is a decision
 * for the first feature that needs it. It is `/home` rather than `/` because
 * Story 86 made `/` the public landing page; sending a signed-in staff member
 * to a marketing page on a permission miss is wrong, and the extra `/` →
 * `/home` hop is avoidable. `replace` keeps the unauthorized URL out of
 * history.
 */
export function RequirePermission({ permission }: { permission: string }) {
  const { status, can } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Loading />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!can(permission)) return <Navigate to="/home" replace />
  return <Outlet />
}
