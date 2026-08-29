import { useQuery } from '@tanstack/react-query'

import { getPortalTickets } from './getPortalTickets'
import type { PortalTicketListParams } from './getPortalTickets'
import { portalTicketKeys } from './portalTicketKeys'

export function usePortalTickets(params: PortalTicketListParams) {
  return useQuery({
    queryKey: portalTicketKeys.resource('list', params),
    queryFn: () => getPortalTickets(params),
  })
}
