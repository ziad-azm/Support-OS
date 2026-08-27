import type { MessageChannel, MessageDirection } from './message'
import type { TicketStatus } from './ticket'

/**
 * Mirrors `apps.customers.serializers.CustomerSerializer` — the same
 * shape `features/customers/types/customer.ts` declares, duplicated here
 * because `features/tickets` cannot import from `features/customers`
 * (CONVENTIONS.md §15). See Story 26 `## Prerequisites`.
 */
export type TicketContextCustomer = {
  id: number
  name: string
  email: string | null
  phone: string
  company: string
  created_at: string
  updated_at: string
}

/** Mirrors the `kind: "ticket"` entries `apps.tickets.context.build_ticket_context`
 * emits (via `build_timeline`), minus the fields the compact panel row
 * does not render. */
export type TicketContextTicketEntry = {
  kind: 'ticket'
  id: number
  occurred_at: string
  ticket_id: number
  subject: string
  status: TicketStatus
}

/** Mirrors the `kind: "message"` entries emitted the same way. */
export type TicketContextMessageEntry = {
  kind: 'message'
  id: number
  occurred_at: string
  ticket_id: number
  direction: MessageDirection
  channel: MessageChannel
  body: string
}

export type TicketContextEntry = TicketContextTicketEntry | TicketContextMessageEntry

/** Mirrors `apps.tickets.context.build_ticket_context`'s top-level shape. */
export type TicketContext = {
  customer: TicketContextCustomer
  recent_history: TicketContextEntry[]
}

/** `id` alone is not a stable React key across kinds — same reasoning as
 * `timelineEntryKey` (Story 20) and `ticketHistoryEntryKey` (Story 24). */
export function ticketContextEntryKey(entry: TicketContextEntry): string {
  return `${entry.kind}-${entry.id}`
}
