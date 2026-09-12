import { useQuery } from '@tanstack/react-query'

import { calendarKeys } from './calendarKeys'
import { getCalendars } from './getCalendars'

/** The picker query. Every consumer shares one cache entry, and every
 * write in `features/organization` invalidates it. */
export function useCalendars() {
  return useQuery({
    queryKey: calendarKeys.resource('options'),
    queryFn: getCalendars,
  })
}
