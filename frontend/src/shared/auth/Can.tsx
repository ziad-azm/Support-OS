import type { ReactNode } from 'react'

import { useAuth } from './useAuth'

type CanProps = {
  permission: string
  children: ReactNode
  /** Rendered instead when the permission is absent. Default: nothing. */
  fallback?: ReactNode
}

/**
 * Renders `children` only when the user holds `permission`.
 *
 * The declarative form of `can()`, for the common "hide this button" case.
 * Hiding a control is UX, not security — the endpoint behind it enforces the
 * same permission independently (CONVENTIONS.md §12).
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const { can } = useAuth()
  return <>{can(permission) ? children : fallback}</>
}
