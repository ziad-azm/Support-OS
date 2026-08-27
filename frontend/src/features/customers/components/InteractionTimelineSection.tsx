import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { useCustomerTimeline } from '../api/useCustomerTimeline'
import { timelineEntryKey } from '../types/timelineEntry'
import type {
  TimelineEntry,
  TimelineMessageEntry,
  TimelineTicketEntry,
} from '../types/timelineEntry'

/**
 * The customer's interaction history — CUST-3. A `<ul>`, not a `DataTable`:
 * `DataTable` is for one homogeneous, server-sortable row type, and this is
 * a heterogeneous unpaginated feed of two shapes. `ContactDetailsSection`'s
 * own `<ul>` is the in-project precedent. See Story 20 `## Product rules`.
 */
export function InteractionTimelineSection({ customerId }: { customerId: number }) {
  const { t } = useTranslation('customers')
  const query = useCustomerTimeline(customerId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('timeline.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          query={query}
          isEmpty={(entries) => entries.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('timeline.empty')}</p>}
        >
          {(entries) => (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <TimelineRow key={timelineEntryKey(entry)} entry={entry} />
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  return entry.kind === 'ticket' ? <TicketRow entry={entry} /> : <MessageRow entry={entry} />
}

function TicketRow({ entry }: { entry: TimelineTicketEntry }) {
  const { t } = useTranslation('customers')
  const { dateTime } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge>{t('timeline.kinds.ticket')}</Badge>
        <Badge variant="secondary">{t(`timeline.statuses.${entry.status}`)}</Badge>
        {entry.category_name ? <Badge variant="outline">{entry.category_name}</Badge> : null}
        <span>{dateTime(entry.occurred_at)}</span>
      </div>
      <Link to={`/tickets/${entry.ticket_id}`} className="hover:underline">
        {entry.subject}
      </Link>
    </li>
  )
}

function MessageRow({ entry }: { entry: TimelineMessageEntry }) {
  const { t } = useTranslation('customers')
  const { dateTime } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={entry.direction === 'outbound' ? 'default' : 'secondary'}>
          {t(`timeline.directions.${entry.direction}`)}
        </Badge>
        <Badge variant="outline">{t(`timeline.channels.${entry.channel}`)}</Badge>
        <Link to={`/tickets/${entry.ticket_id}`} className="hover:underline">
          {t('timeline.onTicket', { id: entry.ticket_id })}
        </Link>
        <span>{dateTime(entry.occurred_at)}</span>
      </div>
      {/* No forced `dir="ltr"` — a message body is free-form prose that may
          itself be Arabic, the same call `TicketConversation.tsx` made
          (Story 13). Contrast `ContactDetailRow`'s Latin-only value. */}
      <p className="whitespace-pre-wrap">{entry.body}</p>
    </li>
  )
}
