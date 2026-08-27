import { useQuery } from '@tanstack/react-query'

import { getTicketHistory } from './getTicketHistory'
import { ticketKeys } from './ticketKeys'

/**
 * Read-only. Unlike `useCustomerTimeline` (nothing invalidates it — it
 * aggregates across a feature boundary `customerKeys` cannot reach),
 * `useAssignTicket`/`useSetTicketStatus`'s existing prefix-wide
 * `ticketKeys.all` invalidation already covers this key for free:
 * `ticketKeys.resource('history', ticketId)` is `['tickets', 'history',
 * ticketId]`, a child of `['tickets']`, and React Query's default
 * partial-key matching invalidates every child of an invalidated prefix.
 * `useCreateMessage`'s SCOPED invalidation does not reach it, though —
 * task 7 extends that one call site.
 */
export function useTicketHistory(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('history', ticketId),
    queryFn: () => getTicketHistory(ticketId),
  })
}
