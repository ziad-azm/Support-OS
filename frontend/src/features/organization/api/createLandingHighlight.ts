import { api } from '@/shared/lib/api/client'

import type { LandingHighlightInput, LandingHighlightRow } from '../types/landing'

export function createLandingHighlight(input: LandingHighlightInput): Promise<LandingHighlightRow> {
  return api.post<LandingHighlightRow>('/landing-highlights/', input)
}
