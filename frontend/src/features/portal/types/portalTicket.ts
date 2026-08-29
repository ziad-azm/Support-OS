/** The write shape a customer submits. Deliberately narrower than
 * `features/tickets/types/ticket.ts`'s `TicketInput` — `customer`,
 * `category`, and `priority` are all set server-side
 * (`PortalTicketCreateSerializer`/`PortalTicketViewSet.perform_create`).
 * Not imported from `features/tickets/` — `no-restricted-imports`
 * (frontend/.oxlintrc.json) forbids a cross-feature import; this feature
 * keeps its own minimal, self-contained type instead. */
export type PortalTicketInput = {
  subject: string
  description: string
}

/** Only the field this feature actually reads from the response — no
 * ticket detail page exists yet in the portal (PORTAL-2/3), so nothing
 * here needs the full `Ticket` shape. */
export type PortalTicketCreated = {
  id: number
}

/** Mirrors `apps.portal.serializers.PortalTicketSerializer` — the read
 * shape a customer's own ticket list/detail returns. Duplicated from
 * `features/tickets/types/ticket.ts`'s `Ticket`/`TicketStatus`/
 * `TicketPriority` rather than imported — `no-restricted-imports`
 * (frontend/.oxlintrc.json) forbids a cross-feature import, the same
 * boundary `PortalTicketInput` above already works within. */
export const PORTAL_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
export type PortalTicketStatus = (typeof PORTAL_TICKET_STATUSES)[number]

export const PORTAL_TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type PortalTicketPriority = (typeof PORTAL_TICKET_PRIORITIES)[number]

export type PortalTicket = {
  id: number
  subject: string
  description: string
  customer: number
  customer_name: string
  category: number | null
  category_name: string | null
  assigned_agent: number | null
  assigned_agent_name: string | null
  status: PortalTicketStatus
  priority: PortalTicketPriority
  escalated: boolean
  escalated_at: string | null
  created_at: string
  updated_at: string
}
