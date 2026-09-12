import { useQuery } from '@tanstack/react-query'

import { getWorkingWindows } from './getWorkingWindows'

export function useWorkingWindows(calendarId: number) {
  return useQuery({
    queryKey: ['organization', 'working-windows', calendarId] as const,
    queryFn: () => getWorkingWindows(calendarId),
  })
}
