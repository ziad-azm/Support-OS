/** `as const` arrays, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`). */
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

/** Mirrors `apps.tickets.serializers.TicketSerializer` verbatim. */
export type Ticket = {
  id: number
  subject: string
  description: string
  customer: number
  customer_name: string
  category: number | null
  category_name: string | null
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  updated_at: string
}

/** The write shape. `status` is excluded on purpose: this story ships no
 * status-changing UI (TKT-4 owns it) — the server default (`open`) is what
 * every created ticket gets, and there is no form field to send anything
 * else. `category` is nullable — a ticket may be uncategorized; the form
 * always sends this key explicitly (`null` to clear), never omits it. */
export type TicketInput = {
  subject: string
  description: string
  customer: number
  category: number | null
  priority: TicketPriority
}
