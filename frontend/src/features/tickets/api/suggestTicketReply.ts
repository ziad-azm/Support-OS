import { api } from '@/shared/lib/api/client'

import type { TicketReplySuggestion } from '../types/ticketReplySuggestion'

/** No request body — the backend rebuilds the transcript and KB
 * grounding from the ticket's current state on every call; nothing is
 * cached or persisted server-side. */
export function suggestTicketReply(id: number): Promise<TicketReplySuggestion> {
  return api.post<TicketReplySuggestion>(`/tickets/${id}/suggest-reply/`)
}
