import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Role } from '../types/role'

export type RoleListParams = ServerTableParams & { search?: string }

export function getRoles(params: RoleListParams): Promise<Page<Role>> {
  return api.getPage<Role>('/roles/', { params })
}
