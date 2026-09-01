import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch'
import { useDeleteFaq } from '../api/useFaqMutations'
import { useFaqs } from '../api/useFaqs'
import type { Faq } from '../types/faq'

export function FaqListPage() {
  const { t } = useTranslation('knowledgeBase')
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'order', direction: 'asc' },
  })
  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useFaqs({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteFaq()

  async function handleDelete(faq: Faq) {
    const confirmed = await confirm({
      title: t('manage.delete.title'),
      description: t('manage.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(faq.id)
  }

  const columns: readonly ColumnDef<Faq>[] = [
    {
      id: 'question',
      header: t('manage.fields.question'),
      sortable: true,
      cell: (row) => <Link to={`/knowledge-base/manage/${row.id}/edit`}>{row.question}</Link>,
    },
    {
      id: 'order',
      header: t('manage.fields.order'),
      sortable: true,
      align: 'end',
      cell: (row) => row.order,
    },
    {
      id: 'actions',
      header: t('manage.fields.actions'),
      cell: (row) => (
        <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
          {t('manage.actions.delete')}
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('manage.title')}
        action={
          <Button asChild>
            <Link to="/knowledge-base/manage/new">
              <PlusIcon />
              {t('manage.new')}
            </Link>
          </Button>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('manage.searchPlaceholder')}
        aria-label={t('manage.search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('manage.title')}
        empty={
          search ? (
            <Empty title={t('manage.noSearchResults')} />
          ) : (
            <Empty title={t('manage.empty')} description={t('manage.emptyDescription')} />
          )
        }
      />
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/knowledge-base">{t('title')}</Link>
      </Button>
    </div>
  )
}
