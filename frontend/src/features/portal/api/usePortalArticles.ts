import { useQuery } from '@tanstack/react-query'

import { getPortalArticles } from './getPortalArticles'
import type { PortalArticleListParams } from './getPortalArticles'
import { portalArticleKeys } from './portalArticleKeys'

export function usePortalArticles(params: PortalArticleListParams) {
  return useQuery({
    queryKey: portalArticleKeys.resource('list', params),
    queryFn: () => getPortalArticles(params),
  })
}
