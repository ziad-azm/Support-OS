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

import { useDeleteDepartment } from '../api/useDepartmentMutations'
import { useDepartmentList } from '../api/useDepartmentList'
import type { Department } from '../types/department'

/**
 * The management screen — ORG-1. Reachable on `departments.view` alone
 * (`manager`/`agent` both hold it, since they need the picker this list
 * doubles as a reference for); every write control is additionally gated
 * on `departments.manage`, the same split `RoleListPage.tsx` already
 * establishes for `roles.manage`.
 */
export function DepartmentListPage() {
  const { t } = useTranslation('organization')
  const { date } = useFormatters()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useDepartmentList({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteDepartment()

  async function handleDelete(department: Department) {
    const confirmed = await confirm({
      title: t('departments.delete.title'),
      description: t('departments.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(department.id)
  }

  const columns: readonly ColumnDef<Department>[] = [
    {
      id: 'name',
      header: t('departments.fields.name'),
      sortable: true,
      cell: (row) => <TableLink to={`/settings/departments/${row.id}/edit`}>{row.name}</TableLink>,
    },
    {
      id: 'description',
      header: t('departments.fields.description'),
      // Not sortable: absent from `DepartmentViewSet.ordering_fields`, the
      // same rule every secondary column in this codebase follows.
      cell: (row) => row.description,
      priority: 'sm',
    },
    {
      id: 'created_at',
      header: t('departments.fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
    {
      id: 'actions',
      header: t('departments.fields.actions'),
      cell: (row) => (
        <Can permission="departments.manage">
          <DeleteRowButton onClick={() => void handleDelete(row)}>
            {t('departments.actions.delete')}
          </DeleteRowButton>
        </Can>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('departments.title')}
        action={
          <Can permission="departments.manage">
            <Button asChild>
              <Link to="/settings/departments/new">
                <PlusIcon />
                {t('departments.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('departments.searchPlaceholder')}
        aria-label={t('departments.search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('departments.title')}
        empty={
          search ? (
            <Empty title={t('departments.noSearchResults')} />
          ) : (
            <Empty title={t('departments.empty')} description={t('departments.emptyDescription')} />
          )
        }
      />
    </div>
  )
}
