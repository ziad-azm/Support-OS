/** `as const` arrays, not `enum` — CONVENTIONS.md §3 (`erasableSyntaxOnly`). */
export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number]

export const MESSAGE_CHANNELS = ['email', 'whatsapp', 'chat', 'sms', 'web_form'] as const
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
  created_at: string
  updated_at: string
}

/** The write shape. `direction` has no default (mirrors the backend) — the
 * reply form (task 8) always sends `'outbound'` explicitly; it is never a
 * field the user picks. */
export type MessageInput = {
  ticket: number
  direction: MessageDirection
  channel: MessageChannel
  body: string
}
