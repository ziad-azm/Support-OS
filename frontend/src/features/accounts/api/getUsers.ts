import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { AdminUser } from '../types/user'

export type UserListParams = ServerTableParams & { search?: string }

export function getUsers(params: UserListParams): Promise<Page<AdminUser>> {
  return api.getPage<AdminUser>('/users/', { params })
}
