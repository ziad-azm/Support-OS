import { api } from '@/shared/lib/api/client'

import type { TicketHistoryEntry } from '../types/ticketHistoryEntry'

// A plain array, not a paginated `Page<T>` — same reasoning as
// `getCustomerTimeline.ts` (Story 20): the endpoint merges two querysets in
// Python and caps the result itself (`HISTORY_MAX_ENTRIES`, 100).
export function getTicketHistory(ticketId: number): Promise<TicketHistoryEntry[]> {
  return api.get<TicketHistoryEntry[]>(`/tickets/${ticketId}/history/`)
}
