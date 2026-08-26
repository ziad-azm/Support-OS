import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { CustomerOption } from '../types/customerOption'

// page_size: 100 (the server's max, DRF_MAX_PAGE_SIZE) — no search-as-you-type
// combobox primitive exists yet, so the selector lists every customer up to
// the server's page cap, the same simplification Story 11 accepted for a
// customer's contact list. See `## Edge Cases` for the forward constraint.
export function getCustomerOptions(): Promise<Page<CustomerOption>> {
  return api.getPage<CustomerOption>('/customers/', {
    params: { page_size: 100, ordering: 'name' },
  })
}
