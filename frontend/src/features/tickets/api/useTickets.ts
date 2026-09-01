import { useQuery } from '@tanstack/react-query'

import { getTickets } from './getTickets'
import type { TicketListParams } from './getTickets'
import { ticketKeys } from './ticketKeys'

export function useTickets(params: TicketListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ticketKeys.resource('list', params),
    queryFn: () => getTickets(params),
    enabled: options?.enabled,
  })
}
