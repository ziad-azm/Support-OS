import { api } from '@/shared/lib/api/client'

export function deleteHoliday(id: number): Promise<void> {
  return api.delete(`/holidays/${id}/`)
}
