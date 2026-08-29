import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { Empty } from '@/shared/ui/Empty'

import { usePortalArticles } from '../api/usePortalArticles'
import type { PortalArticle } from '../types/portalArticle'

/**
 * Article browse — PORTAL-4. Shape copied from the staff `ArticleBrowsePage`
 * (features/knowledge-base/components/ArticleBrowsePage.tsx), minus the
 * "Search" link (out of scope) and the draft `Badge` — unreachable here,
 * `ArticleViewSet.get_queryset` already excludes every draft for a portal
 * caller. See Story 46 `## Explicitly out of scope`.
 */
export function PortalArticleListPage() {
  const { t, i18n } = useTranslation('portal')
  const isArabic = i18n.language.startsWith('ar')
  const query = usePortalArticles({ page: 1, page_size: 100, ordering: '-created_at' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('articles.title')}</h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/portal/faqs">{t('faqs.title')}</Link>
        </Button>
      </div>
      <QueryBoundary
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={<Empty title={t('articles.empty')} description={t('articles.emptyDescription')} />}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((article: PortalArticle) => (
              <Card key={article.id}>
                <CardHeader>
                  <CardTitle>
                    <Link to={`/portal/articles/${article.id}`}>
                      {isArabic ? article.title_ar : article.title_en}
                    </Link>
                  </CardTitle>
                  {article.category_name ? (
                    <Badge variant="secondary">{article.category_name}</Badge>
                  ) : null}
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
