import { api } from '@/shared/lib/api/client'

import type { Branding } from './types'

// Named `fetchBranding`, not `getBranding` — `shared/branding/branding.ts`
// already exports a synchronous `getBranding()` for the runtime store;
// this is the async network fetch `BrandMark` falls back away from while
// it resolves.
//
// The app's only unauthenticated GET from `src/` — `/api/branding/` is
// `AllowAny` server-side (Story 90), and the request interceptor
// (`shared/lib/api/client.ts`) attaches no `Authorization` header when no
// token exists, so this call needs no special handling on a public page.
export function fetchBranding(): Promise<Branding> {
  return api.get<Branding>('/branding/')
}
