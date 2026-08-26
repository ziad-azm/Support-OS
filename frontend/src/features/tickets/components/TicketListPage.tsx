import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'

import { useTickets } from '../api/useTickets'
import type { Ticket } from '../types/ticket'

const SEARCH_DEBOUNCE_MS = 300

/**
 * The list screen. Copies `CustomerListPage`'s shape exactly — see Story 12
 * `## Context — Read These Files First`.
 *
 * Not wrapped in `QueryBoundary` — `DataTable` renders its own loading/empty
 * /error rows. See `DataTable`'s docstring.
 */
export function TicketListPage() {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  // `useServerTable.setSort` resets the page on a sort change, but nothing
  // resets it on a search change — a filtered result set can be narrower
  // than the page the user was on. Reset explicitly.
  useEffect(() => {
    setPage(1)
  }, [search, setPage])

  const query = useTickets({ ...params, ...(search ? { search } : {}) })

  const columns: readonly ColumnDef<Ticket>[] = [
    {
      id: 'subject',
      header: t('fields.subject'),
      sortable: true,
      cell: (row) => <Link to={`/tickets/${row.id}`}>{row.subject}</Link>,
    },
    {
      id: 'customer_name',
      header: t('fields.customer'),
      // Not sortable: `customer_name` is not in the viewset's `ordering_fields`
      // — the same choice Story 10 made for `Customer.phone`.
      cell: (row) => row.customer_name,
    },
    {
      id: 'status',
      header: t('fields.status'),
      sortable: true,
      cell: (row) => <Badge variant="secondary">{t(`statuses.${row.status}`)}</Badge>,
    },
    {
      id: 'priority',
      header: t('fields.priority'),
      sortable: true,
      cell: (row) => <Badge variant="secondary">{t(`priorities.${row.priority}`)}</Badge>,
    },
    {
      id: 'created_at',
      header: t('fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <Can permission="tickets.manage">
          <Button asChild>
            <Link to="/tickets/new">{t('new')}</Link>
          </Button>
        </Can>
      </div>
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('title')}
        empty={
          search ? (
            <Empty title={t('noSearchResults')} />
          ) : (
            <Empty title={t('empty')} description={t('emptyDescription')} />
          )
        }
      />
    </div>
  )
}
