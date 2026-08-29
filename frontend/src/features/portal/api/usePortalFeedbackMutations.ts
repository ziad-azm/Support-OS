import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createPortalFeedback } from './createPortalFeedback'
import { portalTicketKeys } from './portalTicketKeys'
import type { PortalFeedbackInput } from '../types/portalFeedback'

/**
 * Invalidates `portalTicketKeys.all`, not a new `portal-feedback` key
 * prefix — there is no feedback list/detail cached anywhere (create-only,
 * see PortalFeedbackViewSet). What a successful submission actually
 * changes is `has_feedback` on the ticket the customer just rated, so the
 * ticket cache is the one that must go stale, the same
 * invalidate-the-thing-that-changed reasoning `useCreatePortalTicket`
 * already uses.
 */
export function useCreatePortalFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PortalFeedbackInput) => createPortalFeedback(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: portalTicketKeys.all }),
  })
}
