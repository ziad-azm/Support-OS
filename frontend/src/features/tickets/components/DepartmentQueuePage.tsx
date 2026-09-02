import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { TableLink } from '@/shared/ui/data-table/TableLink'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useTickets } from '../api/useTickets'
import { ticketPriorityVariant, ticketStatusVariant } from '../lib/statusBadge'
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../types/ticket'
import type { Ticket, TicketPriority, TicketStatus } from '../types/ticket'

/**
 * ORG-1's department queue: every ticket in the caller's own department,
 * filterable by status/priority — `MyTicketsPage.tsx`'s exact shape with
 * `assigned_to_me: 'true'` swapped for `department: String(user.department.id)`
 * and an `assigned_agent_name` column added (unlike "my tickets", these
 * rows belong to other people). Renders an empty state and fires no query
 * at all when the caller has no department — see `## Edge Cases`.
 */
export function DepartmentQueuePage() {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const { user } = useAuth()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  // "all" is the sentinel for "no filter" — same as `TicketListPage`'s
  // category/priority `Select`s (CONVENTIONS.md §19).
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')

  useEffect(() => {
    setPage(1)
  }, [statusFilter, priorityFilter, setPage])

  const departmentId = user?.department?.id
  // Query disabled entirely when the caller has no department — never
  // fires `?department=undefined`, which would otherwise list every
  // ticket instead of none. See `## Edge Cases`.
  const query = useTickets(
    {
      ...params,
      ...(departmentId !== undefined ? { department: String(departmentId) } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter as TicketStatus } : {}),
      ...(priorityFilter !== 'all' ? { priority: priorityFilter as TicketPriority } : {}),
    },
    { enabled: departmentId !== undefined },
  )

  const columns: readonly ColumnDef<Ticket>[] = [
    {
      id: 'subject',
      header: t('fields.subject'),
      sortable: true,
      cell: (row) => <TableLink to={`/tickets/${row.id}`}>{row.subject}</TableLink>,
    },
    {
      id: 'customer_name',
      header: t('fields.customer'),
      cell: (row) => row.customer_name,
    },
    {
      id: 'category_name',
      header: t('fields.category'),
      cell: (row) => row.category_name ?? t('fields.noCategory'),
      priority: 'sm',
    },
    {
      id: 'assigned_agent_name',
      header: t('fields.assignedAgent'),
      cell: (row) => row.assigned_agent_name ?? t('fields.unassigned'),
    },
    {
      id: 'status',
      header: t('fields.status'),
      sortable: true,
      cell: (row) => (
        <Badge variant={ticketStatusVariant(row.status)}>{t(`statuses.${row.status}`)}</Badge>
      ),
    },
    {
      id: 'priority',
      header: t('fields.priority'),
      sortable: true,
      cell: (row) => (
        <Badge variant={ticketPriorityVariant(row.priority)}>
          {t(`priorities.${row.priority}`)}
        </Badge>
      ),
    },
    {
      id: 'created_at',
      header: t('fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
      priority: 'sm',
    },
  ]

  if (departmentId === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t('departmentQueue.title')} />
        <Empty
          title={t('departmentQueue.noDepartment')}
          description={t('departmentQueue.noDepartmentDescription')}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('departmentQueue.title')} />
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label={t('filters.status')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
            {TICKET_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`statuses.${value}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger aria-label={t('filters.priority')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allPriorities')}</SelectItem>
            {TICKET_PRIORITIES.map((value) => (
              <SelectItem key={value} value={value}>
                {t(`priorities.${value}`)}
              </SelectItem>
            ))}
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
        caption={t('departmentQueue.title')}
        empty={
          statusFilter !== 'all' || priorityFilter !== 'all' ? (
            <Empty title={t('noSearchResults')} />
          ) : (
            <Empty
              title={t('departmentQueue.empty')}
              description={t('departmentQueue.emptyDescription')}
            />
          )
        }
      />
    </div>
  )
}
