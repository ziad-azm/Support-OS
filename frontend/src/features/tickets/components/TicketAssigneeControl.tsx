import { useTranslation } from 'react-i18next'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/primitives/select'
import { useToast } from '@/shared/ui/toast/useToast'

import { useAssignableAgents } from '../api/useAssignableAgents'
import { useAssignTicket } from '../api/useTicketMutations'

// Radix's `Select.Item` requires a non-empty value — this sentinel stands
// in for "unassigned", mirroring `TicketFormPage`'s `CATEGORY_NONE`
// (Story 18) and the list filters' `"all"`. See CONVENTIONS.md §19.
const UNASSIGNED = 'unassigned'

/**
 * A plain `Select` driving a mutation directly — not a `useAppForm` form.
 * §20's "`useAppForm` is the only entry point" governs *forms*; this is a
 * single-control immediate action with no submit step and nothing to
 * validate client-side, the same shape `LanguageSwitcher` and the ticket
 * list's own filters use. Rendered only inside
 * `<Can permission="tickets.manage">` by its caller.
 */
export function TicketAssigneeControl({
  ticketId,
  assignedAgent,
  assignedAgentName,
}: {
  ticketId: number
  assignedAgent: number | null
  // `ticket.assigned_agent_name` — needed as a fallback because the
  // currently-assigned agent can fall out of `useAssignableAgents()`'s
  // pool (deactivated, or lost `tickets.manage`) while still being the
  // ticket's actual assignee. Without it, `assignedAgent`'s id has no
  // matching entry in either `agentsQuery.data` or the rendered
  // `SelectItem` list, so Radix's `SelectValue` renders blank — a
  // `tickets.manage` holder loses visibility into who the ticket was
  // assigned to, while the view-only `<Can>` fallback (which reads this
  // same field directly) still shows the name correctly.
  assignedAgentName: string | null
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const agentsQuery = useAssignableAgents()
  const mutation = useAssignTicket(ticketId)

  const assignedAgentInPool = (agentsQuery.data ?? []).some((agent) => agent.id === assignedAgent)

  const selectedAgentLabel =
    assignedAgent === null
      ? t('fields.unassigned')
      : ((agentsQuery.data ?? []).find((agent) => agent.id === assignedAgent)?.name ??
        assignedAgentName ??
        undefined)

  function onValueChange(next: string) {
    mutation.mutate(next === UNASSIGNED ? null : Number(next), {
      onSuccess: () => toast({ tone: 'success', message: t('assign.updated') }),
      // A failure is already toasted by the shared mutation error handler
      // — CONVENTIONS.md §21.
    })
  }

  return (
    <Select
      value={assignedAgent === null ? UNASSIGNED : String(assignedAgent)}
      onValueChange={onValueChange}
      disabled={mutation.isPending || agentsQuery.isPending}
    >
      <SelectTrigger aria-label={t('assign.label')} title={selectedAgentLabel} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>{t('fields.unassigned')}</SelectItem>
        {assignedAgent !== null && !assignedAgentInPool ? (
          // The current assignee is no longer assignable (deactivated, or
          // lost `tickets.manage`) but is still who the ticket is assigned
          // to — shown so the trigger has a matching item instead of
          // rendering blank. Re-selecting it is a no-op (already assigned);
          // the real actions here are picking someone else or unassigning.
          <SelectItem value={String(assignedAgent)}>
            {assignedAgentName ?? t('fields.unassigned')}
          </SelectItem>
        ) : null}
        {(agentsQuery.data ?? []).map((agent) => (
          <SelectItem key={agent.id} value={String(agent.id)}>
            {agent.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
