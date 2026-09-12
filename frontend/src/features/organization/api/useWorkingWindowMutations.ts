import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createWorkingWindow } from './createWorkingWindow'
import { deleteWorkingWindow } from './deleteWorkingWindow'
import { updateWorkingWindow } from './updateWorkingWindow'
import type { WorkingWindowInput } from '../types/workingWindow'

/**
 * Scoped invalidation, narrower than any feature-wide prefix — a
 * deliberate mirror of `useContactDetailMutations.ts`: a working-window
 * write for one calendar never affects another calendar's windows, or
 * the calendar list/detail queries themselves.
 */
function useInvalidateWorkingWindows(calendarId: number) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: ['organization', 'working-windows', calendarId] })
}

export function useCreateWorkingWindow(calendarId: number) {
  const invalidate = useInvalidateWorkingWindows(calendarId)
  return useMutation({
    mutationFn: (input: WorkingWindowInput) => createWorkingWindow(input),
    onSuccess: invalidate,
  })
}

export function useUpdateWorkingWindow(calendarId: number, id: number) {
  const invalidate = useInvalidateWorkingWindows(calendarId)
  return useMutation({
    mutationFn: (input: WorkingWindowInput) => updateWorkingWindow(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteWorkingWindow(calendarId: number) {
  const invalidate = useInvalidateWorkingWindows(calendarId)
  return useMutation({
    mutationFn: (id: number) => deleteWorkingWindow(id),
    onSuccess: invalidate,
  })
}
