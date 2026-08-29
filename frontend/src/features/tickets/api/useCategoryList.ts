import { useQuery } from '@tanstack/react-query'

import { getCategoryList } from './getCategoryList'
import type { CategoryListParams } from './getCategoryList'
import { ticketKeys } from './ticketKeys'

export function useCategoryList(params: CategoryListParams) {
  return useQuery({
    queryKey: ticketKeys.resource('categories', 'list', params),
    queryFn: () => getCategoryList(params),
  })
}
