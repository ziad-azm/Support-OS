import { api } from '@/shared/lib/api/client'

import type { LandingHighlightRow } from '../types/landing'

export function getLandingHighlight(id: number): Promise<LandingHighlightRow> {
  return api.get<LandingHighlightRow>(`/landing-highlights/${String(id)}/`)
}
