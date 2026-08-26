import { api } from '@/shared/lib/api/client'

import type { Ticket } from '../types/ticket'

export function getTicket(id: number): Promise<Ticket> {
  return api.get<Ticket>(`/tickets/${id}/`)
}
