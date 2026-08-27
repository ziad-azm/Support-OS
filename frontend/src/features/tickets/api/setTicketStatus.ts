import { api } from '@/shared/lib/api/client'

import type { Ticket, TicketStatus } from '../types/ticket'

/** `status` is always sent explicitly. The backend rejects an omitted key,
 * an unrecognised value, or a no-op (same status) with a 400. */
export function setTicketStatus(id: number, status: TicketStatus): Promise<Ticket> {
  return api.post<Ticket>(`/tickets/${id}/status/`, { status })
}
