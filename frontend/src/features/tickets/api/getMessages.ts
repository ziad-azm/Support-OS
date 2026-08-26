import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Message } from '../types/message'

// page_size: 100 (the server's max) — same simplification as the contact
// list (Story 11) and the customer selector (Story 12): no pagination UI
// exists for a conversation thread. No `ordering` param — `Message.Meta.ordering`
// (chronological) is already the order this view needs.
export function getMessages(ticketId: number): Promise<Page<Message>> {
  return api.getPage<Message>('/messages/', {
    params: { ticket: ticketId, page_size: 100 },
  })
}
