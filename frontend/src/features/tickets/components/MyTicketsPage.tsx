import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
 * AGENT-1 — the agent's personal queue: every ticket assigned to the
 * caller, filterable by status/priority. `assigned_to_me` is fixed `true`
 * here, not a toggle (contrast `TicketListPage`'s own toggle on the
 * general list). "SLA" from the intake is deliberately absent — no
 * `SLAPolicy`/breach data exists yet. See Story 25 `## Prerequisites`.
 *
 * Lives in `features/tickets`, not a new `features/agent-workspace/`
 * folder: the queue IS ticket data, just filtered, and a separate feature
 * would either duplicate `Ticket`/`TICKET_STATUSES`/`DataTable` or violate
 * `no-restricted-imports` (CONVENTIONS.md §15) reaching back for them.
 */
export function MyTicketsPage() {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
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

  const query = useTickets({
    ...params,
    assigned_to_me: 'true',
    ...(statusFilter !== 'all' ? { status: statusFilter as TicketStatus } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter as TicketPriority } : {}),
  })

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

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('myQueue.title')} />
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
        caption={t('myQueue.title')}
        empty={
          statusFilter !== 'all' || priorityFilter !== 'all' ? (
            <Empty title={t('noSearchResults')} />
          ) : (
            <Empty title={t('myQueue.empty')} description={t('myQueue.emptyDescription')} />
          )
        }
      />
    </div>
  )
}
