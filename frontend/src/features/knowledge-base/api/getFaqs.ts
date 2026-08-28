import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { Faq } from '../types/faq'

export type FaqListParams = ServerTableParams & { search?: string }

export function getFaqs(params: FaqListParams): Promise<Page<Faq>> {
  return api.getPage<Faq>('/faqs/', { params })
}
