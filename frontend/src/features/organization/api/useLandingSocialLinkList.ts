import { useQuery } from '@tanstack/react-query'

import { getLandingSocialLinkList } from './getLandingSocialLinkList'
import type { LandingSocialLinkListParams } from './getLandingSocialLinkList'
import { landingContentKeys } from './landingKeys'

export function useLandingSocialLinkList(params: LandingSocialLinkListParams) {
  return useQuery({
    queryKey: landingContentKeys.resource('socialLinks', params),
    queryFn: () => getLandingSocialLinkList(params),
  })
}
