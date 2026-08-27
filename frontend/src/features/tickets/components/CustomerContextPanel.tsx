import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { useTicketContext } from '../api/useTicketContext'
import { ticketContextEntryKey } from '../types/ticketContext'
import type {
  TicketContextEntry,
  TicketContextMessageEntry,
  TicketContextTicketEntry,
} from '../types/ticketContext'

/**
 * AGENT-2 — the customer behind this ticket, plus their recent activity
 * elsewhere, shown beside the ticket detail screen so an agent never has
 * to leave it for context. Read-only: editing the customer still goes
 * through `/customers/<id>/edit`. See Story 26 `## Prerequisites`.
 */
export function CustomerContextPanel({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useTicketContext(ticketId)

  return (
    <QueryBoundary query={query}>
      {(context) => (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('context.customerTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Link
                to={`/customers/${context.customer.id}`}
                className="font-medium hover:underline"
              >
                {context.customer.name}
              </Link>
              <dl className="flex flex-col gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t('context.email')}</dt>
                  <dd>{context.customer.email ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('context.phone')}</dt>
                  <dd>{context.customer.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('context.company')}</dt>
                  <dd>{context.customer.company || '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('context.historyTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {context.recent_history.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('context.historyEmpty')}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {context.recent_history.map((entry) => (
                    <ContextEntryRow key={ticketContextEntryKey(entry)} entry={entry} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </QueryBoundary>
  )
}

function ContextEntryRow({ entry }: { entry: TicketContextEntry }) {
  return entry.kind === 'ticket' ? (
    <ContextTicketRow entry={entry} />
  ) : (
    <ContextMessageRow entry={entry} />
  )
}

function ContextTicketRow({ entry }: { entry: TicketContextTicketEntry }) {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-2 text-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">{t(`statuses.${entry.status}`)}</Badge>
        <span>{date(entry.occurred_at)}</span>
      </div>
      <Link to={`/tickets/${entry.ticket_id}`} className="hover:underline">
        {entry.subject}
      </Link>
    </li>
  )
}

function ContextMessageRow({ entry }: { entry: TicketContextMessageEntry }) {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={entry.direction === 'outbound' ? 'default' : 'secondary'}>
          {t(`conversation.directions.${entry.direction}`)}
        </Badge>
        <Link to={`/tickets/${entry.ticket_id}`} className="hover:underline">
          {t('context.onTicket', { id: entry.ticket_id })}
        </Link>
        <span>{date(entry.occurred_at)}</span>
      </div>
      {/* No forced `dir="ltr"` — same reasoning every other message body
          render in this feature uses: free-form prose that may itself be
          Arabic. `line-clamp-2` (already used, `shared/ui/primitives
          /alert.tsx`) keeps a long reply from dominating the narrow panel. */}
      <p className="line-clamp-2 whitespace-pre-wrap">{entry.body}</p>
    </li>
  )
}
