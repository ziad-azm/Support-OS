import { api } from '@/shared/lib/api/client'

import type { Category } from '../types/category'

export function getCategory(id: number): Promise<Category> {
  return api.get<Category>(`/categories/${id}/`)
}
