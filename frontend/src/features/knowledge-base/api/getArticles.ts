import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Article } from '../types/article'

export type ArticleListParams = ServerTableParams & { search?: string }

export function getArticles(params: ArticleListParams): Promise<Page<Article>> {
  return api.getPage<Article>('/articles/', { params })
}
