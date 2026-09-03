import { useSyncExternalStore } from 'react'

import { getBranding, subscribeBranding } from './branding'
import type { Branding } from './types'

/** Named distinctly from `useBranding` (the react-query fetch hook in
 * `useBranding.ts`) — this one reads the synchronous, already-applied
 * store `branding.ts` owns, the same role `shared/theme/useTheme.ts` plays
 * for the theme class. Most components want `BrandMark`/`useBranding()`
 * instead; this is for a consumer that needs the CURRENT applied value
 * specifically (there is none yet outside this module — kept for parity
 * with `shared/theme`'s shape and re-exported for that reason). */
export function useBrandingStore(): Branding {
  return useSyncExternalStore(subscribeBranding, getBranding, getBranding)
}
