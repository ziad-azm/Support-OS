import { api } from '@/shared/lib/api/client'

import type { TicketSolutionSuggestions } from '../types/ticketSolutionSuggestions'

/** No request body — the backend rebuilds the search query and re-runs
 * the knowledge-base search from the ticket's current state on every
 * call; nothing is cached or persisted server-side. */
export function suggestTicketSolutions(id: number): Promise<TicketSolutionSuggestions> {
  return api.post<TicketSolutionSuggestions>(`/tickets/${id}/suggest-solutions/`)
}
