import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { Input } from '@/shared/ui/primitives/input'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { MarkdownPreview } from './MarkdownPreview'
import { useSearch } from '../api/useSearch'
import type { SearchResult } from '../types/searchResult'

const SEARCH_DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

export function SearchPage() {
  const { t, i18n } = useTranslation('knowledgeBase')
  const isArabic = i18n.language.startsWith('ar')

  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const handle = setTimeout(() => setQuery(input), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [input])

  const searchQuery = useSearch(query)
  const hasEnoughInput = query.trim().length >= MIN_QUERY_LENGTH

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('search.title')} />
      <Input
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={t('search.placeholder')}
        aria-label={t('search.title')}
      />
      {!hasEnoughInput ? (
        <p className="text-sm text-muted-foreground">{t('search.prompt')}</p>
      ) : (
        <QueryBoundary
          query={searchQuery}
          isEmpty={(results) => results.length === 0}
          empty={<Empty title={t('search.empty')} description={t('search.emptyDescription')} />}
        >
          {(results) => (
            <div className="flex flex-col gap-3">
              {results.map((result: SearchResult) =>
                result.kind === 'faq' ? (
                  <Card key={`faq-${result.id}`}>
                    <CardHeader>
                      <CardTitle>{result.question}</CardTitle>
                      <Badge variant="secondary">{t('search.kinds.faq')}</Badge>
                    </CardHeader>
                    <CardContent>
                      <MarkdownPreview>{result.headline || result.answer}</MarkdownPreview>
                    </CardContent>
                  </Card>
                ) : (
                  <Card key={`article-${result.id}`}>
                    <CardHeader>
                      <CardTitle>
                        <Link to={`/knowledge-base/articles/${result.id}`}>
                          {isArabic ? result.title_ar : result.title_en}
                        </Link>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{t('search.kinds.article')}</Badge>
                        {result.status !== 'published' ? (
                          <Badge variant="outline">{t('articles.manage.statuses.draft')}</Badge>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <MarkdownPreview>
                        {(isArabic ? result.headline_ar : result.headline_en) || ''}
                      </MarkdownPreview>
                    </CardContent>
                  </Card>
                ),
              )}
            </div>
          )}
        </QueryBoundary>
      )}
    </div>
  )
}
