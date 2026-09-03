/** `as const` arrays, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`). */
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

/**
 * Mirrors `apps/tickets/status.py::VALID_TRANSITIONS` verbatim. Duplicated
 * here the same way `TICKET_STATUSES` already duplicates `Ticket.Status`
 * (§3) — the backend remains authoritative and re-validates on every
 * `POST .../status/`; this only keeps `TicketStatusControl`'s picker from
 * offering a transition the server would reject.
 */
export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['open', 'resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
}

/** Mirrors `apps.tickets.serializers.TicketSerializer` verbatim. */
export type Ticket = {
  id: number
  subject: string
  description: string
  customer: number
  customer_name: string
  category: number | null
  category_name: string | null
  department: number | null
  department_name: string | null
  branch: number | null
  branch_name: string | null
  assigned_agent: number | null
  assigned_agent_name: string | null
  status: TicketStatus
  priority: TicketPriority
  escalated: boolean
  escalated_at: string | null
  created_at: string
  updated_at: string
}

/** The write shape. `category` is nullable — a ticket may be
 * uncategorized; the form always sends this key explicitly (`null` to
 * clear), never omits it. `assigned_agent`, `status`, `escalated`, and
 * `escalated_at` are all absent: each is read-only on the serializer and
 * written only through its own `POST /tickets/<id>/…` action, so a
 * full-payload create/edit can never move any of them as a side effect.
 * See Story 23 `## Prerequisites`. */
export type TicketInput = {
  subject: string
  description: string
  customer: number
  category: number | null
  // Nullable, same contract as `category` — the form always sends this
  // key explicitly (`null` to clear), never omits it (ORG-1).
  department: number | null
  // Nullable, same contract as `category`/`department` — the form always
  // sends this key explicitly (`null` to clear), never omits it (ORG-2).
  branch: number | null
  priority: TicketPriority
}
