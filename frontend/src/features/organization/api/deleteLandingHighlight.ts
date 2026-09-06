import { api } from '@/shared/lib/api/client'

export function deleteLandingHighlight(id: number): Promise<void> {
  return api.delete(`/landing-highlights/${String(id)}/`)
}
