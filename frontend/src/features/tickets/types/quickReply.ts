/** Mirrors `apps.agents.serializers.QuickReplySerializer` verbatim. Owned
 * by this feature, not `apps.agents` — the picker's only consumer is
 * `TicketConversation.tsx`; see Story 33 `## Prerequisites` for why this
 * frontend code lives in `features/tickets` despite the backend model
 * living in `apps.agents` (the same split Story 25 already established). */
export type QuickReply = {
  id: number
  title: string
  body: string
  created_at: string
  updated_at: string
}
