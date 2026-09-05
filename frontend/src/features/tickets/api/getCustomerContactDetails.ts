import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { ContactDetail } from '../types/contactDetail'

// `page_size: 100` (the server's max — `DRF_MAX_PAGE_SIZE`) requests every
// contact in one page — same call `features/customers/api/getContactDetails.ts`
// already makes, for the same reason: this list drives `ReplyForm`'s
// `target_address` options, never a paginated table.
export function getCustomerContactDetails(customerId: number): Promise<Page<ContactDetail>> {
  return api.getPage<ContactDetail>('/contact-details/', {
    params: { customer: customerId, page_size: 100 },
  })
}
