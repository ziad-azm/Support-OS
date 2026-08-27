import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createNote } from './createNote'
import { customerKeys } from './customerKeys'
import { deleteNote } from './deleteNote'
import { updateNote } from './updateNote'
import type { NoteInput, NoteUpdateInput } from '../types/note'

/** Scoped invalidation, not the whole-feature prefix — a note write for one
 * customer never affects another's, same reasoning as
 * `useContactDetailMutations.ts` (Story 11 `## Product rules`). */
function useInvalidateNotes(customerId: number) {
  const queryClient = useQueryClient()
  return () =>
    queryClient.invalidateQueries({ queryKey: customerKeys.resource('notes', customerId) })
}

export function useCreateNote(customerId: number) {
  const invalidate = useInvalidateNotes(customerId)
  return useMutation({
    mutationFn: (input: NoteInput) => createNote(input),
    onSuccess: invalidate,
  })
}

export function useUpdateNote(customerId: number, id: number) {
  const invalidate = useInvalidateNotes(customerId)
  return useMutation({
    mutationFn: (input: NoteUpdateInput) => updateNote(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteNote(customerId: number) {
  const invalidate = useInvalidateNotes(customerId)
  return useMutation({
    mutationFn: (id: number) => deleteNote(id),
    onSuccess: invalidate,
  })
}
