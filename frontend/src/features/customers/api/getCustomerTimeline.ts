import { api } from '@/shared/lib/api/client'

import type { TimelineEntry } from '../types/timelineEntry'

// A plain array, not a paginated `Page<T>` — the endpoint merges two
// querysets in Python, so DRF's queryset pagination does not apply and the
// backend caps the result at its own `TIMELINE_MAX_ENTRIES` (100) instead.
// Same shape as `features/web-form/api/getWebFormCategories.ts` (Story 19).
export function getCustomerTimeline(customerId: number): Promise<TimelineEntry[]> {
  return api.get<TimelineEntry[]>(`/customers/${customerId}/timeline/`)
}
