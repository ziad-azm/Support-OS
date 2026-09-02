import { useQuery } from '@tanstack/react-query'

import { getWebhookSubscriptions } from './getWebhookSubscriptions'
import type { WebhookSubscriptionListParams } from './getWebhookSubscriptions'
import { webhookSubscriptionKeys } from './webhookSubscriptionKeys'

export function useWebhookSubscriptions(params: WebhookSubscriptionListParams) {
  return useQuery({
    queryKey: webhookSubscriptionKeys.resource('list', params),
    queryFn: () => getWebhookSubscriptions(params),
  })
}
