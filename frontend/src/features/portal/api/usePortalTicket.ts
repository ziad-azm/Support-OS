import { useQuery } from '@tanstack/react-query'

import { getPortalTicket } from './getPortalTicket'
import { portalTicketKeys } from './portalTicketKeys'

export function usePortalTicket(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: portalTicketKeys.resource('detail', id),
    queryFn: () => getPortalTicket(id),
    enabled: options?.enabled,
  })
}
