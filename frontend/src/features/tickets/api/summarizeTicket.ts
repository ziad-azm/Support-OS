import { api } from '@/shared/lib/api/client'

import type { TicketSummary } from '../types/ticketSummary'

/** No request body — the backend rebuilds the transcript from the
 * ticket's current messages on every call; nothing is cached or
 * persisted server-side. */
export function summarizeTicket(id: number): Promise<TicketSummary> {
  return api.post<TicketSummary>(`/tickets/${id}/summarize/`)
}
