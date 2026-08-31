import { api } from '@/shared/lib/api/client'

import type { SlaTrendPoint } from '../types/sla'

export type SlaTrendParams = {
  from?: string
  to?: string
  bucket?: 'day' | 'week' | 'month'
}

export function getSlaTrend(params: SlaTrendParams): Promise<SlaTrendPoint[]> {
  return api.get<SlaTrendPoint[]>('/reports/sla/trend/', { params })
}
