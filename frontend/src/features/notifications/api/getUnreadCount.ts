import { api } from '@/shared/lib/api/client'

export function getUnreadCount(): Promise<{ count: number }> {
  return api.get<{ count: number }>('/notifications/unread_count/')
}
