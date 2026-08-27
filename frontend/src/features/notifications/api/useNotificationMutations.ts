import { useMutation, useQueryClient } from '@tanstack/react-query'

import { markAllNotificationsRead } from './markAllNotificationsRead'
import { markNotificationRead } from './markNotificationRead'
import { notificationKeys } from './notificationKeys'

// Prefix-wide invalidation, same reason as useCustomerMutations: a read
// changes both the list (read_at) and the unread count together.
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
