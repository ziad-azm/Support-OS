import { api } from '@/shared/lib/api/client'

import type { Customer } from '../types/customer'

export function grantPortalAccess(customerId: number): Promise<Customer> {
  return api.post<Customer>(`/customers/${customerId}/portal-access/`)
}
