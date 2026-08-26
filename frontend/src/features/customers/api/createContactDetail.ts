import { api } from '@/shared/lib/api/client'

import type { ContactDetail, ContactDetailInput } from '../types/contactDetail'

export function createContactDetail(input: ContactDetailInput): Promise<ContactDetail> {
  return api.post<ContactDetail>('/contact-details/', input)
}
