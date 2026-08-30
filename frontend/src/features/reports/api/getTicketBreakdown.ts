import { api } from '@/shared/lib/api/client'

import type { BreakdownRow, ReportDimension } from '../types/report'

export type TicketBreakdownParams = {
  from?: string
  to?: string
  dimension: ReportDimension
}

export function getTicketBreakdown(params: TicketBreakdownParams): Promise<BreakdownRow[]> {
  return api.get<BreakdownRow[]>('/reports/tickets/breakdown/', { params })
}
