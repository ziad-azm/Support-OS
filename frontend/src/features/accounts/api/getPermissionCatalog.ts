import { api } from '@/shared/lib/api/client'

// A plain array, not a paginated `Page<T>` — the same shape
// `features/tickets/api/getAssignableAgents.ts` uses for a short, curated,
// non-resource lookup list.
export function getPermissionCatalog(): Promise<string[]> {
  return api.get<string[]>('/permissions/')
}
