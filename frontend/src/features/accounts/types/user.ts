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
  date_joined: string
  last_login: string | null
}

/** Create-only write shape — includes `password`. */
export type UserCreateInput = {
  email: string
  first_name: string
  last_name: string
  is_active: boolean
  role: number | null
  password: string
}

/** Edit write shape — no `password`; the API silently ignores one anyway. */
export type UserUpdateInput = Omit<UserCreateInput, 'password'>
