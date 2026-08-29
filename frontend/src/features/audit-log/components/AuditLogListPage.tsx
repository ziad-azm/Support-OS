import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useFormatters } from '@/shared/hooks/useFormatters'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useAuditLogs } from '../api/useAuditLogs'
import { AUDIT_LOG_ACTIONS } from '../types/auditLog'
import type { AuditLog, AuditLogAction } from '../types/auditLog'

/**
 * The audit-log viewer — SEC-3's "filtered viewer". No `PageHeader` action
 * (nothing to create from this screen) and no search input (`target_label`
 * search is not asked for by the intake; the two dropdown filters are).
 * Copies `TicketListPage`'s Select-filter-plus-page-reset shape rather than
 * `UserListPage`'s search-only shape, since this screen's filtering need is
 * closer to ticket's multi-dimension filter set than to a plain search.
 */
export function AuditLogListPage() {
  const { t } = useTranslation('auditLog')
  const { dateTime } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  // "all" is the sentinel for "no filter" — Radix's Select.Item requires a
  // non-empty value, mirroring TicketListPage's identical convention.
  const [actionFilter, setActionFilter] = useState('all')
  const [targetTypeFilter, setTargetTypeFilter] = useState('all')

  useEffect(() => {
    setPage(1)
  }, [actionFilter, targetTypeFilter, setPage])

  const query = useAuditLogs({
    ...params,
    ...(actionFilter !== 'all' ? { action: actionFilter as AuditLogAction } : {}),
    ...(targetTypeFilter !== 'all' ? { target_type: targetTypeFilter as 'user' | 'role' } : {}),
  })

  const columns: readonly ColumnDef<AuditLog>[] = [
    {
      id: 'created_at',
      header: t('fields.when'),
      sortable: true,
      cell: (row) => dateTime(row.created_at),
    },
    {
      id: 'actor_name',
      header: t('fields.actor'),
      cell: (row) => row.actor_name ?? t('deletedActor'),
    },
    {
      id: 'action',
      header: t('fields.action'),
      sortable: true,
      cell: (row) => row.action_display,
    },
    {
      id: 'target_label',
      header: t('fields.target'),
      cell: (row) => row.target_label,
    },
    {
      id: 'change',
      header: t('fields.change'),
      cell: (row) =>
        row.from_value || row.to_value ? `${row.from_value} → ${row.to_value}` : null,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('title')} />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger aria-label={t('filters.action')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allActions')}</SelectItem>
            {AUDIT_LOG_ACTIONS.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`actions.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={targetTypeFilter} onValueChange={setTargetTypeFilter}>
          <SelectTrigger aria-label={t('filters.targetType')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allTargetTypes')}</SelectItem>
            <SelectItem value="user">{t('filters.targetTypeUser')}</SelectItem>
            <SelectItem value="role">{t('filters.targetTypeRole')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('title')}
        empty={<Empty title={t('empty')} description={t('emptyDescription')} />}
      />
    </div>
  )
}
