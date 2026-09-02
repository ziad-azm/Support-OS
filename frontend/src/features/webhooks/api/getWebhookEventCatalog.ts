import { api } from '@/shared/lib/api/client'

// A plain array, not a paginated `Page<T>` — the same shape
// `getPermissionCatalog.ts` uses for its own short, curated, non-resource
// lookup list.
export function getWebhookEventCatalog(): Promise<string[]> {
  return api.get<string[]>('/webhooks/events/')
}
