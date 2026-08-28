import { useMutation } from '@tanstack/react-query'

import { createPortalTicket } from './createPortalTicket'
import type { PortalTicketInput } from '../types/portalTicket'

/**
 * No `queryClient.invalidateQueries` — unlike `useCreateTicket`
 * (`features/tickets/api/useTicketMutations.ts:18-24`), there is no
 * portal ticket list cached anywhere yet (PORTAL-2 is what adds one).
 */
export function useCreatePortalTicket() {
  return useMutation({
    mutationFn: (input: PortalTicketInput) => createPortalTicket(input),
  })
}
