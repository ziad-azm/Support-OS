import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ApiRequestError } from '@/shared/lib/api/errors'
import type { Page } from '@/shared/lib/api/types'
import { Button } from '@/shared/ui/primitives/button'
import { Skeleton } from '@/shared/ui/primitives/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/primitives/table'
import { Empty } from '@/shared/ui/Empty'
import { ErrorState } from '@/shared/ui/ErrorState'

import { DataTablePagination } from './DataTablePagination'
import type { ColumnDef, SortState } from './types'

type DataTableProps<T> = {
  columns: readonly ColumnDef<T>[]
  query: UseQueryResult<Page<T>, unknown>
  rowKey: (row: T) => string
  sort: SortState
  onSortChange: (next: SortState) => void
  onPageChange: (page: number) => void
  /** Visually-hidden <caption>. Required for a screen reader to name the table. */
  caption: string
  empty?: ReactNode
}

function nextSort(columnId: string, current: SortState): SortState {
  if (current?.field !== columnId) return { field: columnId, direction: 'asc' }
  if (current.direction === 'asc') return { field: columnId, direction: 'desc' }
  return null
}

function sortAria(columnId: string, current: SortState): 'ascending' | 'descending' | 'none' {
  if (current?.field !== columnId) return 'none'
  return current.direction === 'asc' ? 'ascending' : 'descending'
}

/**
 * The one table pattern for every list screen — server-driven sorting and
 * pagination against `meta.pagination` (backend/apps/core/pagination.py).
 *
 * Does not wrap QueryBoundary: QueryBoundary's non-success branches return a
 * <div>, which is not a valid child of <tbody> and gets hoisted out of the
 * table by the browser. Instead, every non-success state renders inside a
 * <TableRow><TableCell colSpan> — the same Loading/Empty/ErrorState
 * components, in a place a <div> is valid. See CONVENTIONS.md §19.
 */
export function DataTable<T>({
  columns,
  query,
  rowKey,
  sort,
  onSortChange,
  onPageChange,
  caption,
  empty,
}: DataTableProps<T>) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead
                key={column.id}
                aria-sort={column.sortable ? sortAria(column.id, sort) : undefined}
                className={column.align === 'end' ? 'text-end' : undefined}
              >
                {column.sortable ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="-ms-2"
                    onClick={() => onSortChange(nextSort(column.id, sort))}
                    aria-label={
                      sortAria(column.id, sort) === 'ascending'
                        ? t('table.sortDescending')
                        : sortAria(column.id, sort) === 'descending'
                          ? t('table.clearSort')
                          : t('table.sortAscending')
                    }
                  >
                    {column.header}
                    {sort?.field === column.id ? (
                      sort.direction === 'asc' ? (
                        <ChevronUpIcon className="size-4" />
                      ) : (
                        <ChevronDownIcon className="size-4" />
                      )
                    ) : null}
                  </Button>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.isPending
            ? Array.from({ length: 3 }, (_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}

          {query.isError
            ? (() => {
                const error =
                  query.error instanceof ApiRequestError
                    ? query.error
                    : new ApiRequestError({
                        code: 'unknown_error',
                        message: t('states.error.generic'),
                      })
                return (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <ErrorState error={error} onRetry={() => void query.refetch()} />
                    </TableCell>
                  </TableRow>
                )
              })()
            : null}

          {query.isSuccess && query.data.items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>
                {empty ?? <Empty title={t('table.noResults')} />}
              </TableCell>
            </TableRow>
          ) : null}

          {query.isSuccess && query.data.items.length > 0
            ? query.data.items.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={column.align === 'end' ? 'text-end' : undefined}
                    >
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}
        </TableBody>
      </Table>
      {query.isSuccess ? (
        <DataTablePagination pagination={query.data.pagination} onPageChange={onPageChange} />
      ) : null}
    </div>
  )
}
