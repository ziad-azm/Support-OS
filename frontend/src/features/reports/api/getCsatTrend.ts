import { api } from '@/shared/lib/api/client'

import type { CsatTrendPoint } from '../types/csat'

export type CsatTrendParams = { from?: string; to?: string; bucket?: 'day' | 'week' | 'month' }

export function getCsatTrend(params: CsatTrendParams): Promise<CsatTrendPoint[]> {
  return api.get<CsatTrendPoint[]>('/reports/csat/trend/', { params })
}
