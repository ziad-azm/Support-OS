import { api } from '@/shared/lib/api/client'

import type { PortalTicketCreated, PortalTicketInput } from '../types/portalTicket'

export function createPortalTicket(input: PortalTicketInput): Promise<PortalTicketCreated> {
  return api.post<PortalTicketCreated>('/portal/tickets/', input)
}
