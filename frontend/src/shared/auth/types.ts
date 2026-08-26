/** Mirrors `apps.accounts.serializers.RoleSerializer`. */
export type AuthRole = {
  slug: string
  name: string
}

/** Mirrors `apps.accounts.serializers.UserSerializer` verbatim — snake_case,
 * per CONVENTIONS.md §12. */
export type AuthUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
  role: AuthRole | null
  /** Flat, already resolved by the backend — includes the superuser bypass.
   * Never derive permissions from `role` on the client. See CONVENTIONS.md §22. */
  permissions: string[]
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  /** UX only — the backend is the enforcement point (CONVENTIONS.md §12). */
  can: (permission: string) => boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
