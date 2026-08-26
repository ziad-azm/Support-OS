import { api } from '@/shared/lib/api/client'

import type { Ticket, TicketInput } from '../types/ticket'

// PATCH, not PUT — CONVENTIONS.md §23: DRF drops an absent optional field
// from `validated_data` on either verb, so PUT cannot clear a value by
// omission. This form always sends every field it owns, so the distinction
// is mostly moot here, but PATCH is the project's one edit verb regardless.
export function updateTicket(id: number, input: TicketInput): Promise<Ticket> {
  return api.patch<Ticket>(`/tickets/${id}/`, input)
}
