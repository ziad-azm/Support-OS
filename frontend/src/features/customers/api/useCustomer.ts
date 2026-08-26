import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getCustomer } from './getCustomer'

/**
 * `enabled` lets a caller with a not-yet-numeric route param (e.g. a hand-
 * typed `/customers/NaN`) skip the request entirely rather than firing one
 * against a malformed URL. Defaults to enabled, like `useQuery` itself.
 */
export function useCustomer(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: customerKeys.resource('detail', id),
    queryFn: () => getCustomer(id),
    enabled: options?.enabled,
  })
}
