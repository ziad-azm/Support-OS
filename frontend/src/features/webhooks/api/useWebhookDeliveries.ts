import { useQuery } from '@tanstack/react-query'

import { getWebhookDeliveries } from './getWebhookDeliveries'
import type { WebhookDeliveryListParams } from './getWebhookDeliveries'
import { webhookSubscriptionKeys } from './webhookSubscriptionKeys'

export function useWebhookDeliveries(params: WebhookDeliveryListParams) {
  return useQuery({
    queryKey: webhookSubscriptionKeys.resource('deliveries', params),
    queryFn: () => getWebhookDeliveries(params),
  })
}
