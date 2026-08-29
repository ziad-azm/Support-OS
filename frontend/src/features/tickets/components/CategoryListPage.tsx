import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Button } from '@/shared/ui/primitives/button'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useDeleteCategory } from '../api/useCategoryMutations'
import { useCategoryList } from '../api/useCategoryList'
import type { Category } from '../types/category'

export function CategoryListPage() {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'name', direction: 'asc' },
  })

  const query = useCategoryList(params)
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
      cell: (row) => <Link to={`/categories/${row.id}/edit`}>{row.name}</Link>,
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
        <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
          {t('categories.actions.delete')}
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('categories.title')}
        action={
          <Button asChild>
            <Link to="/categories/new">
              <PlusIcon />
              {t('categories.new')}
            </Link>
          </Button>
        }
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
          <Empty title={t('categories.empty')} description={t('categories.emptyDescription')} />
        }
      />
    </div>
  )
}
