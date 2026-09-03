import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Customer } from '../types/customer'

export type CustomerListParams = ServerTableParams & {
  search?: string
  // A string, because the value carries either a numeric branch id or the
  // literal `'none'` — the backend scoping sentinel (ORG-2).
  branch?: string
}

// Trailing slash required: Django's APPEND_SLASH would otherwise 301 the call.
export function getCustomers(params: CustomerListParams): Promise<Page<Customer>> {
  return api.getPage<Customer>('/customers/', { params })
}
