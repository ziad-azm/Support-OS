import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createTicket } from './createTicket'
import { deleteTicket } from './deleteTicket'
import { ticketKeys } from './ticketKeys'
import { updateTicket } from './updateTicket'
import type { TicketInput } from '../types/ticket'

/**
 * Prefix-wide invalidation, per CONVENTIONS.md §23 — unlike Story 11's
 * ContactDetail (a non-paginated per-customer sub-resource), the ticket list
 * IS paginated/sorted, so a create/edit/delete can change which rows land on
 * which page. This is the default rule, not the exception.
 */
export function useCreateTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TicketInput) => createTicket(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useUpdateTicket(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: TicketInput) => updateTicket(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useDeleteTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteTicket(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}
