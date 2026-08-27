import { api } from '@/shared/lib/api/client'

import type { Notification } from '../types/notification'

export function markNotificationRead(id: number): Promise<Notification> {
  return api.post<Notification>(`/notifications/${id}/mark_read/`)
}
