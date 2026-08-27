import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createMessage } from './createMessage'
import { ticketKeys } from './ticketKeys'
import type { MessageInput } from '../types/message'

/**
 * Scoped invalidation, per CONVENTIONS.md §23's documented exception
 * (Story 11): a message write for one ticket cannot affect another ticket's
 * conversation or the ticket list, so invalidating only this ticket's keys
 * is precise. `history` (Story 24) and `sla` (Story 28) are invalidated
 * alongside `messages` for the same reason: a new reply can change either
 * feed's or SLA's computed data, and both sit outside `ticketKeys.all`'s
 * reach the same way `messages` does.
 */
export function useCreateMessage(ticketId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MessageInput) => createMessage(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('messages', ticketId) })
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('history', ticketId) })
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('sla', ticketId) })
    },
  })
}
