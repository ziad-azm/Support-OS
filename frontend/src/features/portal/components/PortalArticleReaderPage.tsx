import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'

import { Empty } from '@/shared/ui/Empty'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { PortalMarkdownPreview } from './PortalMarkdownPreview'
import { usePortalArticle } from '../api/usePortalArticle'

/**
 * A single published article — PORTAL-4. Shape copied from the staff
 * `ArticleReaderPage`, minus the draft `Badge` (unreachable — see Story 46
 * `## Explicitly out of scope`).
 */
export function PortalArticleReaderPage() {
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const { t } = useTranslation('portal')

  if (Number.isNaN(id)) {
    return <Empty title={t('articles.notFound')} />
  }

  return <PortalArticleReaderContent id={id} />
}

function PortalArticleReaderContent({ id }: { id: number }) {
  const { t, i18n } = useTranslation('portal')
  const isArabic = i18n.language.startsWith('ar')
  const query = usePortalArticle(id)

  return (
    <QueryBoundary query={query}>
      {(article) => (
        <div className="flex flex-col gap-4">
          <Link to="/portal/articles" className="text-sm text-muted-foreground hover:underline">
            {t('articles.backToList')}
          </Link>
          <h1 className="text-xl font-semibold">
            {isArabic ? article.title_ar : article.title_en}
          </h1>
          <PortalMarkdownPreview>
            {isArabic ? article.body_ar : article.body_en}
          </PortalMarkdownPreview>
        </div>
      )}
    </QueryBoundary>
  )
}
