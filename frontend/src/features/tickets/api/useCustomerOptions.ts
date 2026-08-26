import { useQuery } from '@tanstack/react-query'

import { getCustomerOptions } from './getCustomerOptions'
import { ticketKeys } from './ticketKeys'

/**
 * Cached under `ticketKeys`, not `customerKeys` — this feature cannot import
 * `@/features/customers` (CONVENTIONS.md §15), so it has no access to that
 * feature's cache namespace either. The data is fetched independently from
 * whatever the customers feature has cached; a small, accepted duplication
 * that is the direct cost of the enforced feature boundary, not an oversight.
 */
export function useCustomerOptions() {
  return useQuery({
    queryKey: ticketKeys.resource('customerOptions'),
    queryFn: getCustomerOptions,
  })
}
