import { api } from '@/shared/lib/api/client'

import type { Calendar } from '../types/calendar'

export function getCalendar(id: number): Promise<Calendar> {
  return api.get<Calendar>(`/calendars/${id}/`)
}
