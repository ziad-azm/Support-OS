/** Mirrors `apps.accounts.serializers.RoleAdminSerializer` verbatim. */
export type Role = {
  id: number
  slug: string
  name: string
  description: string
  permissions: string[]
  is_system: boolean
  created_at: string
  updated_at: string
}

/** The write shape. `is_system` is server-managed; `permissions` is
 * writable here as of SEC-2 (Story 49). */
export type RoleInput = {
  slug: string
  name: string
  description: string
  permissions: string[]
}
