import { api } from '@/shared/lib/api/client'

import type { Customer } from '../types/customer'

export function revokePortalAccess(customerId: number): Promise<Customer> {
  return api.delete<Customer>(`/customers/${customerId}/portal-access/`)
}
