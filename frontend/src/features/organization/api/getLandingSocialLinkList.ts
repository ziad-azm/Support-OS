import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { LandingSocialLinkRow } from '../types/landing'

export type LandingSocialLinkListParams = ServerTableParams & { search?: string }

export function getLandingSocialLinkList(
  params: LandingSocialLinkListParams,
): Promise<Page<LandingSocialLinkRow>> {
  return api.getPage<LandingSocialLinkRow>('/landing-social-links/', { params })
}
