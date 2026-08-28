import { api } from '@/shared/lib/api/client'

import type { Article } from '../types/article'

export function getArticle(id: number): Promise<Article> {
  return api.get<Article>(`/articles/${id}/`)
}
