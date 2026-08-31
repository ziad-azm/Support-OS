import { api } from '@/shared/lib/api/client'

import type { SlaBreachRateRow } from '../types/sla'

export type SlaBreachRateParams = { from?: string; to?: string }

export function getSlaBreachRate(params: SlaBreachRateParams): Promise<SlaBreachRateRow[]> {
  return api.get<SlaBreachRateRow[]>('/reports/sla/breach-rate/', { params })
}
