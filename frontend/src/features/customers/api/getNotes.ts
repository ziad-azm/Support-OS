import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Note } from '../types/note'

// page_size: 100 — a customer's notes are a short inline list, the same
// simplification `getContactDetails.ts` accepted.
export function getNotes(customerId: number): Promise<Page<Note>> {
  return api.getPage<Note>('/notes/', { params: { customer: customerId, page_size: 100 } })
}
