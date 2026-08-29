import { api } from '@/shared/lib/api/client'

import type { AdminUser } from '../types/user'

export function getUser(id: number): Promise<AdminUser> {
  return api.get<AdminUser>(`/users/${id}/`)
}
