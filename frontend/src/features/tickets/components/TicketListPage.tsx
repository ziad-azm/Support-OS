import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { Label } from '@/shared/ui/primitives/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { Switch } from '@/shared/ui/primitives/switch'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'

import { useCategories } from '../api/useCategories'
import { useTickets } from '../api/useTickets'
import { TICKET_PRIORITIES } from '../types/ticket'
import type { Ticket, TicketPriority } from '../types/ticket'

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
  // "all" is the sentinel for "no filter" — Radix's Select.Item requires a
  // non-empty value, mirroring the form's CATEGORY_NONE sentinel.
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [onlyMine, setOnlyMine] = useState(false)
  const categoriesQuery = useCategories()

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  // A filter change narrows the result set the same way a search does —
  // reset to page 1, or the user can land on a now-nonexistent page.
  useEffect(() => {
    setPage(1)
  }, [search, categoryFilter, priorityFilter, onlyMine, setPage])

  const query = useTickets({
    ...params,
    ...(search ? { search } : {}),
    ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
    ...(priorityFilter !== 'all' ? { priority: priorityFilter as TicketPriority } : {}),
    ...(onlyMine ? { assigned_to_me: 'true' as const } : {}),
  })

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
      id: 'category_name',
      header: t('fields.category'),
      // Not sortable: mirrors `customer_name`'s precedent (Story 12) — a
      // joined/derived display column, not in the viewset's
      // `ordering_fields`. See Story 18 `## Prerequisites`.
      cell: (row) => row.category_name ?? t('fields.noCategory'),
    },
    {
      id: 'assigned_agent_name',
      header: t('fields.assignedAgent'),
      // Not sortable: a joined display column absent from the viewset's
      // `ordering_fields`, same as `customer_name`/`category_name`.
      cell: (row) => row.assigned_agent_name ?? t('fields.unassigned'),
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
      <div className="flex flex-wrap items-center gap-2">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger aria-label={t('filters.category')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allCategories')}</SelectItem>
            {(categoriesQuery.data?.items ?? []).map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
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
        <div className="flex items-center gap-2">
          <Switch
            id="only-mine"
            checked={onlyMine}
            onCheckedChange={setOnlyMine}
            aria-label={t('filters.onlyMine')}
          />
          <Label htmlFor="only-mine" className="text-sm">
            {t('filters.onlyMine')}
          </Label>
        </div>
      </div>
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
