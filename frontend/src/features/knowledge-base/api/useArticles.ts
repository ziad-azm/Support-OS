import { useQuery } from '@tanstack/react-query'

import { getArticles } from './getArticles'
import type { ArticleListParams } from './getArticles'
import { articleKeys } from './articleKeys'

export function useArticles(params: ArticleListParams) {
  return useQuery({
    queryKey: articleKeys.resource('list', params),
    queryFn: () => getArticles(params),
  })
}
