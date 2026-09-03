/** Mirrors `apps.organization.serializers.BranchSerializer`'s read shape.
 * Lives in `shared/`, not `features/organization/`, because
 * `features/tickets`, `features/accounts`, `features/customers`, and
 * `features/reports` all need it and `no-restricted-imports` forbids a
 * cross-feature import (CONVENTIONS.md §15/§33). */
export type Branch = {
  id: number
  name: string
  description: string
  created_at: string
  updated_at: string
}
