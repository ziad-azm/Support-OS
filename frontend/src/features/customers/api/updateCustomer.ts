import { api } from '@/shared/lib/api/client'

import type { Customer, CustomerInput } from '../types/customer'

// PATCH, not PUT. Verified: DRF drops an absent optional field from
// `validated_data`, so a full-update PUT cannot clear a value by omission —
// and PATCH's "only what I sent" semantics are what an edit form actually
// means. Clearing is done by sending `null` explicitly (see the form schema).
export function updateCustomer(id: number, input: CustomerInput): Promise<Customer> {
  return api.patch<Customer>(`/customers/${id}/`, input)
}
