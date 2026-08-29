import { useQuery } from '@tanstack/react-query'

import { getPortalFaqs } from './getPortalFaqs'
import type { PortalFaqListParams } from './getPortalFaqs'
import { portalFaqKeys } from './portalFaqKeys'

export function usePortalFaqs(params: PortalFaqListParams) {
  return useQuery({
    queryKey: portalFaqKeys.resource('list', params),
    queryFn: () => getPortalFaqs(params),
  })
}
