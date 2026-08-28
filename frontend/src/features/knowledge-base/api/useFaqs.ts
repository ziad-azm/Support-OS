import { useQuery } from '@tanstack/react-query'

import { getFaqs } from './getFaqs'
import type { FaqListParams } from './getFaqs'
import { faqKeys } from './faqKeys'

export function useFaqs(params: FaqListParams) {
  return useQuery({
    queryKey: faqKeys.resource('list', params),
    queryFn: () => getFaqs(params),
  })
}
