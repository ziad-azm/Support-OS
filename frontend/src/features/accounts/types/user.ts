/** Mirrors `apps.accounts.serializers.UserAdminSerializer`'s read shape. */
export type AdminUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  role: number | null
  role_name: string | null
  department: number | null
  department_name: string | null
  date_joined: string
  last_login: string | null
}

/** Create-only write shape. No `password` and no `is_active` — SEC-5's
 * `UserAdminSerializer.create` forces the account inactive with an
 * unusable password server-side no matter what is sent. */
export type UserCreateInput = {
  email: string
  first_name: string
  last_name: string
  role: number | null
  department: number | null
}

/** Edit write shape. `is_active` is only ever settable here — deactivating
 * (or reactivating) an already-invited account, never creating one. */
export type UserUpdateInput = UserCreateInput & { is_active: boolean }
