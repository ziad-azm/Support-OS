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

import { useDeleteBranch } from '../api/useBranchMutations'
import { useBranchList } from '../api/useBranchList'
import type { Branch } from '../types/branch'

/**
 * The management screen — ORG-2. Reachable on `branches.view` alone
 * (`manager`/`agent` both hold it, since they need the picker this list
 * doubles as a reference for); every write control is additionally gated
 * on `branches.manage`, the same split `DepartmentListPage.tsx` already
 * establishes for `departments.manage`.
 */
export function BranchListPage() {
  const { t } = useTranslation('organization')
  const { date } = useFormatters()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useBranchList({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteBranch()

  async function handleDelete(branch: Branch) {
    const confirmed = await confirm({
      title: t('branches.delete.title'),
      description: t('branches.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(branch.id)
  }

  const columns: readonly ColumnDef<Branch>[] = [
    {
      id: 'name',
      header: t('branches.fields.name'),
      sortable: true,
      cell: (row) => <TableLink to={`/settings/branches/${row.id}/edit`}>{row.name}</TableLink>,
    },
    {
      id: 'description',
      header: t('branches.fields.description'),
      // Not sortable: absent from `BranchViewSet.ordering_fields`, the
      // same rule every secondary column in this codebase follows.
      cell: (row) => row.description,
      priority: 'sm',
    },
    {
      id: 'created_at',
      header: t('branches.fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
    {
      id: 'actions',
      header: t('branches.fields.actions'),
      cell: (row) => (
        <Can permission="branches.manage">
          <DeleteRowButton onClick={() => void handleDelete(row)}>
            {t('branches.actions.delete')}
          </DeleteRowButton>
        </Can>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('branches.title')}
        action={
          <Can permission="branches.manage">
            <Button asChild>
              <Link to="/settings/branches/new">
                <PlusIcon />
                {t('branches.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('branches.searchPlaceholder')}
        aria-label={t('branches.search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('branches.title')}
        empty={
          search ? (
            <Empty title={t('branches.noSearchResults')} />
          ) : (
            <Empty title={t('branches.empty')} description={t('branches.emptyDescription')} />
          )
        }
      />
    </div>
  )
}
