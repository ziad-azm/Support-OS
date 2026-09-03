import { api } from '@/shared/lib/api/client'

import type { BreakdownRow, ReportDimension } from '../types/report'

export type TicketBreakdownParams = {
  from?: string
  to?: string
  dimension: ReportDimension
  // A string, because the value carries either a numeric department id or
  // the literal `'none'` — the backend scoping sentinel (ORG-1).
  department?: string
  // Same string-typed sentinel contract as `department` above (ORG-2).
  branch?: string
}

export function getTicketBreakdown(params: TicketBreakdownParams): Promise<BreakdownRow[]> {
  return api.get<BreakdownRow[]>('/reports/tickets/breakdown/', { params })
}
