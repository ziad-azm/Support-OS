import { useMutation, useQueryClient } from '@tanstack/react-query'

import { branchKeys } from '@/shared/branches'

import { createBranch } from './createBranch'
import { deleteBranch } from './deleteBranch'
import { updateBranch } from './updateBranch'
import type { BranchInput } from '../types/branch'

// Invalidating the bare `branchKeys.all` prefix refreshes the admin list,
// any open detail query, AND the `useBranches()` picker query in
// `features/tickets`/`features/accounts`/`features/customers`/
// `features/reports` in one call — same reasoning
// `useDepartmentMutations.ts` documents for its own prefix.
function useInvalidateBranches() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: branchKeys.all })
}

export function useCreateBranch() {
  const invalidate = useInvalidateBranches()
  return useMutation({
    mutationFn: (input: BranchInput) => createBranch(input),
    onSuccess: invalidate,
  })
}

export function useUpdateBranch(id: number) {
  const invalidate = useInvalidateBranches()
  return useMutation({
    mutationFn: (input: BranchInput) => updateBranch(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteBranch() {
  const invalidate = useInvalidateBranches()
  return useMutation({
    mutationFn: (id: number) => deleteBranch(id),
    onSuccess: invalidate,
  })
}
