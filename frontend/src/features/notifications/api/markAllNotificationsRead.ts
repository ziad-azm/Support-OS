import { api } from '@/shared/lib/api/client'

export function markAllNotificationsRead(): Promise<void> {
  return api.post('/notifications/mark_all_read/')
}
