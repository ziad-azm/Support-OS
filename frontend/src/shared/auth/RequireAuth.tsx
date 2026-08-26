import { Navigate, Outlet, useLocation } from 'react-router'

import { Loading } from '@/shared/ui/Loading'

import { useAuth } from './useAuth'

/**
 * A layout route with no path: nest protected routes under it in
 * `app/router.tsx`. Renders <Outlet/> only once `status === 'authenticated'`.
 */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Loading />
  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}
