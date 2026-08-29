import { api } from '@/shared/lib/api/client'

import type { PortalTicket } from '../types/portalTicket'

export function getPortalTicket(id: number): Promise<PortalTicket> {
  return api.get<PortalTicket>(`/portal/tickets/${id}/`)
}
