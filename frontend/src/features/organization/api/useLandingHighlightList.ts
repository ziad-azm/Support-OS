import { useQuery } from '@tanstack/react-query'

import { getLandingHighlightList } from './getLandingHighlightList'
import type { LandingHighlightListParams } from './getLandingHighlightList'
import { landingContentKeys } from './landingKeys'

export function useLandingHighlightList(params: LandingHighlightListParams) {
  return useQuery({
    queryKey: landingContentKeys.resource('highlights', params),
    queryFn: () => getLandingHighlightList(params),
  })
}
