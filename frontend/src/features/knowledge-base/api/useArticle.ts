import { useQuery } from '@tanstack/react-query'

import { getArticle } from './getArticle'
import { articleKeys } from './articleKeys'

export function useArticle(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: articleKeys.resource('detail', id),
    queryFn: () => getArticle(id),
    enabled: options?.enabled,
  })
}
