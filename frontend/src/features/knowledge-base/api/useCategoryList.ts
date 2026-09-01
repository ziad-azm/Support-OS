import { useQuery } from '@tanstack/react-query'

import { getCategoryList } from './getCategoryList'
import type { CategoryListParams } from './getCategoryList'
import { articleKeys } from './articleKeys'

export function useCategoryList(params: CategoryListParams) {
  return useQuery({
    queryKey: articleKeys.resource('categories', 'list', params),
    queryFn: () => getCategoryList(params),
  })
}
