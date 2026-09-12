import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Calendar } from '../types/calendar'

export type CalendarListParams = ServerTableParams & { search?: string }

export function getCalendarList(params: CalendarListParams): Promise<Page<Calendar>> {
  return api.getPage<Calendar>('/calendars/', { params })
}
