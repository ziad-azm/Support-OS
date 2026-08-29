import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { Empty } from '@/shared/ui/Empty'

import { usePortalFaqs } from '../api/usePortalFaqs'
import type { PortalFaq } from '../types/portalFaq'

/**
 * FAQ browse — PORTAL-4. Shape copied from the staff `FaqBrowsePage`
 * (features/knowledge-base/components/FaqBrowsePage.tsx), minus the
 * `Can permission="knowledge_base.manage"` "Manage" link (a customer never
 * holds that permission) and the "Search" nav button (KB-3 search is out
 * of scope — see Story 46 `## Story Goal`).
 */
export function PortalFaqPage() {
  const { t } = useTranslation('portal')
  // Single page, ordered for reading — same fixed-size-read simplification
  // FaqBrowsePage itself accepted (real search/ranking is KB-3's job).
  const query = usePortalFaqs({ page: 1, page_size: 100, ordering: 'order' })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">{t('faqs.title')}</h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/portal/articles">{t('articles.title')}</Link>
        </Button>
      </div>
      <QueryBoundary
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={<Empty title={t('faqs.empty')} description={t('faqs.emptyDescription')} />}
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            {data.items.map((faq: PortalFaq) => (
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
