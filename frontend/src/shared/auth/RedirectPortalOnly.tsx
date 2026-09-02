import { Navigate, Outlet } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { useAuth } from './useAuth'

/**
 * Wraps ONLY the `/` index route (`app/router.tsx`'s `HomePage` entry) — not
 * the whole staff route tree. An account whose entire resolved permission
 * set is `['portal.access']` (the seeded `customer` role — see
 * `backend/apps/core/permissions.py::permissions_for`) is sent to `/portal`
 * instead of rendering `HomePage`.
 *
 * Deliberately scoped to the index route alone: every other `/` child route
 * is already gated by its own `RequirePermission`, and a permission miss
 * there redirects back to `/` (`RequirePermission.tsx`) — which this
 * component then forwards on to `/portal`. No loop: `/portal`'s own
 * `RequireAuth` + `RequirePermission permission="portal.access"` then
 * passes and stops there.
 *
 * A superuser's resolved `permissions` always includes `portal.access`
 * PLUS every other permission (`permissions_for`'s `ALL_PERMISSIONS`
 * branch), so `permissions.length === 1` never matches a superuser.
 */
export function RedirectPortalOnly() {
  const { status, user } = useAuth()

  if (status === 'loading') return <Loading />

  const isPortalOnly =
    !!user && user.permissions.length === 1 && user.permissions[0] === 'portal.access'
  if (isPortalOnly) return <Navigate to="/portal" replace />

  return <Outlet />
}
