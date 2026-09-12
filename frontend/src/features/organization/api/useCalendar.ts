import { useQuery } from '@tanstack/react-query'

import { calendarKeys } from '@/shared/calendars'

import { getCalendar } from './getCalendar'

export function useCalendar(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: calendarKeys.resource('detail', id),
    queryFn: () => getCalendar(id),
    enabled: options?.enabled,
  })
}
