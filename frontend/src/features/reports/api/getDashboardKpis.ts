import { api } from '@/shared/lib/api/client'

import type { DashboardKpiRow } from '../types/dashboard'

export type DashboardKpiParams = { from?: string; to?: string }

export function getDashboardKpis(params: DashboardKpiParams): Promise<DashboardKpiRow[]> {
  return api.get<DashboardKpiRow[]>('/reports/dashboard/kpis/', { params })
}
