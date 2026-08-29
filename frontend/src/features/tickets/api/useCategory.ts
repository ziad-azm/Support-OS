import { useQuery } from '@tanstack/react-query'

import { getCategory } from './getCategory'
import { ticketKeys } from './ticketKeys'

export function useCategory(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ticketKeys.resource('categories', 'detail', id),
    queryFn: () => getCategory(id),
    enabled: options?.enabled,
  })
}
