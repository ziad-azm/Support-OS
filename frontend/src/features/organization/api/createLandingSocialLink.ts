import { api } from '@/shared/lib/api/client'

import type { LandingSocialLinkInput, LandingSocialLinkRow } from '../types/landing'

export function createLandingSocialLink(
  input: LandingSocialLinkInput,
): Promise<LandingSocialLinkRow> {
  return api.post<LandingSocialLinkRow>('/landing-social-links/', input)
}
