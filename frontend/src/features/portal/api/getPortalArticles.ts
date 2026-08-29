import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { PortalArticle } from '../types/portalArticle'

export type PortalArticleListParams = ServerTableParams

export function getPortalArticles(params: PortalArticleListParams): Promise<Page<PortalArticle>> {
  return api.getPage<PortalArticle>('/articles/', { params })
}
