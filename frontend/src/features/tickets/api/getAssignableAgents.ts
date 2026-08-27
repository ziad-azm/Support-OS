import { api } from '@/shared/lib/api/client'

import type { AgentOption } from '../types/agentOption'

// A plain array, not a paginated `Page<T>` — the endpoint is an @action
// returning a short curated list, the same shape
// `features/customers/api/getCustomerTimeline.ts` (Story 20) returns.
export function getAssignableAgents(): Promise<AgentOption[]> {
  return api.get<AgentOption[]>('/tickets/assignable-agents/')
}
