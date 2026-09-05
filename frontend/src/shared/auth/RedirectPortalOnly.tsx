import { Navigate, Outlet } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { useAuth } from './useAuth'

/**
 * Wraps ONLY the `/home` route (`app/router.tsx`'s `HomePage` entry) — not
 * the whole staff route tree. An account holding the seeded `customer` role
 * is sent to `/portal` instead of rendering `HomePage`.
 *
 * Deliberately scoped to that one route: every other `/` child route is
 * already gated by its own `RequirePermission`, and a permission miss there
 * redirects to `/home` (`RequirePermission.tsx`) — which this component then
 * forwards on to `/portal`. No loop: `/portal`'s own `RequireAuth` +
 * `RequirePermission permission="portal.access"` then passes and stops
 * there.
 *
 * Checked by `role.slug`, NOT by counting `permissions` (a former version
 * matched `permissions.length === 1 && permissions[0] === 'portal.access'`,
 * assuming the `customer` role would only ever hold that one permission —
 * it broke the moment `knowledge_base.view` was granted to `customer` for
 * the portal FAQ/Articles screens, silently stranding every portal user in
 * the staff shell instead of redirecting them). A superuser has `role: null`
 * (or a staff role) regardless of how many permissions resolve for them, so
 * this never matches a superuser either.
 */
export function RedirectPortalOnly() {
  const { status, user } = useAuth()

  if (status === 'loading') return <Loading />

  const isPortalOnly = user?.role?.slug === 'customer'
  if (isPortalOnly) return <Navigate to="/portal" replace />

  return <Outlet />
}
