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

import { useCustomer } from '../api/useCustomer'
import {
  useDeleteCustomer,
  useGrantPortalAccess,
  useRevokePortalAccess,
} from '../api/useCustomerMutations'
import { AttachmentsSection } from './AttachmentsSection'
import { ContactDetailsSection } from './ContactDetailsSection'
import { InteractionTimelineSection } from './InteractionTimelineSection'
import { NotesSection } from './NotesSection'

export function CustomerProfilePage() {
  const { t } = useTranslation('customers')
  const { date } = useFormatters()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const { toast } = useToast()
  const { id: idParam } = useParams()
  const id = Number(idParam)
  const isValidId = !Number.isNaN(id)

  // Hooks stay unconditional across renders; `enabled` is what actually
  // stops the request for a non-numeric id — a hand-typed URL can produce
  // one even though `customers/new` is declared before `customers/:id`.
  const query = useCustomer(id, { enabled: isValidId })
  const deleteMutation = useDeleteCustomer()
  const grantMutation = useGrantPortalAccess(id)
  const revokeMutation = useRevokePortalAccess(id)

  async function handleDelete() {
    const confirmed = await confirm({
      title: t('delete.title'),
      description: t('delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(id)
    navigate('/customers')
  }

  function handleGrantPortalAccess() {
    grantMutation.mutate(undefined, {
      onSuccess: () => toast({ tone: 'success', message: t('portalAccess.granted') }),
      // A failure is already toasted by the shared mutation error handler —
      // CONVENTIONS.md §21.
    })
  }

  async function handleRevokePortalAccess() {
    const confirmed = await confirm({
      title: t('portalAccess.revokeConfirm.title'),
      description: t('portalAccess.revokeConfirm.description'),
      destructive: true,
    })
    if (!confirmed) return
    revokeMutation.mutate(undefined, {
      onSuccess: () => toast({ tone: 'success', message: t('portalAccess.revoked') }),
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/customers" className="text-sm text-muted-foreground hover:underline">
        {t('actions.backToList')}
      </Link>
      {isValidId ? (
        <QueryBoundary query={query}>
          {(customer) => (
            <>
              <Card>
                <CardHeader>
                  <CardTitle asChild className="text-lg">
                    <h1>{customer.name}</h1>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.email')}</dt>
                      <dd>{customer.email ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.phone')}</dt>
                      <dd>{customer.phone || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.company')}</dt>
                      <dd>{customer.company || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('fields.createdAt')}</dt>
                      <dd>{date(customer.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">{t('portalAccess.label')}</dt>
                      <dd>
                        <Badge variant={customer.portal_access_enabled ? 'success' : 'secondary'}>
                          {t(
                            customer.portal_access_enabled
                              ? 'portalAccess.enabled'
                              : 'portalAccess.disabled',
                          )}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                  <Can permission="customers.manage">
                    <div className="flex gap-2">
                      <Button asChild variant="outline">
                        <Link to={`/customers/${customer.id}/edit`}>{t('edit')}</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => void handleDelete()}
                      >
                        {t('actions.delete')}
                      </Button>
                      {customer.portal_access_enabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={revokeMutation.isPending}
                          onClick={() => void handleRevokePortalAccess()}
                        >
                          {t('portalAccess.revoke')}
                        </Button>
                      ) : customer.email ? (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={grantMutation.isPending}
                          onClick={handleGrantPortalAccess}
                        >
                          {t('portalAccess.grant')}
                        </Button>
                      ) : (
                        <span className="self-center text-sm text-muted-foreground">
                          {t('portalAccess.noEmailHint')}
                        </span>
                      )}
                    </div>
                  </Can>
                </CardContent>
              </Card>
              <ContactDetailsSection customerId={customer.id} />
              <NotesSection customerId={customer.id} />
              <AttachmentsSection customerId={customer.id} />
              <InteractionTimelineSection customerId={customer.id} />
            </>
          )}
        </QueryBoundary>
      ) : (
        <Empty title={t('notFound')} />
      )}
    </div>
  )
}
