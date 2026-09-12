import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { DeleteRowButton } from '@/shared/ui/data-table/DeleteRowButton'
import { TableLink } from '@/shared/ui/data-table/TableLink'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useDeleteCalendar } from '../api/useCalendarMutations'
import { useCalendarList } from '../api/useCalendarList'
import type { Calendar } from '../types/calendar'

/**
 * The management screen — SLA-5 (Story 111). Reachable on
 * `calendars.view` alone (`admin`/`manager` both hold it, since the
 * `BranchFormPage` calendar picker needs the list too); every write
 * control is additionally gated on `calendars.manage`, the same split
 * `BranchListPage.tsx` already establishes for `branches.manage`.
 */
export function CalendarListPage() {
  const { t } = useTranslation('organization')
  const { date } = useFormatters()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useCalendarList({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteCalendar()

  async function handleDelete(calendar: Calendar) {
    const confirmed = await confirm({
      title: t('calendars.delete.title'),
      description: t('calendars.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(calendar.id)
  }

  const columns: readonly ColumnDef<Calendar>[] = [
    {
      id: 'name',
      header: t('calendars.fields.name'),
      sortable: true,
      cell: (row) => <TableLink to={`/settings/calendars/${row.id}/edit`}>{row.name}</TableLink>,
    },
    {
      id: 'description',
      header: t('calendars.fields.description'),
      // Not sortable: absent from `CalendarViewSet.ordering_fields`, the
      // same rule every secondary column in this codebase follows.
      cell: (row) => row.description,
      priority: 'sm',
    },
    {
      id: 'created_at',
      header: t('calendars.fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
    {
      id: 'actions',
      header: t('calendars.fields.actions'),
      cell: (row) => (
        <Can permission="calendars.manage">
          <DeleteRowButton onClick={() => void handleDelete(row)}>
            {t('calendars.actions.delete')}
          </DeleteRowButton>
        </Can>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('calendars.title')}
        action={
          <Can permission="calendars.manage">
            <Button asChild>
              <Link to="/settings/calendars/new">
                <PlusIcon />
                {t('calendars.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('calendars.searchPlaceholder')}
        aria-label={t('calendars.search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('calendars.title')}
        empty={
          search ? (
            <Empty title={t('calendars.noSearchResults')} />
          ) : (
            <Empty title={t('calendars.empty')} description={t('calendars.emptyDescription')} />
          )
        }
      />
    </div>
  )
}
