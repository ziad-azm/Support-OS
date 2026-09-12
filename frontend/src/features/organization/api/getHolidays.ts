import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Holiday } from '../types/holiday'

// `page_size: 100` — the same "no pagination UI, request everything"
// simplification `getWorkingWindows.ts`/`getContactDetails.ts` accept.
export function getHolidays(calendarId: number): Promise<Page<Holiday>> {
  return api.getPage<Holiday>('/holidays/', { params: { calendar: calendarId, page_size: 100 } })
}
