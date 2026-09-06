import { api } from '@/shared/lib/api/client'

export function deleteLandingSocialLink(id: number): Promise<void> {
  return api.delete(`/landing-social-links/${String(id)}/`)
}
