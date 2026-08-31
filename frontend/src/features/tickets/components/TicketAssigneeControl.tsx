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
}: {
  ticketId: number
  assignedAgent: number | null
}) {
  const { t } = useTranslation('tickets')
  const { toast } = useToast()
  const agentsQuery = useAssignableAgents()
  const mutation = useAssignTicket(ticketId)

  const selectedAgentLabel =
    assignedAgent === null
      ? t('fields.unassigned')
      : ((agentsQuery.data ?? []).find((agent) => agent.id === assignedAgent)?.name ?? undefined)

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
        {(agentsQuery.data ?? []).map((agent) => (
          <SelectItem key={agent.id} value={String(agent.id)}>
            {agent.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
