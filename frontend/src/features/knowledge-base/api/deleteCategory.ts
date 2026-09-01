import { api } from '@/shared/lib/api/client'

export function deleteCategory(id: number): Promise<void> {
  return api.delete(`/article-categories/${id}/`)
}
