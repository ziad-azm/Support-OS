import type { useFormatters } from '@/shared/hooks/useFormatters'

/** A bucket is a calendar date, not an instant — a bare YYYY-MM-DD is
 * parsed as UTC midnight by the JS Date constructor, so formatting
 * without timeZone: 'UTC' shows the previous day west of Greenwich. See
 * Story 56 `## Prerequisites`. Third occurrence (after `TicketReportsPage`
 * and `SlaReportsPage` each defined their own copy) is what crosses
 * CONVENTIONS.md § 8's "used by two or more → move it" threshold. */
export function formatBucket(
  date: ReturnType<typeof useFormatters>['date'],
  bucketValue: string,
): string {
  return date(bucketValue, { dateStyle: 'medium', timeZone: 'UTC' })
}
