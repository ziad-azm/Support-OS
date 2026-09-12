import { useQuery } from '@tanstack/react-query'

import { getHolidays } from './getHolidays'

export function useHolidays(calendarId: number) {
  return useQuery({
    queryKey: ['organization', 'holidays', calendarId] as const,
    queryFn: () => getHolidays(calendarId),
  })
}
