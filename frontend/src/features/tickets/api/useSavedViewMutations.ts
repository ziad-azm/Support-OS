import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createSavedView } from './createSavedView'
import { deleteSavedView } from './deleteSavedView'
import { setDefaultSavedView } from './setDefaultSavedView'
import { updateSavedView } from './updateSavedView'
import { ticketKeys } from './ticketKeys'
import type { SavedViewInput, SavedViewRenameInput } from '../types/savedView'

function useInvalidateSavedViews() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ticketKeys.resource('saved-views') })
}

export function useCreateSavedView() {
  const invalidate = useInvalidateSavedViews()
  return useMutation({
    mutationFn: (input: SavedViewInput) => createSavedView(input),
    onSuccess: invalidate,
  })
}

export function useRenameSavedView(id: number) {
  const invalidate = useInvalidateSavedViews()
  return useMutation({
    mutationFn: (input: SavedViewRenameInput) => updateSavedView(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteSavedView() {
  const invalidate = useInvalidateSavedViews()
  return useMutation({
    mutationFn: (id: number) => deleteSavedView(id),
    onSuccess: invalidate,
  })
}

export function useSetDefaultSavedView() {
  const invalidate = useInvalidateSavedViews()
  return useMutation({
    mutationFn: ({ id, isDefault }: { id: number; isDefault: boolean }) =>
      setDefaultSavedView(id, isDefault),
    onSuccess: invalidate,
  })
}
