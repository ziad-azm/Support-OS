import { featureKey } from '@/shared/lib/api/queryKeys'

/** The ADMIN landing cache (`/api/settings/landing/` and
 * `/api/landing-highlights/`). Deliberately a different key from
 * `shared/landing/landingKeys.ts`, which caches the PUBLIC payload the live
 * page reads: the two endpoints return different shapes and are read by
 * different callers.
 *
 * Every write hook in this folder must invalidate BOTH — the same reason
 * `useUpdateSettings.ts` invalidates `brandingKeys.all` alongside its own.
 * Without it an admin saves and the running app keeps the old copy until a
 * reload. */
export const landingContentKeys = featureKey('landingContentAdmin')
