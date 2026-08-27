import { useQuery } from '@tanstack/react-query'

import { customerKeys } from './customerKeys'
import { getCustomerTimeline } from './getCustomerTimeline'

/**
 * Read-only. Nothing invalidates this key: the tickets and messages it
 * aggregates are created in `features/tickets`, which cannot reach
 * `customerKeys` (CONVENTIONS.md §15). The query client's 30s `staleTime`
 * is what refreshes it — see Story 20 `## Edge Cases`.
 */
export function useCustomerTimeline(customerId: number) {
  return useQuery({
    queryKey: customerKeys.resource('timeline', customerId),
    queryFn: () => getCustomerTimeline(customerId),
  })
}
