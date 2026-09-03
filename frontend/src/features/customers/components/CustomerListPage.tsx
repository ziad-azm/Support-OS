import { useEffect, useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { useBranches } from '@/shared/branches'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
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

import { useCustomers } from '../api/useCustomers'
import type { Customer } from '../types/customer'

const SEARCH_DEBOUNCE_MS = 300

/**
 * The list screen. First real consumer of `DataTable` + `useServerTable`.
 *
 * Not wrapped in `QueryBoundary` — `DataTable` renders its own loading/empty
 * /error rows, and `QueryBoundary`'s branches return a `<div>`, invalid
 * inside `<tbody>`. See `DataTable`'s docstring.
 */
export function CustomerListPage() {
  const { t } = useTranslation('customers')
  const { date } = useFormatters()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  // "all" is "no filter"; the literal "none" is a real, distinct filter
  // value — the backend's own `?branch=none` sentinel for "no branch"
  // (`apps.core.scoping.UNSCOPED`) — so it needs no client-side
  // translation before it reaches `useCustomers` (ORG-2).
  const [branchFilter, setBranchFilter] = useState('all')
  const branchesQuery = useBranches()

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [searchInput])

  // `useServerTable.setSort` resets the page on a sort change, but nothing
  // resets it on a search change — a filtered result set can be narrower
  // than the page the user was on. Reset explicitly.
  useEffect(() => {
    setPage(1)
  }, [search, branchFilter, setPage])

  const query = useCustomers({
    ...params,
    ...(search ? { search } : {}),
    ...(branchFilter !== 'all' ? { branch: branchFilter } : {}),
  })

  const columns: readonly ColumnDef<Customer>[] = [
    {
      id: 'name',
      header: t('fields.name'),
      sortable: true,
      cell: (row) => <TableLink to={`/customers/${row.id}`}>{row.name}</TableLink>,
    },
    {
      id: 'email',
      header: t('fields.email'),
      sortable: true,
      cell: (row) => row.email ?? '—',
    },
    {
      id: 'phone',
      header: t('fields.phone'),
      // Not sortable: `phone` is not in the viewset's `ordering_fields`.
      cell: (row) => row.phone,
    },
    {
      id: 'company',
      header: t('fields.company'),
      sortable: true,
      cell: (row) => row.company,
      priority: 'sm',
    },
    {
      id: 'branch_name',
      header: t('fields.branch'),
      // Not sortable: a joined display column absent from
      // `CustomerViewSet.ordering_fields` (ORG-2).
      cell: (row) => row.branch_name ?? t('fields.noBranch'),
      priority: 'sm',
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
      <PageHeader
        title={t('title')}
        action={
          <Can permission="customers.manage">
            <Button asChild>
              <Link to="/customers/new">
                <PlusIcon />
                {t('new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('search')}
          className="max-w-xs"
        />
        <Select value={branchFilter} onValueChange={setBranchFilter}>
          <SelectTrigger aria-label={t('filters.branch')} size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allBranches')}</SelectItem>
            <SelectItem value="none">{t('fields.noBranch')}</SelectItem>
            {(branchesQuery.data?.items ?? []).map((branch) => (
              <SelectItem key={branch.id} value={String(branch.id)}>
                {branch.name}
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
