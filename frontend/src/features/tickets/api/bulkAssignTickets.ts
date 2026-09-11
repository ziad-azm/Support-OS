import { api } from '@/shared/lib/api/client'

import type { BulkActionResult } from '../types/bulkActionResult'

/** Same contract as `assignTicket.ts` — `assignedAgent: null` unassigns
 * every selected ticket. A 200 with per-row `ok`/`error` is the NORMAL
 * outcome for a partial failure; only a malformed request (empty
 * `ticket_ids`, a non-assignable agent) is a thrown `ApiRequestError`. */
export function bulkAssignTickets(
  ticketIds: number[],
  assignedAgent: number | null,
): Promise<BulkActionResult> {
  return api.post<BulkActionResult>('/tickets/bulk-assign/', {
    ticket_ids: ticketIds,
    assigned_agent: assignedAgent,
  })
}
