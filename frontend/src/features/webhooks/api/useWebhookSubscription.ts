import { useQuery } from '@tanstack/react-query'

import { getWebhookSubscription } from './getWebhookSubscription'
import { webhookSubscriptionKeys } from './webhookSubscriptionKeys'

export function useWebhookSubscription(id: number, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: webhookSubscriptionKeys.resource('detail', id),
    queryFn: () => getWebhookSubscription(id),
    enabled: options?.enabled,
  })
}
