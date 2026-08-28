import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { Badge } from '@/shared/ui/primitives/badge'
import { Empty } from '@/shared/ui/Empty'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { MarkdownPreview } from './MarkdownPreview'
import { useArticle } from '../api/useArticle'

export function ArticleReaderPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const { t } = useTranslation('knowledgeBase')

  // Guard `Number.isNaN` before firing the query — the same rule
  // `CustomerProfilePage` established (Story 10): a hand-typed or stale URL
  // must not request `/articles/NaN/`.
  if (Number.isNaN(id)) {
    return <Empty title={t('articles.reader.notFound')} />
  }

  return <ArticleReaderContent id={id} />
}

function ArticleReaderContent({ id }: { id: number }) {
  const { t, i18n } = useTranslation('knowledgeBase')
  const isArabic = i18n.language.startsWith('ar')
  const query = useArticle(id)

  return (
    <QueryBoundary query={query}>
      {(article) => (
        <div className="flex flex-col gap-4">
          <Link to="/knowledge-base/articles">{t('articles.reader.backToList')}</Link>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">
              {isArabic ? article.title_ar : article.title_en}
            </h1>
            {article.status !== 'published' ? (
              <Badge variant="outline">{t('articles.manage.statuses.draft')}</Badge>
            ) : null}
          </div>
          <MarkdownPreview>{isArabic ? article.body_ar : article.body_en}</MarkdownPreview>
        </div>
      )}
    </QueryBoundary>
  )
}
