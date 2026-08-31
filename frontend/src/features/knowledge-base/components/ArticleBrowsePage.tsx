import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useArticles } from '../api/useArticles'
import type { Article } from '../types/article'

export function ArticleBrowsePage() {
  const { t, i18n } = useTranslation('knowledgeBase')
  const isArabic = i18n.language.startsWith('ar')
  // Single page, ordered newest-first. `page_size: 100` (this project's
  // `DRF_MAX_PAGE_SIZE` default) — real search/ranking is KB-3's job; this
  // screen lists titles only (the body is too long to browse inline), so a
  // fixed-size read is the same simplification `FaqBrowsePage` accepted.
  const query = useArticles({ page: 1, page_size: 100, ordering: '-created_at' })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('articles.title')}
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/knowledge-base">{t('title')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/knowledge-base/search">{t('search.title')}</Link>
            </Button>
            <Can permission="knowledge_base.manage">
              <Button asChild variant="outline" size="sm">
                <Link to="/knowledge-base/articles/manage">{t('articles.manage.title')}</Link>
              </Button>
            </Can>
          </div>
        }
      />
      <QueryBoundary
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <Empty
            title={t('articles.browse.empty')}
            description={t('articles.browse.emptyDescription')}
          />
        }
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((article: Article) => (
              <Card key={article.id}>
                <CardHeader>
                  <CardTitle>
                    <Link to={`/knowledge-base/articles/${article.id}`}>
                      {isArabic ? article.title_ar : article.title_en}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {article.category_name ? (
                      <Badge variant="secondary">{article.category_name}</Badge>
                    ) : null}
                    {article.status !== 'published' ? (
                      <Badge variant="outline">{t('articles.manage.statuses.draft')}</Badge>
                    ) : null}
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
