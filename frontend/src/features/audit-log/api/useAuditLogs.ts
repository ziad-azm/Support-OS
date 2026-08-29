import { useQuery } from '@tanstack/react-query'

import { getAuditLogs } from './getAuditLogs'
import type { AuditLogListParams } from './getAuditLogs'
import { auditLogKeys } from './auditLogKeys'

export function useAuditLogs(params: AuditLogListParams) {
  return useQuery({
    queryKey: auditLogKeys.resource('list', params),
    queryFn: () => getAuditLogs(params),
  })
}
