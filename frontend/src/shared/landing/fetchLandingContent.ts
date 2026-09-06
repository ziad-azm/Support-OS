import { api } from '@/shared/lib/api/client'

import type { LandingContent } from './types'

// The app's second unauthenticated GET from `src/`, after
// `shared/branding/fetchBranding.ts`. `/api/landing/` is `AllowAny`
// server-side (Story 94), and the request interceptor
// (`shared/lib/api/client.ts`) attaches no `Authorization` header when no
// token exists, so this call needs no special handling on a public page.
export function fetchLandingContent(): Promise<LandingContent> {
  return api.get<LandingContent>('/landing/')
}
