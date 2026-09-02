import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Department } from './types'

// page_size: 100 (the server's max) — no search-as-you-type combobox
// exists yet, the same simplification `getCategories.ts` accepted.
export function getDepartments(): Promise<Page<Department>> {
  return api.getPage<Department>('/departments/', { params: { page_size: 100, ordering: 'name' } })
}
