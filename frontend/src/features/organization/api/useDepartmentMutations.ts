import { useMutation, useQueryClient } from '@tanstack/react-query'

import { departmentKeys } from '@/shared/departments'

import { createDepartment } from './createDepartment'
import { deleteDepartment } from './deleteDepartment'
import { updateDepartment } from './updateDepartment'
import type { DepartmentInput } from '../types/department'

// Invalidating the bare `departmentKeys.all` prefix refreshes the admin
// list, any open detail query, AND the `useDepartments()` picker query in
// `features/tickets`/`features/accounts`/`features/reports` in one call —
// same reasoning `useCategoryMutations.ts` documents for its own prefix.
function useInvalidateDepartments() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: departmentKeys.all })
}

export function useCreateDepartment() {
  const invalidate = useInvalidateDepartments()
  return useMutation({
    mutationFn: (input: DepartmentInput) => createDepartment(input),
    onSuccess: invalidate,
  })
}

export function useUpdateDepartment(id: number) {
  const invalidate = useInvalidateDepartments()
  return useMutation({
    mutationFn: (input: DepartmentInput) => updateDepartment(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteDepartment() {
  const invalidate = useInvalidateDepartments()
  return useMutation({
    mutationFn: (id: number) => deleteDepartment(id),
    onSuccess: invalidate,
  })
}
