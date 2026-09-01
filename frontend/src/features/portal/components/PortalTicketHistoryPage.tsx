import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { usePortalTickets } from '../api/usePortalTickets'
import { ticketPriorityVariant } from '../lib/statusBadge'
import type { PortalTicket } from '../types/portalTicket'

/**
 * The customer's own closed-ticket archive — PORTAL-3. Reuses PORTAL-2's
 * `usePortalTickets`/`DataTable` unchanged; the only difference from
 * `PortalTicketListPage` is a fixed `status: 'closed'` (no picker — the
 * whole page IS the closed-only view) and one extra column.
 *
 * `updated_at` is labelled "Last updated", not "Closed on" — `Ticket` has
 * no dedicated closed-at field, and `updated_at` can move for reasons
 * unrelated to closing (e.g. a later escalation toggle). Not sortable:
 * `updated_at` is absent from `PortalTicketViewSet.ordering_fields`
 * (apps/portal/views.py) — OrderingFilter silently drops a field it does
 * not recognise (CONVENTIONS.md §23), so marking this sortable would be a
 * header that toggles and changes nothing.
 */
export function PortalTicketHistoryPage() {
  const { t } = useTranslation('portal')
  const { date } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  const query = usePortalTickets({ ...params, status: 'closed' })

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
      priority: 'sm',
    },
    {
      id: 'assigned_agent_name',
      header: t('tickets.fields.assignedAgent'),
      cell: (row) => row.assigned_agent_name ?? t('tickets.fields.unassigned'),
      priority: 'sm',
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
    {
      id: 'updated_at',
      header: t('tickets.fields.updatedAt'),
      cell: (row) => date(row.updated_at),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('tickets.history.title')}
        action={
          <Link to="/portal/tickets" className="text-sm text-muted-foreground hover:underline">
            {t('tickets.history.viewActive')}
          </Link>
        }
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('tickets.history.title')}
        empty={
          <Empty
            title={t('tickets.history.empty')}
            description={t('tickets.history.emptyDescription')}
          />
        }
      />
    </div>
  )
}
