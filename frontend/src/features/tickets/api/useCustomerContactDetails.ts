import { useQuery } from '@tanstack/react-query'

import { getCustomerContactDetails } from './getCustomerContactDetails'
import { ticketKeys } from './ticketKeys'

/** Read-only, for `ReplyForm`'s `target_address` options — see
 * `types/contactDetail.ts`'s own docstring for why this duplicates
 * `features/customers`' identical hook instead of importing it. */
export function useCustomerContactDetails(customerId: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ticketKeys.resource('customerContactDetails', customerId),
    queryFn: () => getCustomerContactDetails(customerId),
    enabled: options?.enabled,
  })
}
