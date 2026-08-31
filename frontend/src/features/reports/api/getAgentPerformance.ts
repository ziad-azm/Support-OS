import { api } from '@/shared/lib/api/client'
import type { ChartCategory } from '@/shared/ui/chart'

import type { AgentMetric } from '../types/agent'

export type AgentPerformanceParams = {
  from?: string
  to?: string
  metric: AgentMetric
}

export function getAgentPerformance(params: AgentPerformanceParams): Promise<ChartCategory[]> {
  return api.get<ChartCategory[]>('/reports/agents/performance/', { params })
}
