import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createRole } from './createRole'
import { deleteRole } from './deleteRole'
import { updateRole } from './updateRole'
import { roleKeys } from './roleKeys'
import type { RoleInput } from '../types/role'

// Every mutation invalidates the whole `roles` key prefix, independently of
// `userKeys` — two separate resources under one feature folder, the same
// split `faqKeys`/`articleKeys` already use inside `knowledge-base`.
// CONVENTIONS.md §23.
function useInvalidateRoles() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: roleKeys.all })
}

export function useCreateRole() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (input: RoleInput) => createRole(input),
    onSuccess: invalidate,
  })
}

export function useUpdateRole(id: number) {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (input: RoleInput) => updateRole(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteRole() {
  const invalidate = useInvalidateRoles()
  return useMutation({
    mutationFn: (id: number) => deleteRole(id),
    onSuccess: invalidate,
  })
}
