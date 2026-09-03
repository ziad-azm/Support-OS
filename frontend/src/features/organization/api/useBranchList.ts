import { useQuery } from '@tanstack/react-query'

import { branchKeys } from '@/shared/branches'

import { getBranchList } from './getBranchList'
import type { BranchListParams } from './getBranchList'

export function useBranchList(params: BranchListParams) {
  return useQuery({
    queryKey: branchKeys.resource('list', params),
    queryFn: () => getBranchList(params),
  })
}
