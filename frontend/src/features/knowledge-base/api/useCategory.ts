import { useQuery } from '@tanstack/react-query'

import { getCategory } from './getCategory'
import { articleKeys } from './articleKeys'

export function useCategory(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: articleKeys.resource('categories', 'detail', id),
    queryFn: () => getCategory(id),
    enabled: options?.enabled,
  })
}
