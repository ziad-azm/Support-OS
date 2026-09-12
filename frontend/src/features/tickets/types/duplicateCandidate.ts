import type { TicketPriority, TicketStatus } from './ticket'

/** Mirrors the plain array `TicketViewSet.duplicate_candidates` returns —
 * TKT-9. Not a `Ticket` — deliberately narrower, the same "small,
 * purpose-built shape" `assignable-agents` already returns rather than a
 * full resource. */
export type DuplicateCandidate = {
  id: number
  subject: string
  status: TicketStatus
  priority: TicketPriority
  created_at: string
  /** Full-text rank against the CURRENT ticket's subject — higher is a
   * closer textual match. Order only; never filtered on in the UI. */
  rank: number
}
