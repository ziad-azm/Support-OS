import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createPortalTicket } from './createPortalTicket'
import { portalTicketKeys } from './portalTicketKeys'
import type { PortalTicketInput } from '../types/portalTicket'

/**
 * Invalidates the whole `portal-tickets` key prefix on success — PORTAL-2's
 * list is paginated/sorted, so a create can change which rows land on which
 * page, the same reasoning `useCreateTicket`
 * (features/tickets/api/useTicketMutations.ts:18-24) documents. This is the
 * change PORTAL-1's own code comment named as PORTAL-2's job.
 */
export function useCreatePortalTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PortalTicketInput) => createPortalTicket(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalTicketKeys.all }),
  })
}
