import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { ContactDetail } from '../types/contactDetail'

// `page_size: 100` (the server's max — `DRF_MAX_PAGE_SIZE`) requests every
// contact in one page. This list has no pagination UI (a handful of rows
// inline on the profile); the default page size (25) would silently hide a
// customer's later contacts with no "load more" control to reveal them.
export function getContactDetails(customerId: number): Promise<Page<ContactDetail>> {
  return api.getPage<ContactDetail>('/contact-details/', {
    params: { customer: customerId, page_size: 100 },
  })
}
