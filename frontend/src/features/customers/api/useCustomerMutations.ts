import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createCustomer } from './createCustomer'
import { customerKeys } from './customerKeys'
import { deleteCustomer } from './deleteCustomer'
import { updateCustomer } from './updateCustomer'
import type { CustomerInput } from '../types/customer'

/**
 * Every customer write invalidates the whole `customers` key prefix.
 *
 * Prefix-wide, not surgical: a create changes which rows land on which page,
 * an edit can change the sort position, and a delete shifts every subsequent
 * page. Invalidating one page's key would leave the others stale. This is
 * what `featureKey`'s `all` exists for — see README § Consuming the API.
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) => createCustomer(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useUpdateCustomer(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerInput) => updateCustomer(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteCustomer(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  })
}
