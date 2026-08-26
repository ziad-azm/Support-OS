import { api } from '@/shared/lib/api/client'

export function deleteContactDetail(id: number): Promise<void> {
  return api.delete(`/contact-details/${id}/`)
}
