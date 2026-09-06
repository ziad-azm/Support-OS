import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { LandingHighlightRow } from '../types/landing'

export type LandingHighlightListParams = ServerTableParams & { search?: string }

export function getLandingHighlightList(
  params: LandingHighlightListParams,
): Promise<Page<LandingHighlightRow>> {
  return api.getPage<LandingHighlightRow>('/landing-highlights/', { params })
}
