import { useQuery } from '@tanstack/react-query'

import { getCategories } from './getCategories'
import { articleKeys } from './articleKeys'

export function useCategories() {
  return useQuery({
    queryKey: articleKeys.resource('categories'),
    queryFn: getCategories,
  })
}
