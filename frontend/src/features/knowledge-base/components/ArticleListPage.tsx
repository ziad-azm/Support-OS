import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'

import { useDeleteArticle } from '../api/useArticleMutations'
import { useArticles } from '../api/useArticles'
import type { Article } from '../types/article'

export function ArticleListPage() {
  const { t } = useTranslation('knowledgeBase')
  const { date } = useFormatters()
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'created_at', direction: 'desc' },
  })

  const query = useArticles(params)
  const deleteMutation = useDeleteArticle()

  async function handleDelete(article: Article) {
    const confirmed = await confirm({
      title: t('articles.manage.delete.title'),
      description: t('articles.manage.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(article.id)
  }

  const columns: readonly ColumnDef<Article>[] = [
    {
      id: 'title_en',
      header: t('articles.manage.fields.titleEn'),
      sortable: true,
      cell: (row) => (
        <Link to={`/knowledge-base/articles/manage/${row.id}/edit`}>{row.title_en}</Link>
      ),
    },
    {
      id: 'category_name',
      header: t('articles.manage.fields.category'),
      cell: (row) => row.category_name ?? '—',
    },
    {
      id: 'status',
      header: t('articles.manage.fields.status'),
      sortable: true,
      cell: (row) => (
        <Badge variant={row.status === 'published' ? 'default' : 'secondary'}>
          {t(`articles.manage.statuses.${row.status}`)}
        </Badge>
      ),
    },
    {
      id: 'created_at',
      header: t('articles.manage.fields.createdAt'),
      sortable: true,
      cell: (row) => date(row.created_at),
    },
    {
      id: 'actions',
      header: t('articles.manage.fields.actions'),
      cell: (row) => (
        <Button size="sm" variant="ghost" onClick={() => void handleDelete(row)}>
          {t('articles.manage.actions.delete')}
        </Button>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('articles.manage.title')}</h1>
        <Button asChild>
          <Link to="/knowledge-base/articles/manage/new">{t('articles.manage.new')}</Link>
        </Button>
      </div>
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('articles.manage.title')}
        empty={
          <Empty
            title={t('articles.manage.empty')}
            description={t('articles.manage.emptyDescription')}
          />
        }
      />
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link to="/knowledge-base/articles">{t('articles.title')}</Link>
      </Button>
    </div>
  )
}
