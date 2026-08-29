import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createUser } from './createUser'
import { updateUser } from './updateUser'
import { userKeys } from './userKeys'
import type { UserCreateInput, UserUpdateInput } from '../types/user'

// Every mutation invalidates the whole `users` key prefix — a create/edit
// changes which rows land on which page, the same reasoning
// `useCustomerMutations.ts` documents. CONVENTIONS.md §23. There is no
// `useDeleteUser` — `UserViewSet` has no `destroy` action (see the
// plan's `## Story Goal` for the verified CASCADE finding).
function useInvalidateUsers() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: userKeys.all })
}

export function useCreateUser() {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: UserCreateInput) => createUser(input),
    onSuccess: invalidate,
  })
}

export function useUpdateUser(id: number) {
  const invalidate = useInvalidateUsers()
  return useMutation({
    mutationFn: (input: UserUpdateInput) => updateUser(id, input),
    onSuccess: invalidate,
  })
}
