import { useQuery } from '@tanstack/react-query'

import { getCategories } from './getCategories'
import { ticketKeys } from './ticketKeys'

export function useCategories() {
  return useQuery({
    queryKey: ticketKeys.resource('categories'),
    queryFn: getCategories,
  })
}
