/** Mirrors `apps.accounts.serializers.RoleAdminSerializer` verbatim. */
export type Role = {
  id: number
  slug: string
  name: string
  description: string
  permissions: string[]
  requires_two_factor: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}

/** The write shape. `is_system` is server-managed; `permissions` is
 * writable here as of SEC-2 (Story 49); `requires_two_factor` as of SEC-9
 * (Story 107). */
export type RoleInput = {
  slug: string
  name: string
  description: string
  permissions: string[]
  requires_two_factor: boolean
}
