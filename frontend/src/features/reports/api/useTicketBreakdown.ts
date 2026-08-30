import { useQuery } from '@tanstack/react-query'

import { getTicketBreakdown } from './getTicketBreakdown'
import type { TicketBreakdownParams } from './getTicketBreakdown'
import { reportKeys } from './reportKeys'

export function useTicketBreakdown(params: TicketBreakdownParams) {
  return useQuery({
    queryKey: reportKeys.resource('ticket-breakdown', params),
    queryFn: () => getTicketBreakdown(params),
  })
}
