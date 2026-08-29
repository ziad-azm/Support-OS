import { api } from '@/shared/lib/api/client'

import type { Role, RoleInput } from '../types/role'

// PATCH, not PUT — CONVENTIONS.md §23.
export function updateRole(id: number, input: RoleInput): Promise<Role> {
  return api.patch<Role>(`/roles/${id}/`, input)
}
