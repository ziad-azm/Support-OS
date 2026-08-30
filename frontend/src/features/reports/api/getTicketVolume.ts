import { api } from '@/shared/lib/api/client'

import type { ReportDimension, VolumePoint } from '../types/report'

export type TicketVolumeParams = {
  from?: string
  to?: string
  bucket?: 'day' | 'week' | 'month'
  series?: ReportDimension
}

// api.get, not api.getPage — neither report endpoint paginates, so there is
// no meta.pagination and getPage would throw invalid_envelope.
export function getTicketVolume(params: TicketVolumeParams): Promise<VolumePoint[]> {
  return api.get<VolumePoint[]>('/reports/tickets/volume/', { params })
}
