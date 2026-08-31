import { api } from '@/shared/lib/api/client'

import type { CsatBreakdownRow } from '../types/csat'

export type CsatBreakdownParams = { from?: string; to?: string }

export function getCsatBreakdown(params: CsatBreakdownParams): Promise<CsatBreakdownRow[]> {
  return api.get<CsatBreakdownRow[]>('/reports/csat/breakdown/', { params })
}
