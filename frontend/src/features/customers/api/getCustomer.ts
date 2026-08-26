import { api } from '@/shared/lib/api/client'

import type { Customer } from '../types/customer'

export function getCustomer(id: number): Promise<Customer> {
  return api.get<Customer>(`/customers/${id}/`)
}
