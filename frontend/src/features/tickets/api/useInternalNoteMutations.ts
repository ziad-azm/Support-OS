import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createInternalNote } from './createInternalNote'
import { deleteInternalNote } from './deleteInternalNote'
import { ticketKeys } from './ticketKeys'
import { updateInternalNote } from './updateInternalNote'
import type { InternalNoteInput, InternalNoteUpdateInput } from '../types/internalNote'

// Scoped invalidation, not the whole-feature prefix — an internal-note
// write for one ticket never affects another's, the same reasoning
// `useNoteMutations.ts` (features/customers) already documents.
function useInvalidateInternalNotes(ticketId: number) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: ticketKeys.resource('internalNotes', ticketId) })
}

export function useCreateInternalNote(ticketId: number) {
  const invalidate = useInvalidateInternalNotes(ticketId)
  return useMutation({
    mutationFn: (input: InternalNoteInput) => createInternalNote(input),
    onSuccess: invalidate,
  })
}

export function useUpdateInternalNote(ticketId: number, id: number) {
  const invalidate = useInvalidateInternalNotes(ticketId)
  return useMutation({
    mutationFn: (input: InternalNoteUpdateInput) => updateInternalNote(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteInternalNote(ticketId: number) {
  const invalidate = useInvalidateInternalNotes(ticketId)
  return useMutation({
    mutationFn: (id: number) => deleteInternalNote(id),
    onSuccess: invalidate,
  })
}
