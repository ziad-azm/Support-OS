import { api } from '@/shared/lib/api/client'

import type { Ticket, TicketInput } from '../types/ticket'

export function createTicket(input: TicketInput): Promise<Ticket> {
  return api.post<Ticket>('/tickets/', input)
}
