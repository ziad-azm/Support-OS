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
