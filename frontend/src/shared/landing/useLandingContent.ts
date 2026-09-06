import { useQuery } from '@tanstack/react-query'

import { fetchLandingContent } from './fetchLandingContent'
import { landingKeys } from './landingKeys'

/**
 * The fetch half of landing content. `staleTime: Infinity` and NO
 * `meta.toastOnError`, for exactly the reasons `shared/branding/
 * useBranding.ts` records for itself: the content only changes when an admin
 * saves (which invalidates this key directly), and a failure must be
 * INVISIBLE — this runs on the product's front door for an anonymous
 * visitor, who gets the shipped bundle copy and no error at all.
 *
 * Callers must render from bundle defaults while `data` is undefined.
 * `resolveLanding(undefined, …)` returns exactly that.
 */
export function useLandingContent() {
  return useQuery({
    queryKey: landingKeys.resource('current'),
    queryFn: fetchLandingContent,
    staleTime: Infinity,
    retry: 1,
  })
}
