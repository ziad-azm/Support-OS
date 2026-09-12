import { api } from '@/shared/lib/api/client'

import type { Holiday, HolidayInput } from '../types/holiday'

export function createHoliday(input: HolidayInput): Promise<Holiday> {
  return api.post<Holiday>('/holidays/', input)
}
