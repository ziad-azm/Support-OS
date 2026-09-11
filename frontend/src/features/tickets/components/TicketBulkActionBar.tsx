import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/shared/auth'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { SelectionActionBar } from '@/shared/ui/data-table/SelectionActionBar'
import { useToast } from '@/shared/ui/toast/useToast'

import { useAssignableAgents } from '../api/useAssignableAgents'
import {
  useBulkAssignTickets,
  useBulkSetTicketPriority,
  useBulkSetTicketStatus,
} from '../api/useTicketMutations'
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../types/ticket'
import type { BulkActionResultRow } from '../types/bulkActionResult'
import type { TicketPriority, TicketStatus } from '../types/ticket'

const UNASSIGNED = 'unassigned'

/**
 * The ticket-specific content rendered inside the shared
 * `SelectionActionBar` — three `Select`s (assign / status / priority),
 * each an immediate-mutation control gated by `useConfirm()` before it
 * fires, mirroring `TicketAssigneeControl`/`TicketStatusControl`'s shape
 * scaled from one ticket to N. Rendered only under `tickets.manage`
 * (checked here AND at the `TicketListPage` call site that decides
 * whether `DataTable` even offers checkboxes — see Story 106 Frontend
 * Task 7).
 */
export function TicketBulkActionBar({
  selectedIds,
  onDone,
}: {
  selectedIds: ReadonlySet<string>
  onDone: () => void
}) {
  const { t } = useTranslation('tickets')
  const { can } = useAuth()
  const { toast } = useToast()
  const { confirm } = useConfirm()
  const agentsQuery = useAssignableAgents()
  const assignMutation = useBulkAssignTickets()
  const statusMutation = useBulkSetTicketStatus()
  const priorityMutation = useBulkSetTicketPriority()
  const [lastFailures, setLastFailures] = useState<BulkActionResultRow[]>([])

  if (!can('tickets.manage')) return null

  const ticketIds = Array.from(selectedIds, Number)
  const isPending =
    assignMutation.isPending || statusMutation.isPending || priorityMutation.isPending

  function report(results: BulkActionResultRow[]) {
    const failures = results.filter((row) => !row.ok)
    setLastFailures(failures)
    if (failures.length === 0) {
      toast({ tone: 'success', message: t('bulk.allSucceeded', { count: results.length }) })
    } else if (failures.length === results.length) {
      toast({ tone: 'error', message: t('bulk.allFailed', { count: results.length }) })
    } else {
      toast({
        tone: 'error',
        message: t('bulk.partialSuccess', {
          okCount: results.length - failures.length,
          total: results.length,
        }),
      })
    }
    onDone()
  }

  async function handleAssign(value: string) {
    const agent = value === UNASSIGNED ? null : Number(value)
    const agentName =
      value === UNASSIGNED
        ? t('fields.unassigned')
        : ((agentsQuery.data ?? []).find((candidate) => candidate.id === agent)?.name ?? '')
    const confirmed = await confirm({
      title: t('bulk.assignConfirmTitle', { count: ticketIds.length, agent: agentName }),
      description: t('bulk.confirmDescription'),
    })
    if (!confirmed) return
    assignMutation.mutate(
      { ticketIds, assignedAgent: agent },
      { onSuccess: (data) => report(data.results) },
    )
  }

  async function handleStatus(value: string) {
    const status = value as TicketStatus
    const confirmed = await confirm({
      title: t('bulk.statusConfirmTitle', {
        count: ticketIds.length,
        status: t(`statuses.${status}`),
      }),
      description: t('bulk.confirmDescription'),
      // Same "terminal state" signal TicketStatusControl already uses for
      // one ticket — closed has no further transitions, so this reserves
      // the destructive styling for the one status change that is
      // effectively irreversible from the list itself.
      destructive: status === 'closed',
    })
    if (!confirmed) return
    statusMutation.mutate({ ticketIds, status }, { onSuccess: (data) => report(data.results) })
  }

  async function handlePriority(value: string) {
    const priority = value as TicketPriority
    const confirmed = await confirm({
      title: t('bulk.priorityConfirmTitle', {
        count: ticketIds.length,
        priority: t(`priorities.${priority}`),
      }),
      description: t('bulk.confirmDescription'),
    })
    if (!confirmed) return
    priorityMutation.mutate({ ticketIds, priority }, { onSuccess: (data) => report(data.results) })
  }

  return (
    <SelectionActionBar count={selectedIds.size} onClear={onDone}>
      <Select onValueChange={(value) => void handleAssign(value)} disabled={isPending}>
        <SelectTrigger aria-label={t('bulk.assignLabel')} size="sm">
          <SelectValue placeholder={t('bulk.assignLabel')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNASSIGNED}>{t('fields.unassigned')}</SelectItem>
          {(agentsQuery.data ?? []).map((agent) => (
            <SelectItem key={agent.id} value={String(agent.id)}>
              {agent.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select onValueChange={(value) => void handleStatus(value)} disabled={isPending}>
        <SelectTrigger aria-label={t('bulk.statusLabel')} size="sm">
          <SelectValue placeholder={t('bulk.statusLabel')} />
        </SelectTrigger>
        <SelectContent>
          {TICKET_STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`statuses.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select onValueChange={(value) => void handlePriority(value)} disabled={isPending}>
        <SelectTrigger aria-label={t('bulk.priorityLabel')} size="sm">
          <SelectValue placeholder={t('bulk.priorityLabel')} />
        </SelectTrigger>
        <SelectContent>
          {TICKET_PRIORITIES.map((value) => (
            <SelectItem key={value} value={value}>
              {t(`priorities.${value}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {lastFailures.length > 0 ? (
        <ul className="basis-full text-sm text-destructive">
          {lastFailures.map((row) => (
            <li key={row.id}>{t('bulk.failureDetail', { id: row.id, error: row.error })}</li>
          ))}
        </ul>
      ) : null}
    </SelectionActionBar>
  )
}
