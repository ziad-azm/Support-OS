import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { InternalNote } from '../types/internalNote'

// page_size: 100 — a ticket's internal notes are a short inline list,
// the same simplification `getNotes.ts` (features/customers) accepted.
export function getInternalNotes(ticketId: number): Promise<Page<InternalNote>> {
  return api.getPage<InternalNote>('/internal-notes/', {
    params: { ticket: ticketId, page_size: 100 },
  })
}
