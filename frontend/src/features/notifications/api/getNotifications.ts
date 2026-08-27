import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Notification } from '../types/notification'

export function getNotifications(): Promise<Page<Notification>> {
  return api.getPage<Notification>('/notifications/', { params: { page_size: 10 } })
}
