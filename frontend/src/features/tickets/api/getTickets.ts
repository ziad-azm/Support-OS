import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Ticket } from '../types/ticket'

export type TicketListParams = ServerTableParams & { search?: string }

export function getTickets(params: TicketListParams): Promise<Page<Ticket>> {
  return api.getPage<Ticket>('/tickets/', { params })
}
