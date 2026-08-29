import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useFaqs } from '../api/useFaqs'
import type { Faq } from '../types/faq'

export function FaqBrowsePage() {
  const { t } = useTranslation('knowledgeBase')
  // Single page, ordered for reading. `page_size: 100` (this project's
  // `DRF_MAX_PAGE_SIZE` default) — real search/ranking is KB-3's job; this
  // screen is a fixed-size read, not a paginated table. See Story 39
  // `## Edge Cases`.
  const query = useFaqs({ page: 1, page_size: 100, ordering: 'order' })

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/knowledge-base/articles">{t('articles.title')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/knowledge-base/search">{t('search.title')}</Link>
            </Button>
            <Can permission="knowledge_base.manage">
              <Button asChild variant="outline" size="sm">
                <Link to="/knowledge-base/manage">{t('manage.title')}</Link>
              </Button>
            </Can>
          </div>
        }
      />
      <QueryBoundary
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={<Empty title={t('browse.empty')} description={t('browse.emptyDescription')} />}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((faq: Faq) => (
              <Card key={faq.id}>
                <CardHeader>
                  <CardTitle>{faq.question}</CardTitle>
                </CardHeader>
                <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {faq.answer}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
