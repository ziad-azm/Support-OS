import { useMutation, useQueryClient } from '@tanstack/react-query'

import { calendarKeys } from '@/shared/calendars'

import { createCalendar } from './createCalendar'
import { deleteCalendar } from './deleteCalendar'
import { updateCalendar } from './updateCalendar'
import type { CalendarInput } from '../types/calendar'

// Invalidating the bare `calendarKeys.all` prefix refreshes the admin
// list, any open detail query, AND the `useCalendars()` picker query in
// `BranchFormPage.tsx` in one call — same reasoning
// `useBranchMutations.ts` documents for its own prefix.
function useInvalidateCalendars() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: calendarKeys.all })
}

export function useCreateCalendar() {
  const invalidate = useInvalidateCalendars()
  return useMutation({
    mutationFn: (input: CalendarInput) => createCalendar(input),
    onSuccess: invalidate,
  })
}

export function useUpdateCalendar(id: number) {
  const invalidate = useInvalidateCalendars()
  return useMutation({
    mutationFn: (input: CalendarInput) => updateCalendar(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteCalendar() {
  const invalidate = useInvalidateCalendars()
  return useMutation({
    mutationFn: (id: number) => deleteCalendar(id),
    onSuccess: invalidate,
  })
}
