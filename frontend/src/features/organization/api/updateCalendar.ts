import { api } from '@/shared/lib/api/client'

import type { Calendar, CalendarInput } from '../types/calendar'

// PATCH, not PUT — matches `updateBranch.ts`.
export function updateCalendar(id: number, input: CalendarInput): Promise<Calendar> {
  return api.patch<Calendar>(`/calendars/${id}/`, input)
}
