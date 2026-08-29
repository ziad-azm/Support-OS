import { api } from '@/shared/lib/api/client'

import type { Role, RoleInput } from '../types/role'

export function createRole(input: RoleInput): Promise<Role> {
  return api.post<Role>('/roles/', input)
}
