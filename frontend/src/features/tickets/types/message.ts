/** `as const` arrays, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`). */
export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number]

export const MESSAGE_CHANNELS = ['email', 'sms', 'whatsapp', 'web_form', 'chat'] as const
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number]

/**
 * Mirrors `apps.communications.serializers.MessageSerializer` verbatim. Lives
 * here, not in a `features/communications/` folder — see Story 13
 * `## Prerequisites`' placement decision.
 */
export type Message = {
  id: number
  ticket: number
  direction: MessageDirection
  channel: MessageChannel
  body: string
  metadata: Record<string, unknown>
  target_address: string
  created_at: string
  updated_at: string
}

/** The write shape. `direction` has no default (mirrors the backend) — the
 * reply form (task 8) always sends `'outbound'` explicitly; it is never a
 * field the user picks. `target_address` is optional — omitted (or '') lets
 * the channel adapter's own default resolution decide (the customer's
 * primary email/phone first, falling back to a secondary `ContactDetail`);
 * set it only when the customer has more than one known address for the
 * chosen channel and the agent picked a specific one. The backend rejects
 * any value that isn't one of that customer's own known addresses. */
export type MessageInput = {
  ticket: number
  direction: MessageDirection
  channel: MessageChannel
  body: string
  target_address?: string
}
