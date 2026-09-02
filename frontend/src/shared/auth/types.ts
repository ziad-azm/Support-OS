/** Mirrors `apps.accounts.serializers.RoleSerializer`. */
export type AuthRole = {
  slug: string
  name: string
}

/** Mirrors `apps.accounts.serializers.DepartmentBriefSerializer` (ORG-1). */
export type AuthDepartment = {
  id: number
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
  /** The caller's own department, or `null`. Drives `/tickets/department`
   * and the sidebar link to it. Read-only — changing a user's department
   * goes through `PATCH /api/users/<id>/` (SEC-1's screen), never here. */
  department: AuthDepartment | null
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
