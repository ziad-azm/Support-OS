import { api } from '@/shared/lib/api/client'

import type { Ticket } from '../types/ticket'

export function mergeTicket(sourceId: number, targetId: number): Promise<Ticket> {
  return api.post<Ticket>(`/tickets/${sourceId}/merge/`, { target_id: targetId })
}
