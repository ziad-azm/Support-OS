import { useQuery } from '@tanstack/react-query'

import { getAgentPerformance } from './getAgentPerformance'
import type { AgentPerformanceParams } from './getAgentPerformance'
import { reportKeys } from './reportKeys'

export function useAgentPerformance(params: AgentPerformanceParams) {
  return useQuery({
    queryKey: reportKeys.resource('agent-performance', params),
    queryFn: () => getAgentPerformance(params),
  })
}
