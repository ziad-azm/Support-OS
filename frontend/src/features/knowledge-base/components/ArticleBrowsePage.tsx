import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useArticles } from '../api/useArticles'
import type { Article } from '../types/article'

export function ArticleBrowsePage() {
  const { t, i18n } = useTranslation('knowledgeBase')
  const isArabic = i18n.language.startsWith('ar')
  const [categoryFilter, setCategoryFilter] = useState('all')
  // Single page, ordered newest-first. `page_size: 100` (this project's
  // `DRF_MAX_PAGE_SIZE` default) — real search/ranking is KB-3's job; this
  // screen lists titles only (the body is too long to browse inline), so a
  // fixed-size read is the same simplification `FaqBrowsePage` accepted.
  const query = useArticles({ page: 1, page_size: 100, ordering: '-created_at' })

  // `UX-037`: filtered client-side over the already-fully-fetched (≤100)
  // list — `ArticleViewSet` has no `filterset_fields`, so a server-side
  // `?category=` filter doesn't exist without a backend change.
  const categories = useMemo(() => {
    const names = new Set<string>()
    for (const article of query.data?.items ?? []) {
      if (article.category_name) names.add(article.category_name)
    }
    return [...names].sort()
  }, [query.data])

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
        {(data) => {
          const items =
            categoryFilter === 'all'
              ? data.items
              : data.items.filter((article: Article) => article.category_name === categoryFilter)
          return (
            <div className="flex flex-col gap-4">
              {categories.length > 0 ? (
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger
                    aria-label={t('articles.browse.filterCategory')}
                    size="sm"
                    className="self-start"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('articles.browse.allCategories')}</SelectItem>
                    {categories.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('articles.browse.noCategoryResults')}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {items.map((article: Article) => (
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
            </div>
          )
        }}
      </QueryBoundary>
    </div>
  )
}
