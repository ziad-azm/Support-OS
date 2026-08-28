import { useQuery } from '@tanstack/react-query'

import { getFaq } from './getFaq'
import { faqKeys } from './faqKeys'

export function useFaq(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: faqKeys.resource('detail', id),
    queryFn: () => getFaq(id),
    enabled: options?.enabled,
  })
}
