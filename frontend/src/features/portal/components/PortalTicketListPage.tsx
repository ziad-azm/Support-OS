import { useEffect, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
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

import { usePortalTickets } from '../api/usePortalTickets'
import { ticketPriorityVariant, ticketStatusVariant } from '../lib/statusBadge'
import { PORTAL_TICKET_STATUSES } from '../types/portalTicket'
import type { PortalTicket, PortalTicketStatus } from '../types/portalTicket'

/**
 * The customer's own ticket queue — PORTAL-2. Shape copied from the staff
 * `MyTicketsPage` (features/tickets/components/MyTicketsPage.tsx), minus
 * the priority filter (out of scope) and the `customer_name` column
 * (redundant — every row belongs to the caller). Not wrapped in
 * `QueryBoundary` — `DataTable` renders its own loading/empty/error rows.
 */
export function PortalTicketListPage() {
  const { t } = useTranslation('portal')
  const { date } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  // "all" is the sentinel for "no filter" — same convention
  // TicketListPage/MyTicketsPage use (CONVENTIONS.md §19).
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => {
    setPage(1)
  }, [statusFilter, setPage])

  const query = usePortalTickets({
    ...params,
    ...(statusFilter !== 'all' ? { status: statusFilter as PortalTicketStatus } : {}),
  })

  const columns: readonly ColumnDef<PortalTicket>[] = [
    {
      id: 'subject',
      header: t('tickets.fields.subject'),
      sortable: true,
      cell: (row) => <Link to={`/portal/tickets/${row.id}`}>{row.subject}</Link>,
    },
    {
      id: 'category_name',
      header: t('tickets.fields.category'),
      cell: (row) => row.category_name ?? t('tickets.fields.noCategory'),
    },
    {
      id: 'assigned_agent_name',
      header: t('tickets.fields.assignedAgent'),
      cell: (row) => row.assigned_agent_name ?? t('tickets.fields.unassigned'),
    },
    {
      id: 'status',
      header: t('tickets.fields.status'),
      sortable: true,
      cell: (row) => (
        <Badge variant={ticketStatusVariant(row.status)}>
          {t(`tickets.statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      id: 'priority',
      header: t('tickets.fields.priority'),
      sortable: true,
      cell: (row) => (
        <Badge variant={ticketPriorityVariant(row.priority)}>
          {t(`tickets.priorities.${row.priority}`)}
        </Badge>
      ),
    },
    {
      id: 'created_at',
      header: t('tickets.fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('tickets.list.title')}
        action={
          <Button asChild>
            <Link to="/portal/tickets/new">
              <PlusIcon />
              {t('tickets.new')}
            </Link>
          </Button>
        }
      />
      <Link to="/portal/tickets/history" className="text-sm text-muted-foreground hover:underline">
        {t('tickets.list.viewHistory')}
      </Link>
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger aria-label={t('tickets.filters.status')} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('tickets.filters.allStatuses')}</SelectItem>
          {PORTAL_TICKET_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`tickets.statuses.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('tickets.list.title')}
        empty={
          <Empty title={t('tickets.list.empty')} description={t('tickets.list.emptyDescription')} />
        }
      />
    </div>
  )
}
