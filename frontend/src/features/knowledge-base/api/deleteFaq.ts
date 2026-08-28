import { api } from '@/shared/lib/api/client'

export function deleteFaq(id: number): Promise<void> {
  return api.delete(`/faqs/${id}/`)
}
