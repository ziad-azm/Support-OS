import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'

import { Can } from '@/shared/auth'
import { useFormatters } from '@/shared/hooks/useFormatters'
import { Badge } from '@/shared/ui/primitives/badge'
import { Button } from '@/shared/ui/primitives/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'
import { QueryBoundary } from '@/shared/ui/QueryBoundary'
import { useToast } from '@/shared/ui/toast/useToast'

import { useDeleteTicket, useEscalateTicket } from '../api/useTicketMutations'
import { useTicket } from '../api/useTicket'
import { TicketAssigneeControl } from './TicketAssigneeControl'
import { TicketConversation } from './TicketConversation'
import { TicketStatusControl } from './TicketStatusControl'

export function TicketDetailPage() {
  const { t } = useTranslation('tickets')
  const { date } = useFormatters()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const isValidId = !Number.isNaN(id)

  // Hooks stay unconditional across renders; `enabled` is what actually
  // stops the request for a non-numeric id — a hand-typed URL can produce
  // one even though `tickets/new` is declared before `tickets/:id`.
  const query = useTicket(id, { enabled: isValidId })
  const deleteMutation = useDeleteTicket()
  const escalateMutation = useEscalateTicket(id)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('delete.title'),
      description: t('delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(id)
    navigate('/tickets')
  }

  async function handleToggleEscalation(currentlyEscalated: boolean) {
    const confirmed = await confirm({
      title: t(
        currentlyEscalated
          ? 'escalation.deEscalateConfirmTitle'
          : 'escalation.escalateConfirmTitle',
      ),
      description: t(
        currentlyEscalated
          ? 'escalation.deEscalateConfirmDescription'
          : 'escalation.escalateConfirmDescription',
      ),
    })
    if (!confirmed) return
    escalateMutation.mutate(!currentlyEscalated, {
      onSuccess: () => toast({ tone: 'success', message: t('escalation.updated') }),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/tickets" className="text-sm text-muted-foreground hover:underline">
        {t('actions.backToList')}
      </Link>
      {isValidId ? (
        <QueryBoundary query={query}>
          {(ticket) => (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{ticket.subject}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.customer')}</dt>
                      <dd>
                        <Link to={`/customers/${ticket.customer}`} className="hover:underline">
                          {ticket.customer_name}
                        </Link>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.category')}</dt>
                      <dd>{ticket.category_name ?? t('fields.noCategory')}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.assignedAgent')}</dt>
                      <dd>
                        {/* Everyone with `tickets.view` sees WHO owns the
                            ticket; only `tickets.manage` can change it —
                            the same split the edit/delete buttons below
                            already use. */}
                        <Can
                          permission="tickets.manage"
                          fallback={ticket.assigned_agent_name ?? t('fields.unassigned')}
                        >
                          <TicketAssigneeControl
                            ticketId={ticket.id}
                            assignedAgent={ticket.assigned_agent}
                          />
                        </Can>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.status')}</dt>
                      <dd>
                        <Can
                          permission="tickets.manage"
                          fallback={
                            <Badge variant="secondary">{t(`statuses.${ticket.status}`)}</Badge>
                          }
                        >
                          <TicketStatusControl ticketId={ticket.id} status={ticket.status} />
                        </Can>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.escalation')}</dt>
                      <dd className="flex items-center gap-2">
                        {ticket.escalated ? (
                          <Badge variant="destructive">{t('escalation.escalated')}</Badge>
                        ) : (
                          <Badge variant="secondary">{t('escalation.notEscalated')}</Badge>
                        )}
                        <Can permission="tickets.manage">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={escalateMutation.isPending}
                            onClick={() => void handleToggleEscalation(ticket.escalated)}
                          >
                            {t(ticket.escalated ? 'escalation.deEscalate' : 'escalation.escalate')}
                          </Button>
                        </Can>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.priority')}</dt>
                      <dd>
                        <Badge variant="secondary">{t(`priorities.${ticket.priority}`)}</Badge>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.createdAt')}</dt>
                      <dd>{date(ticket.created_at)}</dd>
                    </div>
                  </dl>
                  <div>
                    <p className="text-sm text-muted-foreground">{t('fields.description')}</p>
                    <p className="whitespace-pre-wrap">{ticket.description}</p>
                  </div>
                  <Can permission="tickets.manage">
                    <div className="flex gap-2">
                      <Button asChild variant="outline">
                        <Link to={`/tickets/${ticket.id}/edit`}>{t('edit')}</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => void handleDelete()}
                      >
                        {t('actions.delete')}
                      </Button>
                    </div>
                  </Can>
                </CardContent>
              </Card>
              <TicketConversation ticketId={ticket.id} />
            </>
          )}
        </QueryBoundary>
      ) : (
        <Empty title={t('notFound')} />
      )}
    </div>
  )
}
