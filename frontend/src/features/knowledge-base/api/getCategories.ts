import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Category } from '../types/category'

// page_size: 100 (the server's max) — no search-as-you-type combobox exists
// yet, the same simplification `tickets/api/getCategories.ts` accepted.
export function getCategories(): Promise<Page<Category>> {
  return api.getPage<Category>('/article-categories/', {
    params: { page_size: 100, ordering: 'name' },
  })
}
