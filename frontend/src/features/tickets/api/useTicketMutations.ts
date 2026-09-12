import { useMutation, useQueryClient } from '@tanstack/react-query'

import { assignTicket } from './assignTicket'
import { bulkAssignTickets } from './bulkAssignTickets'
import { bulkSetTicketPriority } from './bulkSetTicketPriority'
import { bulkSetTicketStatus } from './bulkSetTicketStatus'
import { createTicket } from './createTicket'
import { deleteTicket } from './deleteTicket'
import { escalateTicket } from './escalateTicket'
import { mergeTicket } from './mergeTicket'
import { setTicketStatus } from './setTicketStatus'
import { suggestTicketReply } from './suggestTicketReply'
import { suggestTicketSolutions } from './suggestTicketSolutions'
import { summarizeTicket } from './summarizeTicket'
import { ticketKeys } from './ticketKeys'
import { updateTicket } from './updateTicket'
import type { TicketInput, TicketPriority, TicketStatus } from '../types/ticket'

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

export function useAssignTicket(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (assignedAgent: number | null) => assignTicket(id, assignedAgent),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useSetTicketStatus(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: TicketStatus) => setTicketStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useEscalateTicket(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (escalated: boolean) => escalateTicket(id, escalated),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

// Prefix-wide invalidation covers BOTH sides of the merge: the source's
// own detail/history AND the target's — ticketKeys.resource('history',
// targetId) is a child of the invalidated ticketKeys.all prefix, the same
// reasoning Story 24 already verified for useAssignTicket. TKT-9.
export function useMergeTicket(sourceId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (targetId: number) => mergeTicket(sourceId, targetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

// Unlike useAssignTicket(id)/useSetTicketStatus(id), these three take no
// `id` parameter — they are not per-ticket, the same shape
// useCreateTicket/useDeleteTicket already use. TKT-7.
export function useBulkAssignTickets() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      ticketIds,
      assignedAgent,
    }: {
      ticketIds: number[]
      assignedAgent: number | null
    }) => bulkAssignTickets(ticketIds, assignedAgent),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useBulkSetTicketStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketIds, status }: { ticketIds: number[]; status: TicketStatus }) =>
      bulkSetTicketStatus(ticketIds, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

export function useBulkSetTicketPriority() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketIds, priority }: { ticketIds: number[]; priority: TicketPriority }) =>
      bulkSetTicketPriority(ticketIds, priority),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ticketKeys.all }),
  })
}

// No queryClient.invalidateQueries — unlike every other mutation in this
// file, summarizing changes nothing cached; the result is consumed
// directly by the caller via onSuccess. See Story 75 `## Story Goal`.
export function useSummarizeTicket(id: number) {
  return useMutation({
    mutationFn: () => summarizeTicket(id),
  })
}

// No queryClient.invalidateQueries — same reasoning as useSummarizeTicket
// (Story 75): drafting a reply changes nothing cached; the caller
// consumes the result directly via onSuccess.
export function useSuggestTicketReply(id: number) {
  return useMutation({
    mutationFn: () => suggestTicketReply(id),
  })
}

// No queryClient.invalidateQueries — same reasoning as useSummarizeTicket/
// useSuggestTicketReply: finding solutions changes nothing cached; the
// caller consumes the result directly via onSuccess.
export function useSuggestTicketSolutions(id: number) {
  return useMutation({
    mutationFn: () => suggestTicketSolutions(id),
  })
}
