import { api } from '@/shared/lib/api/client'

import type { ContactDetail, ContactDetailUpdateInput } from '../types/contactDetail'

export function updateContactDetail(
  id: number,
  input: ContactDetailUpdateInput,
): Promise<ContactDetail> {
  return api.patch<ContactDetail>(`/contact-details/${id}/`, input)
}
