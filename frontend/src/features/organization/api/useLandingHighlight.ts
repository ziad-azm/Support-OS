import { useQuery } from '@tanstack/react-query'

import { getLandingHighlight } from './getLandingHighlight'
import { landingContentKeys } from './landingKeys'

export function useLandingHighlight(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: landingContentKeys.resource('highlight', id),
    queryFn: () => getLandingHighlight(id),
    enabled: options?.enabled,
  })
}
