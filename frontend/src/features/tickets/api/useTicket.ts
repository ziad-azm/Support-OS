import { useQuery } from '@tanstack/react-query'

import { getTicket } from './getTicket'
import { ticketKeys } from './ticketKeys'

export function useTicket(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ticketKeys.resource('detail', id),
    queryFn: () => getTicket(id),
    enabled: options?.enabled,
  })
}
