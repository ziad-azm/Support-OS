import { api } from '@/shared/lib/api/client'

import type { Ticket } from '../types/ticket'

/** `assigned_agent` is always sent explicitly — `null` unassigns. The
 * backend rejects an omitted key with a 400 rather than guessing. */
export function assignTicket(id: number, assignedAgent: number | null): Promise<Ticket> {
  return api.post<Ticket>(`/tickets/${id}/assign/`, { assigned_agent: assignedAgent })
}
