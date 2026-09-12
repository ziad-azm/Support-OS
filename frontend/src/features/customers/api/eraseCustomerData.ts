import { api } from '@/shared/lib/api/client'

import type { Customer } from '../types/customer'

export function eraseCustomerData(customerId: number): Promise<Customer> {
  return api.post<Customer>(`/customers/${customerId}/erase-data/`)
}
