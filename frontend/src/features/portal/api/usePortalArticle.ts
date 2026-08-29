import { useQuery } from '@tanstack/react-query'

import { getPortalArticle } from './getPortalArticle'
import { portalArticleKeys } from './portalArticleKeys'

export function usePortalArticle(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: portalArticleKeys.resource('detail', id),
    queryFn: () => getPortalArticle(id),
    enabled: options?.enabled,
  })
}
