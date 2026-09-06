import { useMutation, useQueryClient } from '@tanstack/react-query'

import { landingKeys } from '@/shared/landing'

import { updateLandingContent } from './updateLandingContent'
import { landingContentKeys } from './landingKeys'
import type { LandingContentInput } from '../types/landing'

export function useUpdateLandingContent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LandingContentInput) => updateLandingContent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: landingContentKeys.all })
      // The public payload is the same row read through a narrower
      // serializer — LAND-2. Without this, an admin saves new landing copy
      // and the live page keeps the old text until a reload, the same trap
      // `useUpdateSettings` documents for branding.
      queryClient.invalidateQueries({ queryKey: landingKeys.all })
    },
  })
}
