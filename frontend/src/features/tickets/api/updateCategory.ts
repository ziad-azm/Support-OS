import { api } from '@/shared/lib/api/client'

import type { Category, CategoryInput } from '../types/category'

// PATCH, not PUT — matches `updateRole.ts`.
export function updateCategory(id: number, input: CategoryInput): Promise<Category> {
  return api.patch<Category>(`/categories/${id}/`, input)
}
