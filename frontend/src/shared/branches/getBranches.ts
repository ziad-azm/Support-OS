import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Branch } from './types'

// page_size: 100 (the server's max) — no search-as-you-type combobox
// exists yet, the same simplification `getDepartments.ts` accepted.
export function getBranches(): Promise<Page<Branch>> {
  return api.getPage<Branch>('/branches/', { params: { page_size: 100, ordering: 'name' } })
}
