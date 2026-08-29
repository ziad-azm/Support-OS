import { api } from '@/shared/lib/api/client'

import type { Role } from '../types/role'

export function getRole(id: number): Promise<Role> {
  return api.get<Role>(`/roles/${id}/`)
}
