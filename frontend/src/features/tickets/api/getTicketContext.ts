import { api } from '@/shared/lib/api/client'

import type { TicketContext } from '../types/ticketContext'

// A plain object, not a paginated `Page<T>` — same reasoning as
// `getTicketHistory.ts` (Story 24): the endpoint returns one combined
// payload, already capped server-side.
export function getTicketContext(ticketId: number): Promise<TicketContext> {
  return api.get<TicketContext>(`/tickets/${ticketId}/context/`)
}
