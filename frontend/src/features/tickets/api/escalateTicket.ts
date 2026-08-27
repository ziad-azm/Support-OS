import { api } from '@/shared/lib/api/client'

import type { Ticket } from '../types/ticket'

/** `escalated` is always sent explicitly — the backend rejects an omitted
 * key or a re-statement of the current state with a 400. */
export function escalateTicket(id: number, escalated: boolean): Promise<Ticket> {
  return api.post<Ticket>(`/tickets/${id}/escalate/`, { escalated })
}
