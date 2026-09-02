import { api } from '@/shared/lib/api/client'

export function deleteWebhookSubscription(id: number): Promise<void> {
  return api.delete(`/webhooks/subscriptions/${id}/`)
}
