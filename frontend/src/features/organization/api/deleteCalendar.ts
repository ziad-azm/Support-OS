import { api } from '@/shared/lib/api/client'

export function deleteCalendar(id: number): Promise<void> {
  return api.delete(`/calendars/${id}/`)
}
