import { api } from '@/shared/lib/api/client'

import type { WebhookSubscription, WebhookSubscriptionInput } from '../types/webhook'

export function createWebhookSubscription(
  input: WebhookSubscriptionInput,
): Promise<WebhookSubscription> {
  return api.post<WebhookSubscription>('/webhooks/subscriptions/', input)
}
