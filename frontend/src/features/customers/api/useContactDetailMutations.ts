import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createContactDetail } from './createContactDetail'
import { customerKeys } from './customerKeys'
import { deleteContactDetail } from './deleteContactDetail'
import { updateContactDetail } from './updateContactDetail'
import type { ContactDetailInput, ContactDetailUpdateInput } from '../types/contactDetail'

/**
 * Scoped invalidation, narrower than `customerKeys.all` — a deliberate
 * departure from `useCustomerMutations.ts`. CONVENTIONS.md §23's prefix-wide
 * rule exists because a paginated/sorted list's page or sort position can
 * shift on a write; contacts are neither. A contact write for one customer
 * never affects another customer's contacts, or the customer list/detail
 * queries, so invalidating only this customer's `contacts` key is precise —
 * see Story 11 `## Product rules`.
 */
function useInvalidateContacts(customerId: number) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: customerKeys.resource('contacts', customerId) })
}

export function useCreateContactDetail(customerId: number) {
  const invalidate = useInvalidateContacts(customerId)
  return useMutation({
    mutationFn: (input: ContactDetailInput) => createContactDetail(input),
    onSuccess: invalidate,
  })
}

export function useUpdateContactDetail(customerId: number, id: number) {
  const invalidate = useInvalidateContacts(customerId)
  return useMutation({
    mutationFn: (input: ContactDetailUpdateInput) => updateContactDetail(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteContactDetail(customerId: number) {
  const invalidate = useInvalidateContacts(customerId)
  return useMutation({
    mutationFn: (id: number) => deleteContactDetail(id),
    onSuccess: invalidate,
  })
}
