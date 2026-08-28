import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { TicketOption } from '../types/ticketOption'

// page_size: 100 (the server's max, DRF_MAX_PAGE_SIZE) — no search-as-you-
// type combobox primitive exists yet, the same simplification
// `getCustomerOptions.ts` (features/tickets) already accepted. Relies on
// `Ticket.Meta.ordering` (`-created_at`) — no explicit `ordering` param.
export function getTicketOptions(): Promise<Page<TicketOption>> {
  return api.getPage<TicketOption>('/tickets/', { params: { page_size: 100 } })
}
