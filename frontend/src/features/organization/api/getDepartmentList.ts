import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Department } from '../types/department'

export type DepartmentListParams = ServerTableParams & { search?: string }

export function getDepartmentList(params: DepartmentListParams): Promise<Page<Department>> {
  return api.getPage<Department>('/departments/', { params })
}
