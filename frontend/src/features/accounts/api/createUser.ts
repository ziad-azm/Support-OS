import { api } from '@/shared/lib/api/client'

import type { AdminUser, UserCreateInput } from '../types/user'

export function createUser(input: UserCreateInput): Promise<AdminUser> {
  return api.post<AdminUser>('/users/', input)
}
