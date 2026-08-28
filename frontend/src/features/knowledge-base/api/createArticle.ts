import { api } from '@/shared/lib/api/client'

import type { Article, ArticleInput } from '../types/article'

export function createArticle(input: ArticleInput): Promise<Article> {
  return api.post<Article>('/articles/', input)
}
