import { useMutation, useQueryClient } from '@tanstack/react-query'

import { createWebhookSubscription } from './createWebhookSubscription'
import { deleteWebhookSubscription } from './deleteWebhookSubscription'
import { updateWebhookSubscription } from './updateWebhookSubscription'
import { webhookSubscriptionKeys } from './webhookSubscriptionKeys'
import type { WebhookSubscriptionInput } from '../types/webhook'

// Every mutation invalidates the whole `webhookSubscriptions` key prefix —
// deliveries are cached under the same prefix (see useWebhookDeliveries.ts),
// the same split `roleKeys`/`userKeys` draw for two resources inside one
// feature folder (CONVENTIONS.md §23).
function useInvalidateWebhookSubscriptions() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: webhookSubscriptionKeys.all })
}

export function useCreateWebhookSubscription() {
  const invalidate = useInvalidateWebhookSubscriptions()
  return useMutation({
    mutationFn: (input: WebhookSubscriptionInput) => createWebhookSubscription(input),
    onSuccess: invalidate,
  })
}

export function useUpdateWebhookSubscription(id: number) {
  const invalidate = useInvalidateWebhookSubscriptions()
  return useMutation({
    mutationFn: (input: WebhookSubscriptionInput) => updateWebhookSubscription(id, input),
    onSuccess: invalidate,
  })
}

export function useDeleteWebhookSubscription() {
  const invalidate = useInvalidateWebhookSubscriptions()
  return useMutation({
    mutationFn: (id: number) => deleteWebhookSubscription(id),
    onSuccess: invalidate,
  })
}
