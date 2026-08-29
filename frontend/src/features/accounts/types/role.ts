/** Mirrors `apps.accounts.serializers.RoleAdminSerializer` verbatim. */
export type Role = {
  id: number
  slug: string
  name: string
  description: string
  /** Read-only here — editing this list is SEC-2. */
  permissions: string[]
  is_system: boolean
  created_at: string
  updated_at: string
}

/** The write shape. `permissions`/`is_system` are server-managed. */
export type RoleInput = {
  slug: string
  name: string
  description: string
}
