import { api } from '@/shared/lib/api/client'
import type { Page } from '@/shared/lib/api/types'
import type { ServerTableParams } from '@/shared/ui/data-table/useServerTable'

import type { AuditLog, AuditLogAction } from '../types/auditLog'

export type AuditLogListParams = ServerTableParams & {
  actor?: number
  action?: AuditLogAction
  target_type?: 'user' | 'role'
  date_from?: string
  date_to?: string
}

export function getAuditLogs(params: AuditLogListParams): Promise<Page<AuditLog>> {
  return api.getPage<AuditLog>('/audit-logs/', { params })
}
