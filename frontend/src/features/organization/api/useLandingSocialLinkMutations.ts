import { useMutation, useQueryClient } from '@tanstack/react-query'

import { landingKeys } from '@/shared/landing'

import { createLandingSocialLink } from './createLandingSocialLink'
import { deleteLandingSocialLink } from './deleteLandingSocialLink'
import { updateLandingSocialLink } from './updateLandingSocialLink'
import { landingContentKeys } from './landingKeys'
import type { LandingSocialLinkInput } from '../types/landing'

// Invalidating the bare `landingContentKeys.all` prefix refreshes the admin
// list AND any open detail query in one call — same reasoning
// `useLandingHighlightMutations.ts` documents for its own prefix.
// `landingKeys.all` is the PUBLIC payload: a toggled, reordered, or deleted
// link must reach the live footer without a reload.
function useInvalidateSocialLinks() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: landingContentKeys.all })
    queryClient.invalidateQueries({ queryKey: landingKeys.all })
  }
}

export function useCreateLandingSocialLink() {
  const invalidate = useInvalidateSocialLinks()
  return useMutation({
    mutationFn: (input: LandingSocialLinkInput) => createLandingSocialLink(input),
    onSuccess: invalidate,
  })
}

export function useUpdateLandingSocialLink(id: number) {
  const invalidate = useInvalidateSocialLinks()
  return useMutation({
    mutationFn: (input: LandingSocialLinkInput) => updateLandingSocialLink(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteLandingSocialLink() {
  const invalidate = useInvalidateSocialLinks()
  return useMutation({
    mutationFn: (id: number) => deleteLandingSocialLink(id),
    onSuccess: invalidate,
  })
}
