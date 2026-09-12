import { api } from '@/shared/lib/api/client'

import type { Holiday, HolidayInput } from '../types/holiday'

export function updateHoliday(id: number, input: HolidayInput): Promise<Holiday> {
  return api.patch<Holiday>(`/holidays/${id}/`, input)
}
