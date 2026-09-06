import { api } from '@/shared/lib/api/client'

import type { LandingSocialLinkRow } from '../types/landing'

export function getLandingSocialLink(id: number): Promise<LandingSocialLinkRow> {
  return api.get<LandingSocialLinkRow>(`/landing-social-links/${String(id)}/`)
}
