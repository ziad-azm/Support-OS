import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useDuplicateCandidates } from '../api/useDuplicateCandidates'
import { useInternalNotes } from '../api/useInternalNotes'
import { useMessages } from '../api/useMessages'
import { useMergeTicket } from '../api/useTicketMutations'
import { ticketPriorityVariant, ticketStatusVariant } from '../lib/statusBadge'
import type { DuplicateCandidate } from '../types/duplicateCandidate'

/**
 * "Possible duplicates" — TKT-9 task 2/3. Read-only suggestions plus a
 * "Merge" action per row; the confirm step itself is the SHARED
 * `useConfirm()` dialog (no new Dialog component — see Story 109
 * `## Product rules`). Rendered only under `tickets.manage`: a caller who
 * could not act on a merge gains nothing from seeing the list, the same
 * "entire feature invisible, not merely disabled" reasoning
 * `TicketBulkActionBar` already established (Story 106). Gating is done
 * at the `TicketDetailPage` call site (Frontend Task 6), not inside this
 * component, matching that same precedent.
 */
export function TicketDuplicateCandidatesSection({ ticketId }: { ticketId: number }) {
  const { t } = useTranslation('tickets')
  const query = useDuplicateCandidates(ticketId)

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild className="text-lg">
          <h2>{t('merge.sectionTitle')}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <QueryBoundary
          query={query}
          isEmpty={(candidates) => candidates.length === 0}
          empty={<p className="text-sm text-muted-foreground">{t('merge.empty')}</p>}
        >
          {(candidates) => (
            <ul className="flex flex-col gap-2">
              {candidates.map((candidate) => (
                <CandidateRow key={candidate.id} ticketId={ticketId} candidate={candidate} />
              ))}
            </ul>
          )}
        </QueryBoundary>
      </CardContent>
    </Card>
  )
}

function CandidateRow({
  ticketId,
  candidate,
}: {
  ticketId: number
  candidate: DuplicateCandidate
}) {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  // Same query keys TicketConversation/InternalNotesSection already use
  // for this ticketId — React Query dedupes by key, so this reuses their
  // cached fetch rather than issuing a second request. See Story 109
  // `## Context`, item 17.
  const messagesQuery = useMessages(ticketId)
  const notesQuery = useInternalNotes(ticketId)
  const mergeMutation = useMergeTicket(ticketId)

  async function handleMerge() {
    const messageCount = messagesQuery.data?.pagination.count ?? 0
    const noteCount = notesQuery.data?.pagination.count ?? 0
    const confirmed = await confirm({
      title: t('merge.confirmTitle', { id: candidate.id, subject: candidate.subject }),
      description: t('merge.confirmDescription', {
        messageCount,
        noteCount,
        id: candidate.id,
      }),
      destructive: true,
    })
    if (!confirmed) return
    mergeMutation.mutate(candidate.id, {
      onSuccess: () => toast({ tone: 'success', message: t('merge.merged') }),
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
      <div className="flex flex-col gap-1">
        <Link to={`/tickets/${candidate.id}`} className="font-medium hover:underline">
          {candidate.subject}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={ticketStatusVariant(candidate.status)}>
            {t(`statuses.${candidate.status}`)}
          </Badge>
          <Badge variant={ticketPriorityVariant(candidate.priority)}>
            {t(`priorities.${candidate.priority}`)}
          </Badge>
          <span>{date(candidate.created_at)}</span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mergeMutation.isPending}
        onClick={() => void handleMerge()}
      >
        {t('merge.action')}
      </Button>
    </li>
  )
}
