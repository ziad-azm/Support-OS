import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createHoliday } from './createHoliday'
import { deleteHoliday } from './deleteHoliday'
import { updateHoliday } from './updateHoliday'
import type { HolidayInput } from '../types/holiday'

/** Scoped invalidation, the same `useWorkingWindowMutations.ts` shape:
 * a holiday write for one calendar never affects another calendar. */
function useInvalidateHolidays(calendarId: number) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ['organization', 'holidays', calendarId] })
}

export function useCreateHoliday(calendarId: number) {
  const invalidate = useInvalidateHolidays(calendarId)
  return useMutation({
    mutationFn: (input: HolidayInput) => createHoliday(input),
    onSuccess: invalidate,
  })
}

export function useUpdateHoliday(calendarId: number, id: number) {
  const invalidate = useInvalidateHolidays(calendarId)
  return useMutation({
    mutationFn: (input: HolidayInput) => updateHoliday(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteHoliday(calendarId: number) {
  const invalidate = useInvalidateHolidays(calendarId)
  return useMutation({
    mutationFn: (id: number) => deleteHoliday(id),
    onSuccess: invalidate,
  })
}
