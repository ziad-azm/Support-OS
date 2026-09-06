import { useQuery } from '@tanstack/react-query'

import { getLandingContent } from './getLandingContent'
import { landingContentKeys } from './landingKeys'

/** Named `…Admin` to keep it visibly distinct from `shared/landing`'s
 * `useLandingContent()`, which reads the public endpoint. This one is behind
 * `settings.manage` and has NO bundle fallback — the editor should show
 * `QueryBoundary`'s error state when it cannot load, unlike the public page. */
export function useLandingContentAdmin() {
  return useQuery({
    queryKey: landingContentKeys.resource('detail'),
    queryFn: getLandingContent,
  })
}
