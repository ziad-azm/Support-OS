import { useTranslation } from 'react-i18next'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { useTicketSla } from '../api/useTicketSla'
import type { SlaDimensionStatus } from '../types/ticketSla'

function badgeVariant(status: SlaDimensionStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'met') return 'default'
  if (status === 'breached') return 'destructive'
  return 'secondary'
}

/**
 * SLA-1 — this ticket's response/resolution status, computed on read.
 * `null` (no policy configured for this priority/category) renders a
 * plain message, not an error. See Story 28 `## Prerequisites`.
 */
export function TicketSlaSection({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const { dateTime } = useFormatters()
  const query = useTicketSla(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('sla.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary query={query}>
          {(sla) =>
            sla === null ? (
              <p className="text-sm text-muted-foreground">{t('sla.noPolicy')}</p>
            ) : (
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">{t('sla.response')}</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(sla.response_status)}>
                      {t(`sla.statuses.${sla.response_status}`)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {dateTime(sla.response_due_at)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">{t('sla.resolution')}</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariant(sla.resolution_status)}>
                      {t(`sla.statuses.${sla.resolution_status}`)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {dateTime(sla.resolution_due_at)}
                    </span>
                  </dd>
                </div>
              </dl>
            )
          }
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}
