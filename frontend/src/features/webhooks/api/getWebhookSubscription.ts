import { api } from '@/shared/lib/api/client'

import type { WebhookSubscription } from '../types/webhook'

export function getWebhookSubscription(id: number): Promise<WebhookSubscription> {
  return api.get<WebhookSubscription>(`/webhooks/subscriptions/${id}/`)
}
