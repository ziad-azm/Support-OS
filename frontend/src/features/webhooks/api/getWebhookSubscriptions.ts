import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { WebhookSubscription } from '../types/webhook'

export type WebhookSubscriptionListParams = ServerTableParams & { search?: string }

export function getWebhookSubscriptions(
  params: WebhookSubscriptionListParams,
): Promise<Page<WebhookSubscription>> {
  return api.getPage<WebhookSubscription>('/webhooks/subscriptions/', { params })
}
