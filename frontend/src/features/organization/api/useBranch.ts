import { useQuery } from '@tanstack/react-query'

import { branchKeys } from '@/shared/branches'

import { getBranch } from './getBranch'

export function useBranch(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: branchKeys.resource('detail', id),
    queryFn: () => getBranch(id),
    enabled: options?.enabled,
  })
}
