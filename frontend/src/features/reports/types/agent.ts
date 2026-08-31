/** The three metrics `/api/reports/agents/performance/` accepts via
 * `?metric=`, mirroring `apps/reports/agents.py::METRICS`. */
export const AGENT_METRICS = ['handled', 'resolution', 'csat'] as const
export type AgentMetric = (typeof AGENT_METRICS)[number]
