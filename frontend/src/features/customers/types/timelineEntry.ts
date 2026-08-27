/** `as const` arrays, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`).
 * These duplicate `features/tickets`' own unions on purpose: a feature never
 * imports from another feature (CONVENTIONS.md §15), and the label keys live
 * in this feature's own locale namespace. */
export const TIMELINE_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const
export type TimelineTicketStatus = (typeof TIMELINE_TICKET_STATUSES)[number]

export const TIMELINE_MESSAGE_CHANNELS = ['email', 'whatsapp', 'chat', 'sms', 'web_form'] as const
export type TimelineMessageChannel = (typeof TIMELINE_MESSAGE_CHANNELS)[number]

export type TimelineMessageDirection = 'inbound' | 'outbound'

/** Mirrors the `kind: "ticket"` entries `apps.customers.timeline.build_timeline`
 * emits. `id` is the ticket's own id and is NOT unique across kinds — see
 * `timelineEntryKey` below. */
export type TimelineTicketEntry = {
  kind: 'ticket'
  id: number
  occurred_at: string
  ticket_id: number
  subject: string
  status: TimelineTicketStatus
  priority: string
  category_name: string | null
}

/** Mirrors the `kind: "message"` entries `build_timeline` emits. */
export type TimelineMessageEntry = {
  kind: 'message'
  id: number
  occurred_at: string
  ticket_id: number
  direction: TimelineMessageDirection
  channel: TimelineMessageChannel
  body: string
}

/** A discriminated union on `kind` — narrow with `entry.kind === 'ticket'`. */
export type TimelineEntry = TimelineTicketEntry | TimelineMessageEntry

/**
 * `id` alone is NOT a stable React key: a ticket and a message can share the
 * same numeric id, which would collide in the list and make React reuse the
 * wrong node. Key on the pair.
 */
export function timelineEntryKey(entry: TimelineEntry): string {
  return `${entry.kind}-${entry.id}`
}
