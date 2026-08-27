import { useQuery } from '@tanstack/react-query'

import { getTicketContext } from './getTicketContext'
import { ticketKeys } from './ticketKeys'

/**
 * Read-only. `recent_history` deliberately excludes this ticket's own
 * activity (see `## Prerequisites`), so none of this ticket's own
 * mutations (`useAssignTicket`, `useSetTicketStatus`, `useCreateMessage`)
 * need to invalidate this key — nothing they change is reflected in this
 * panel's data by design. What COULD change this panel's data is an event
 * on a DIFFERENT ticket for the same customer, or an edit to the customer
 * record itself (`features/customers`) — neither is reachable from
 * `features/tickets` (§15), the same cross-feature gap
 * `useCustomerTimeline`'s own docstring already accepts for the reverse
 * direction (Story 20). `staleTime` is what eventually refreshes it.
 */
export function useTicketContext(ticketId: number) {
  return useQuery({
    queryKey: ticketKeys.resource('context', ticketId),
    queryFn: () => getTicketContext(ticketId),
  })
}
