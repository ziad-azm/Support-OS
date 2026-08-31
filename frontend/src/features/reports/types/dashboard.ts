/** Fixed order, mirroring `apps/reports/dashboard.py::DASHBOARD_KPIS` —
 * "Open tickets, SLA health, CSAT, agent load", the intake's own list. */
export const DASHBOARD_KPIS = ['open_rate', 'sla_health', 'csat_risk', 'agent_load'] as const
export type DashboardKpi = (typeof DASHBOARD_KPIS)[number]

/** One row from `/api/reports/dashboard/kpis/`. `value` is a 0-1
 * "badness" fraction (0 = best, 1 = worst) — passed straight into
 * `GaugeChart` with no transformation. `null` when there was nothing
 * to rate in the selected period (see Story 60 `## Prerequisites`). */
export type DashboardKpiRow = {
  key: DashboardKpi
  value: number | null
}
