import { useQuery } from '@tanstack/react-query'

import { getLandingSocialLink } from './getLandingSocialLink'
import { landingContentKeys } from './landingKeys'

export function useLandingSocialLink(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: landingContentKeys.resource('socialLink', id),
    queryFn: () => getLandingSocialLink(id),
    enabled: options?.enabled,
  })
}
