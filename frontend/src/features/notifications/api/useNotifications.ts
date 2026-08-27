import { useQuery } from '@tanstack/react-query'

import { getNotifications } from './getNotifications'
import { notificationKeys } from './notificationKeys'

export function useNotifications() {
  return useQuery({
    queryKey: notificationKeys.resource('list'),
    queryFn: getNotifications,
  })
}
