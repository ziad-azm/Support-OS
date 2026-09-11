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

/** Mirrors `apps.accounts.serializers.BranchBriefSerializer` (ORG-2). */
export type AuthBranch = {
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
  /** The caller's own department, or `null`. Drives `TicketListPage`'s
   * default department filter (ORG-4, Story 98). Read-only — changing a
   * user's department goes through `PATCH /api/users/<id>/` (SEC-1's
   * screen), never here. */
  department: AuthDepartment | null
  /** The caller's own branch, or `null`. Drives `TicketListPage`'s default
   * branch filter (ORG-4, Story 98). Read-only — changing a user's branch
   * goes through `PATCH /api/users/<id>/` (SEC-1's screen), never here. */
  branch: AuthBranch | null
  /** Flat, already resolved by the backend — includes the superuser bypass.
   * Never derive permissions from `role` on the client. See CONVENTIONS.md §22. */
  permissions: string[]
  /** Whether this account currently has 2FA active. */
  mfa_enabled: boolean
  /** Whether this account's role currently mandates 2FA — SEC-9's per-role
   * enforcement. Independent of `mfa_enabled`: a required-but-not-yet-
   * enrolled account has this true and `mfa_enabled` false. */
  mfa_required: boolean
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type LoginResult = { status: 'authenticated' } | { status: 'mfa_required'; mfaToken: string }

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  /** UX only — the backend is the enforcement point (CONVENTIONS.md §12). */
  can: (permission: string) => boolean
  login: (email: string, password: string) => Promise<LoginResult>
  /** Exchanges a 2FA challenge (from `login`'s `mfa_required` result) plus
   * a TOTP or recovery code for a real session. */
  completeMfaChallenge: (mfaToken: string, code: string) => Promise<void>
  /** Re-fetches `/auth/me/` and updates `user` in place — used after
   * enabling/disabling 2FA so the new `mfa_enabled` value is reflected
   * without a full logout/login. */
  refreshUser: () => Promise<void>
  logout: () => Promise<void>
}
