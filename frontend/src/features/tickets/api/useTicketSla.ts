import { useQuery } from '@tanstack/react-query'

import { getTicketSla } from './getTicketSla'
import { ticketKeys } from './ticketKeys'

/**
 * Read-only. `useAssignTicket`/`useSetTicketStatus`/`useEscalateTicket`/
 * `useUpdateTicket`'s existing prefix-wide `ticketKeys.all` invalidation
 * already refreshes this key for free (a status change or a priority/
 * category edit both change the computed SLA status). Only
 * `useCreateMessage`'s SCOPED invalidation does not reach it — task 7
 * extends that call site a second time (it already gained `history` in
 * Story 24).
 */
export function useTicketSla(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('sla', ticketId),
    queryFn: () => getTicketSla(ticketId),
  })
}
