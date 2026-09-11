import { api } from '@/shared/lib/api/client'

import type { BulkActionResult } from '../types/bulkActionResult'
import type { TicketStatus } from '../types/ticket'

export function bulkSetTicketStatus(
  ticketIds: number[],
  status: TicketStatus,
): Promise<BulkActionResult> {
  return api.post<BulkActionResult>('/tickets/bulk-status/', { ticket_ids: ticketIds, status })
}
