import { useQuery } from '@tanstack/react-query'

import { brandingKeys } from './brandingKeys'
import { fetchBranding } from './fetchBranding'

/** The fetch half of branding — `<BrandingSync>` (app/BrandingSync.tsx) is
 * this hook's one caller, pushing the result into `shared/branding`'s
 * runtime store. Components that just need to RENDER branding use
 * `BrandMark` instead. */
export function useBranding() {
  return useQuery({
    queryKey: brandingKeys.resource('current'),
    queryFn: fetchBranding,
    // Branding changes when an admin saves /settings, which invalidates
    // this key directly — polling for it is pointless. The default 30s
    // (queryClient.ts) would refetch on every route change.
    staleTime: Infinity,
    // No `meta.toastOnError` on purpose: a branding failure must be
    // invisible. The login page falls back to the cached value or the DSN
    // default; it must never show an error to someone signing in.
  })
}
