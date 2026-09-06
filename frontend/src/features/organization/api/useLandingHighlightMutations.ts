import { useMutation, useQueryClient } from '@tanstack/react-query'

import { landingKeys } from '@/shared/landing'

import { createLandingHighlight } from './createLandingHighlight'
import { deleteLandingHighlight } from './deleteLandingHighlight'
import { updateLandingHighlight } from './updateLandingHighlight'
import { landingContentKeys } from './landingKeys'
import type { LandingHighlightInput } from '../types/landing'

// Invalidating the bare `landingContentKeys.all` prefix refreshes the admin
// list AND any open detail query in one call — same reasoning
// `useDepartmentMutations.ts` documents for its own prefix. `landingKeys.all`
// is the PUBLIC payload: a new, reordered, or deleted card must reach the
// live landing page without a reload.
function useInvalidateHighlights() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: landingContentKeys.all })
    queryClient.invalidateQueries({ queryKey: landingKeys.all })
  }
}

export function useCreateLandingHighlight() {
  const invalidate = useInvalidateHighlights()
  return useMutation({
    mutationFn: (input: LandingHighlightInput) => createLandingHighlight(input),
    onSuccess: invalidate,
  })
}

export function useUpdateLandingHighlight(id: number) {
  const invalidate = useInvalidateHighlights()
  return useMutation({
    mutationFn: (input: LandingHighlightInput) => updateLandingHighlight(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteLandingHighlight() {
  const invalidate = useInvalidateHighlights()
  return useMutation({
    mutationFn: (id: number) => deleteLandingHighlight(id),
    onSuccess: invalidate,
  })
}
