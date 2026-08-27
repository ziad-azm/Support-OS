import type { MessageChannel, MessageDirection } from './message'

export type TicketActivityKind = 'status_changed' | 'assigned'

/**
 * Mirrors the `kind: "activity"` entries `apps.tickets.history.build_history`
 * emits. `from_value`/`to_value` mean different things per `activity_kind`:
 * for `status_changed` they are `TicketStatus` values, translated via the
 * same `statuses.<value>` i18n keys every other status display uses; for
 * `assigned` they are already-resolved name snapshots — render as-is,
 * blank meaning unassigned. See Story 24 `## Prerequisites`.
 */
export type TicketHistoryActivityEntry = {
  kind: 'activity'
  id: number
  occurred_at: string
  activity_kind: TicketActivityKind
  actor_name: string | null
  from_value: string
  to_value: string
}

/** Mirrors the `kind: "message"` entries `build_history` emits — the same
 * shape `TicketConversation`'s own message rows render, reused here
 * (same feature, same locale namespace) rather than duplicated. */
export type TicketHistoryMessageEntry = {
  kind: 'message'
  id: number
  occurred_at: string
  direction: MessageDirection
  channel: MessageChannel
  body: string
}

/** A discriminated union on `kind` — narrow with `entry.kind === 'activity'`. */
export type TicketHistoryEntry = TicketHistoryActivityEntry | TicketHistoryMessageEntry

/** `id` alone is not a stable React key across kinds — same reasoning as
 * `timelineEntryKey` (Story 20). */
export function ticketHistoryEntryKey(entry: TicketHistoryEntry): string {
  return `${entry.kind}-${entry.id}`
}
