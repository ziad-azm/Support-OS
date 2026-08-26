import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { getAccessToken } from '@/shared/auth/tokenStorage'
import { getWebSocketUrl } from '@/shared/lib/ws'

import { ticketKeys } from './ticketKeys'

/**
 * Receive-only: an agent always replies through the existing
 * `POST /api/messages/` form (`TicketConversation.tsx`'s `ReplyForm`,
 * Story 13) — this hook only invalidates the messages cache when *any*
 * live-chat event arrives, so the existing `useMessages` query refetches.
 * See Story 16 `## Prerequisites`.
 *
 * No automatic reconnection: a dropped connection stops delivering live
 * updates until this component remounts. See `## Edge Cases`.
 */
export function useTicketChatSocket(ticketId: number) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return

    const socket = new WebSocket(getWebSocketUrl(`/ws/tickets/${ticketId}/?token=${token}`))
    socket.onmessage = () => {
      queryClient.invalidateQueries({ queryKey: ticketKeys.resource('messages', ticketId) })
    }
    return () => socket.close()
  }, [ticketId, queryClient])
}
