import { api } from '@/shared/lib/api/client'

import type { TicketSla } from '../types/ticketSla'

// A plain object (or `null`), not a paginated `Page<T>` — same reasoning
// as `getTicketContext.ts`/`getTicketHistory.ts` (Story 24/26).
export function getTicketSla(ticketId: number): Promise<TicketSla> {
  return api.get<TicketSla>(`/tickets/${ticketId}/sla/`)
}
