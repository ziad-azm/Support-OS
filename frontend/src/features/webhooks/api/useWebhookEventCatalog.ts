import { useQuery } from '@tanstack/react-query'

import { getWebhookEventCatalog } from './getWebhookEventCatalog'
import { webhookSubscriptionKeys } from './webhookSubscriptionKeys'

// Cached under `webhookSubscriptionKeys`, not a new key prefix: the
// catalog exists only to serve `WebhookSubscriptionFormPage`'s checklist,
// the same reasoning `usePermissionCatalog.ts` documents for caching under
// `roleKeys` instead of a new key prefix.
export function useWebhookEventCatalog() {
  return useQuery({
    queryKey: webhookSubscriptionKeys.resource('catalog'),
    queryFn: getWebhookEventCatalog,
  })
}
