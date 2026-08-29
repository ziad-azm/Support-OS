import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { PortalTicket, PortalTicketStatus } from '../types/portalTicket'

export type PortalTicketListParams = ServerTableParams & {
  status?: PortalTicketStatus
}

export function getPortalTickets(params: PortalTicketListParams): Promise<Page<PortalTicket>> {
  return api.getPage<PortalTicket>('/portal/tickets/', { params })
}
