import { api } from '@/shared/lib/api/client'

import type { ReportDimension, VolumePoint } from '../types/report'

export type TicketVolumeParams = {
  from?: string
  to?: string
  bucket?: 'day' | 'week' | 'month'
  series?: ReportDimension
  // A string, because the value carries either a numeric department id or
  // the literal `'none'` — the backend scoping sentinel (ORG-1).
  department?: string
}

// api.get, not api.getPage — neither report endpoint paginates, so there is
// no meta.pagination and getPage would throw invalid_envelope.
export function getTicketVolume(params: TicketVolumeParams): Promise<VolumePoint[]> {
  return api.get<VolumePoint[]>('/reports/tickets/volume/', { params })
}
