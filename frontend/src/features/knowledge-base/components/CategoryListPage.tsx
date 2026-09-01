import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

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

import { useDeleteCategory } from '../api/useCategoryMutations'
import { useCategoryList } from '../api/useCategoryList'
import type { Category } from '../types/category'

export function CategoryListPage() {
  const { t } = useTranslation('knowledgeBase')
  const { date } = useFormatters()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useCategoryList({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteCategory()

  async function handleDelete(category: Category) {
    const confirmed = await confirm({
      title: t('categories.delete.title'),
      description: t('categories.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(category.id)
  }

  const columns: readonly ColumnDef<Category>[] = [
    {
      id: 'name',
      header: t('categories.fields.name'),
      sortable: true,
      cell: (row) => (
        <TableLink to={`/knowledge-base/categories/${row.id}/edit`}>{row.name}</TableLink>
      ),
    },
    {
      id: 'created_at',
      header: t('categories.fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
    {
      id: 'actions',
      header: t('categories.fields.actions'),
      cell: (row) => (
        <DeleteRowButton onClick={() => void handleDelete(row)}>
          {t('categories.actions.delete')}
        </DeleteRowButton>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('categories.title')}
        action={
          <Button asChild>
            <Link to="/knowledge-base/categories/new">
              <PlusIcon />
              {t('categories.new')}
            </Link>
          </Button>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('categories.searchPlaceholder')}
        aria-label={t('categories.search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('categories.title')}
        empty={
          search ? (
            <Empty title={t('categories.noSearchResults')} />
          ) : (
            <Empty title={t('categories.empty')} description={t('categories.emptyDescription')} />
          )
        }
      />
    </div>
  )
}
