import { featureKey } from '@/shared/lib/api/queryKeys'

/** The PUBLIC landing payload's cache key (`GET /api/landing/`). The admin
 * editor's own read of `/api/settings/landing/` is cached separately under
 * `features/organization/api/landingKeys.ts` — every write hook there must
 * invalidate BOTH, or an admin saves and the live page keeps the old copy
 * until a reload. Same split `shared/branding/brandingKeys.ts` has with the
 * org settings key. */
export const landingKeys = featureKey('landingContent')
