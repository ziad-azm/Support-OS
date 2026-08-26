import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { Empty } from '@/shared/ui/Empty'

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

  const query = useCustomers({ ...params, ...(search ? { search } : {}) })

  const columns: readonly ColumnDef<Customer>[] = [
    {
      id: 'name',
      header: t('fields.name'),
      sortable: true,
      cell: (row) => <Link to={`/customers/${row.id}`}>{row.name}</Link>,
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
        <Can permission="customers.manage">
          <Button asChild>
            <Link to="/customers/new">{t('new')}</Link>
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
