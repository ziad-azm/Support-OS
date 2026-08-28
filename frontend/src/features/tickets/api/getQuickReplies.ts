import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'

import type { QuickReply } from '../types/quickReply'

// page_size: 100 (the server's max) — no search-as-you-type combobox
// exists yet, the same simplification `getCategories.ts` already accepted.
export function getQuickReplies(): Promise<Page<QuickReply>> {
  return api.getPage<QuickReply>('/quick-replies/', {
    params: { page_size: 100, ordering: 'title' },
  })
}
