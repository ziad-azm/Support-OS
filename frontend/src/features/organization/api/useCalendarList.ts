import { useQuery } from '@tanstack/react-query'

import { calendarKeys } from '@/shared/calendars'

import { getCalendarList } from './getCalendarList'
import type { CalendarListParams } from './getCalendarList'

export function useCalendarList(params: CalendarListParams) {
  return useQuery({
    queryKey: calendarKeys.resource('list', params),
    queryFn: () => getCalendarList(params),
  })
}
