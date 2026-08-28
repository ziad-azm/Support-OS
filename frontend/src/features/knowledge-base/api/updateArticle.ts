import { api } from '@/shared/lib/api/client'

import type { Article, ArticleInput } from '../types/article'

// PATCH, not PUT — CONVENTIONS.md §23.
export function updateArticle(id: number, input: ArticleInput): Promise<Article> {
  return api.patch<Article>(`/articles/${id}/`, input)
}
