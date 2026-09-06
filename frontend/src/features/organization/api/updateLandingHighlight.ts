import { api } from '@/shared/lib/api/client'

import type { LandingHighlightInput, LandingHighlightRow } from '../types/landing'

export function updateLandingHighlight(
  id: number,
  input: LandingHighlightInput,
): Promise<LandingHighlightRow> {
  return api.patch<LandingHighlightRow>(`/landing-highlights/${String(id)}/`, input)
}
