import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'

import { useSuggestTicketSolutions } from '../api/useTicketMutations'
import type { TicketSolutionSuggestions } from '../types/ticketSolutionSuggestions'

export function SuggestedSolutionsPanel({ ticketId }: { ticketId: number }) {
  const { t, i18n } = useTranslation('tickets')
  const isArabic = i18n.language.startsWith('ar')

  const [suggestions, setSuggestions] = useState<TicketSolutionSuggestions | null>(null)
  const mutation = useSuggestTicketSolutions(ticketId)

  function handleSuggest() {
    mutation.mutate(undefined, {
      onSuccess: (data) => setSuggestions(data),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('solutions.title')}</h2>
        </CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={handleSuggest}
          >
            {t('solutions.actions.suggest')}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {suggestions === null ? (
          <p className="text-sm text-muted-foreground">{t('solutions.empty')}</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t('solutions.query', { query: suggestions.query })}
            </p>
            {suggestions.results.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('solutions.noMatches')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {suggestions.results.map((result) => (
                  <li key={`${result.kind}-${result.id}`} className="rounded-md border p-3">
                    {result.kind === 'faq' ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{result.question}</span>
                          <Badge variant="secondary">{t('solutions.kinds.faq')}</Badge>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                          {result.answer}
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/knowledge-base/articles/${result.id}`}
                          className="font-medium hover:underline"
                        >
                          {isArabic ? result.title_ar : result.title_en}
                        </Link>
                        <Badge variant="secondary">{t('solutions.kinds.article')}</Badge>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
