import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { PortalFaq } from '../types/portalFaq'

export type PortalFaqListParams = ServerTableParams

export function getPortalFaqs(params: PortalFaqListParams): Promise<Page<PortalFaq>> {
  return api.getPage<PortalFaq>('/faqs/', { params })
}
