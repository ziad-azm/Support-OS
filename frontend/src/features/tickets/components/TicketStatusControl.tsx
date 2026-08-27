import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { useToast } from '@/shared/ui/toast/useToast'

import { useSetTicketStatus } from '../api/useTicketMutations'
import { TICKET_STATUS_TRANSITIONS } from '../types/ticket'
import type { TicketStatus } from '../types/ticket'

/**
 * A plain `Select` driving a mutation directly, exactly like
 * `TicketAssigneeControl` (Story 22) — no confirm dialog; only the escalate
 * action uses one (`## Prerequisites`). Options are the current status plus
 * whatever `TICKET_STATUS_TRANSITIONS` allows from it, so the picker cannot
 * offer an illegal transition — the backend still re-validates via
 * `apps/tickets/status.py::is_valid_transition` against a hand-crafted
 * request. Rendered only inside `<Can permission="tickets.manage">`.
 */
export function TicketStatusControl({
  ticketId,
  status,
}: {
  ticketId: number
  status: TicketStatus
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const mutation = useSetTicketStatus(ticketId)

  const options: readonly TicketStatus[] = [status, ...TICKET_STATUS_TRANSITIONS[status]]

  function onValueChange(next: string) {
    if (next === status) return
    mutation.mutate(next as TicketStatus, {
      onSuccess: () => toast({ tone: 'success', message: t('status.updated') }),
      // A failure is already toasted by the shared mutation error handler
      // — CONVENTIONS.md §21.
    })
  }

  return (
    <Select value={status} onValueChange={onValueChange} disabled={mutation.isPending}>
      <SelectTrigger aria-label={t('fields.status')} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((value) => (
          <SelectItem key={value} value={value}>
            {t(`statuses.${value}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
