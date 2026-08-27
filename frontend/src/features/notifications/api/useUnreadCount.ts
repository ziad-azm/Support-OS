import { useQuery } from '@tanstack/react-query'

import { getUnreadCount } from './getUnreadCount'
import { notificationKeys } from './notificationKeys'

export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.resource('unreadCount'),
    queryFn: getUnreadCount,
  })
}
