import { api } from '@/shared/lib/api/client'

export function deleteCustomer(id: number): Promise<void> {
  return api.delete(`/customers/${id}/`)
}
