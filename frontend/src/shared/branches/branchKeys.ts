import { featureKey } from '@/shared/lib/api/queryKeys'

/** Shared so `features/organization`'s mutation hooks can invalidate the
 * very same prefix the pickers in other features read from. */
export const branchKeys = featureKey('branches')
