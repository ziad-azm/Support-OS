import { api } from '@/shared/lib/api/client'

import type { LandingSocialLinkInput, LandingSocialLinkRow } from '../types/landing'

export function updateLandingSocialLink(
  id: number,
  input: LandingSocialLinkInput,
): Promise<LandingSocialLinkRow> {
  return api.patch<LandingSocialLinkRow>(`/landing-social-links/${String(id)}/`, input)
}
