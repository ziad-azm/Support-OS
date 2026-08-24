import { api } from '@/shared/lib/api/client'

import type { HealthStatus } from '../types/health'

// Trailing slash required: Django's APPEND_SLASH would otherwise 301 the call.
export function getHealth(): Promise<HealthStatus> {
  return api.get<HealthStatus>('/health/')
}
