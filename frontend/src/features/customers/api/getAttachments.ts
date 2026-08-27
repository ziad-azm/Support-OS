import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { Attachment } from '../types/attachment'

export function getAttachments(customerId: number): Promise<Page<Attachment>> {
  return api.getPage<Attachment>('/attachments/', {
    params: { customer: customerId, page_size: 100 },
  })
}
