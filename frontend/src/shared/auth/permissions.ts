import type { AuthUser } from './types'

/**
 * Does this user hold this permission?
 *
 * Reads `user.permissions` — the flat list the backend already resolved,
 * superuser bypass included. Deliberately does NOT look at `role`: a
 * superuser has every permission and no role, so deriving from `role` here
 * would hide controls the API allows. See CONVENTIONS.md §22.
 */
export function hasPermission(user: AuthUser | null, permission: string): boolean {
  if (!user) return false
  return user.permissions.includes(permission)
}
