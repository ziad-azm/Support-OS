import { api } from '@/shared/lib/api/client'

import type { AdminUser, UserUpdateInput } from '../types/user'

// PATCH, not PUT — CONVENTIONS.md §23.
export function updateUser(id: number, input: UserUpdateInput): Promise<AdminUser> {
  return api.patch<AdminUser>(`/users/${id}/`, input)
}
