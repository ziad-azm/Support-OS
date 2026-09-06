import { api } from '@/shared/lib/api/client'

import type { LandingContentAdmin } from '../types/landing'

export function getLandingContent(): Promise<LandingContentAdmin> {
  return api.get<LandingContentAdmin>('/settings/landing/')
}
