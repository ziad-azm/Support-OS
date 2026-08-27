import { useTranslation } from 'react-i18next'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'

import { useTicketHistory } from '../api/useTicketHistory'
import { ticketHistoryEntryKey } from '../types/ticketHistoryEntry'
import type {
  TicketHistoryActivityEntry,
  TicketHistoryEntry,
  TicketHistoryMessageEntry,
} from '../types/ticketHistoryEntry'
import type { TicketStatus } from '../types/ticket'

/**
 * A ticket's audit trail — TKT-5. A `<ul>`, not a `DataTable`: the same
 * heterogeneous-feed reasoning `InteractionTimelineSection` (Story 20)
 * documents. Replies appear here too, alongside status/assignment changes
 * — not a duplicate of `TicketConversation`'s own reply thread, but a
 * lightweight chronological log next to it, the same relationship
 * `InteractionTimelineSection`'s ticket rows have to `/tickets` itself.
 */
export function TicketHistorySection({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useTicketHistory(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t('history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          query={query}
          isEmpty={(entries) => entries.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('history.empty')}</p>}
        >
          {(entries) => (
            <ul className="flex flex-col gap-2">
              {entries.map((entry) => (
                <HistoryRow key={ticketHistoryEntryKey(entry)} entry={entry} />
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}

function HistoryRow({ entry }: { entry: TicketHistoryEntry }) {
  return entry.kind === 'activity' ? <ActivityRow entry={entry} /> : <MessageRow entry={entry} />
}

function ActivityRow({ entry }: { entry: TicketHistoryActivityEntry }) {
  const { t } = useTranslation('tickets')
  const { dateTime } = useFormatters()

  // `status_changed` values are `TicketStatus`es, translated the same way
  // every other status display in this app is — the backend guarantees
  // `from_value`/`to_value` are real `Ticket.Status` values for this kind,
  // so the cast is safe (the API type itself stays a plain `string`; see
  // `types/ticketHistoryEntry.ts`). `assigned` values are already-resolved
  // name snapshots — rendered as-is, blank meaning unassigned, the same
  // fallback `fields.unassigned` provides elsewhere. See Story 24
  // `## Prerequisites`.
  const from =
    entry.activity_kind === 'status_changed'
      ? t(`statuses.${entry.from_value as TicketStatus}`)
      : entry.from_value || t('fields.unassigned')
  const to =
    entry.activity_kind === 'status_changed'
      ? t(`statuses.${entry.to_value as TicketStatus}`)
      : entry.to_value || t('fields.unassigned')

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">{t(`history.kinds.${entry.activity_kind}`)}</Badge>
        <span>{dateTime(entry.occurred_at)}</span>
      </div>
      <p>
        {t(
          entry.activity_kind === 'status_changed'
            ? 'history.statusChanged'
            : 'history.assigneeChanged',
          { from, to },
        )}
        {entry.actor_name ? ` ${t('history.by', { actor: entry.actor_name })}` : null}
      </p>
    </li>
  )
}

function MessageRow({ entry }: { entry: TicketHistoryMessageEntry }) {
  const { t } = useTranslation('tickets')
  const { dateTime } = useFormatters()

  return (
    <li className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant={entry.direction === 'outbound' ? 'default' : 'secondary'}>
          {t(`conversation.directions.${entry.direction}`)}
        </Badge>
        <Badge variant="outline">{t(`conversation.channels.${entry.channel}`)}</Badge>
        <span>{dateTime(entry.occurred_at)}</span>
      </div>
      {/* No forced `dir="ltr"` — same reasoning `TicketConversation`'s own
          `MessageRow` uses: a message body is free-form prose that may
          itself be Arabic. */}
      <p className="whitespace-pre-wrap">{entry.body}</p>
    </li>
  )
}
