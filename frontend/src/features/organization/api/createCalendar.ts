import { api } from '@/shared/lib/api/client'

import type { Calendar, CalendarInput } from '../types/calendar'

export function createCalendar(input: CalendarInput): Promise<Calendar> {
  return api.post<Calendar>('/calendars/', input)
}
