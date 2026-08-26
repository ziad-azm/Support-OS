/**
 * A minimal local mirror of `apps.communications.serializers.MessageSerializer`
 * — this feature cannot import `@/features/tickets` (CONVENTIONS.md §15),
 * and needs only these three fields to render the thread.
 */
export type ChatMessage = {
  id: number
  direction: 'inbound' | 'outbound'
  body: string
}
