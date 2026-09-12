import { featureKey } from '@/shared/lib/api/queryKeys'

/** Shared so `features/organization`'s mutation hooks can invalidate the
 * very same prefix the `BranchFormPage` picker reads from. */
export const calendarKeys = featureKey('calendars')
