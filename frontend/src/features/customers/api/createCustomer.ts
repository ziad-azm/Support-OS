import { api } from '@/shared/lib/api/client'

import type { Customer, CustomerInput } from '../types/customer'

export function createCustomer(input: CustomerInput): Promise<Customer> {
  return api.post<Customer>('/customers/', input)
}
