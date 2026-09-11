import { api } from '@/shared/lib/api/client'

import type { BulkActionResult } from '../types/bulkActionResult'
import type { TicketPriority } from '../types/ticket'

export function bulkSetTicketPriority(
  ticketIds: number[],
  priority: TicketPriority,
): Promise<BulkActionResult> {
  return api.post<BulkActionResult>('/tickets/bulk-priority/', { ticket_ids: ticketIds, priority })
}
