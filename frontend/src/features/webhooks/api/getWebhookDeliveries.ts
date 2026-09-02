import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { WebhookDelivery } from '../types/webhook'

export type WebhookDeliveryListParams = ServerTableParams & { subscription?: number }

export function getWebhookDeliveries(
  params: WebhookDeliveryListParams,
): Promise<Page<WebhookDelivery>> {
  return api.getPage<WebhookDelivery>('/webhooks/deliveries/', { params })
}
