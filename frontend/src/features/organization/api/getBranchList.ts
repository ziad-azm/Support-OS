import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Branch } from '../types/branch'

export type BranchListParams = ServerTableParams & { search?: string }

export function getBranchList(params: BranchListParams): Promise<Page<Branch>> {
  return api.getPage<Branch>('/branches/', { params })
}
