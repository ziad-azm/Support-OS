import { useQuery } from '@tanstack/react-query'

import { getWebFormCategories } from './getWebFormCategories'

export function useWebFormCategories() {
  return useQuery({
    queryKey: ['webForm', 'categories'],
    queryFn: getWebFormCategories,
  })
}
