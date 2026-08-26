import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getCustomers } from './getCustomers'
import type { CustomerListParams } from './getCustomers'

export function useCustomers(params: CustomerListParams) {
  return useQuery({
    // `params` is in the key: a different page/sort/search is a different
    // cache entry, and `useServerTable` memoises the object so this is stable.
    queryKey: customerKeys.resource('list', params),
    queryFn: () => getCustomers(params),
  })
}
