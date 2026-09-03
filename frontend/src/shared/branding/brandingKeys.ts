import { featureKey } from '@/shared/lib/api/queryKeys'

/** Shared so `features/organization`'s settings mutation can invalidate
 * this prefix directly — saving a new brand colour must repaint the
 * running app immediately, not on the next reload. */
export const brandingKeys = featureKey('branding')
