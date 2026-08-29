import { api } from '@/shared/lib/api/client'

import type { Category, CategoryInput } from '../types/category'

export function createCategory(input: CategoryInput): Promise<Category> {
  return api.post<Category>('/categories/', input)
}
