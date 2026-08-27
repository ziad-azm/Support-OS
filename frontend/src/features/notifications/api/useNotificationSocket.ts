import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { getAccessToken } from '@/shared/auth/tokenStorage'
import { getWebSocketUrl } from '@/shared/lib/ws'
import { useToast } from '@/shared/ui/toast/useToast'

import { notificationKeys } from './notificationKeys'
import type { Notification } from '../types/notification'

/**
 * Receive-only, mirroring `useTicketChatSocket` (Story 16) but scoped to the
 * signed-in user rather than a ticket. No automatic reconnection — a
 * dropped connection stops delivering live pushes until this component
 * remounts (same accepted limitation Story 16 documents).
 *
 * A notification whose event was raised from a Celery worker process (the
 * automatic assignment/escalation paths) never arrives here at all —
 * `CHANNEL_LAYERS` is `InMemoryChannelLayer`, single-process only. The
 * notification still exists and is fetched normally the next time the
 * bell's dropdown opens (`NotificationBell`'s `onOpenChange` invalidation).
 * See Story 31 `## Prerequisites`.
 */
export function useNotificationSocket() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  useEffect(() => {
    const token = getAccessToken()
    if (!token) return

    const socket = new WebSocket(getWebSocketUrl(`/ws/notifications/?token=${token}`))
    socket.onmessage = (event) => {
      const notification = JSON.parse(event.data) as Notification
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      toast({ tone: 'info', message: notification.title })
    }
    return () => socket.close()
  }, [queryClient, toast])
}
