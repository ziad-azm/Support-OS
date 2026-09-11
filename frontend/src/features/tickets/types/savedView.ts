/** Mirrors `apps.tickets.serializers.SavedViewSerializer` verbatim. The
 * SAME string key/value shape `TicketListParams` (getTickets.ts) already
 * sends to `GET /tickets/` — no `page`/`page_size`, those are not part of
 * "a filter combination" (TKT-8). */
export type SavedView = {
  id: number
  name: string
  owner: number
  owner_name: string
  is_shared: boolean
  is_default: boolean
  filters: Record<string, string>
  created_at: string
  updated_at: string
}

/** The create-only write shape — `filters` is immutable after create
 * (`SavedViewSerializer.immutable_fields`, backend). */
export type SavedViewInput = {
  name: string
  is_shared: boolean
  filters: Record<string, string>
}

/** The rename write shape — deliberately narrower than `SavedViewInput`:
 * a PATCH through this type can never accidentally resend (and thus risk
 * rejecting on) `filters`. */
export type SavedViewRenameInput = {
  name: string
  is_shared: boolean
}
