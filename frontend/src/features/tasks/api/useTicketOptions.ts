import { useQuery } from '@tanstack/react-query'

import { getTicketOptions } from './getTicketOptions'
import { taskKeys } from './taskKeys'

/**
 * A caller without `tickets.view` gets a `403` here and simply sees an
 * empty picker (no crash) — `TaskFormPage` does not special-case
 * `isError`, the same graceful degradation `TicketFormPage`'s own
 * `useCustomerOptions`/`useCategories` already have for a
 * `customers.view`-less caller. See Story 32 `## Prerequisites`.
 */
export function useTicketOptions() {
  return useQuery({
    queryKey: taskKeys.resource('ticketOptions'),
    queryFn: getTicketOptions,
  })
}
