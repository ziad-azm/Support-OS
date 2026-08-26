import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getContactDetails } from './getContactDetails'

export function useContactDetails(customerId: number) {
  return useQuery({
    queryKey: customerKeys.resource('contacts', customerId),
    queryFn: () => getContactDetails(customerId),
  })
}
