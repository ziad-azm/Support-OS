import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Ticket, TicketPriority, TicketStatus } from '../types/ticket'

export type TicketListParams = ServerTableParams & {
  search?: string
  category?: string
  // A string, because the value carries either a numeric department id
  // or the literal `'none'` — the backend scoping sentinel (ORG-1).
  department?: string
  // A string, because the value carries either a numeric branch id or the
  // literal `'none'` — the backend scoping sentinel (ORG-2).
  branch?: string
  status?: TicketStatus
  priority?: TicketPriority
  assigned_to_me?: 'true'
}

export function getTickets(params: TicketListParams): Promise<Page<Ticket>> {
  return api.getPage<Ticket>('/tickets/', { params })
}
