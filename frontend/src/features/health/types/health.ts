/** Mirrors `apps.core.views.HealthView` — the payload inside `data`. */
export type HealthStatus = {
  status: 'ok' | 'degraded'
  database: 'ok' | 'error'
}
