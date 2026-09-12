import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { WorkingWindow } from '../types/workingWindow'

// `page_size: 100` requests every window in one page — this list has no
// pagination UI (at most seven rows inline on the calendar form), the
// same reasoning `getContactDetails.ts` records for itself.
export function getWorkingWindows(calendarId: number): Promise<Page<WorkingWindow>> {
  return api.getPage<WorkingWindow>('/working-windows/', {
    params: { calendar: calendarId, page_size: 100 },
  })
}
