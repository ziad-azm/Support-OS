import { Navigate, Outlet, useLocation } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { useAuth } from './useAuth'

/**
 * A layout route with no path: nest protected routes under it in
 * `app/router.tsx`. Renders <Outlet/> only once `status === 'authenticated'`.
 *
 * SEC-9: an account whose role mandates 2FA (`mfa_required`) but has not
 * enrolled yet (`!mfa_enabled`) is redirected to `/preferences` — the one
 * screen that can complete enrolment — instead of any other route. This is
 * a UX-level gate only (CONVENTIONS.md §12); see this story's
 * `## Edge Cases` for the accepted limitation.
 */
export function RequireAuth() {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Loading />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (user?.mfa_required && !user.mfa_enabled && location.pathname !== '/preferences') {
    return <Navigate to="/preferences" replace />
  }
  return <Outlet />
}
