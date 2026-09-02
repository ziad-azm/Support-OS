import { api } from '@/shared/lib/api/client'

import type { WebhookSubscription, WebhookSubscriptionInput } from '../types/webhook'

// PATCH, not PUT — CONVENTIONS.md §23.
export function updateWebhookSubscription(
  id: number,
  input: WebhookSubscriptionInput,
): Promise<WebhookSubscription> {
  return api.patch<WebhookSubscription>(`/webhooks/subscriptions/${id}/`, input)
}
