import { api } from '@/shared/lib/api/client'

export function deleteArticle(id: number): Promise<void> {
  return api.delete(`/articles/${id}/`)
}
