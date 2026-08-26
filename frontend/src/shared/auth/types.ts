/** Mirrors `apps.accounts.serializers.UserSerializer` verbatim — snake_case,
 * per CONVENTIONS.md §12. */
export type AuthUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  is_staff: boolean
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export type AuthContextValue = {
  user: AuthUser | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
