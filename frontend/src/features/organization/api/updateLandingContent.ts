import { api } from '@/shared/lib/api/client'

import type { LandingContentAdmin, LandingContentInput } from '../types/landing'

export function updateLandingContent(input: LandingContentInput): Promise<LandingContentAdmin> {
  return api.patch<LandingContentAdmin>('/settings/landing/', input)
}
