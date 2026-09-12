import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Calendar } from './types'

// page_size: 100 (the server's max) — no search-as-you-type combobox
// exists yet, the same simplification `getBranches.ts` accepted.
export function getCalendars(): Promise<Page<Calendar>> {
  return api.getPage<Calendar>('/calendars/', { params: { page_size: 100, ordering: 'name' } })
}
